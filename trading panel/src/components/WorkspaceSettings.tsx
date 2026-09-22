import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { clearAccountTradingData } from '../lib/accountApi'
import type { AccountTier } from '../lib/accountApi'
import { HIDE_WORKSPACE_NAME_UI, LOCK_CURRENCY_TO_USD, LOCK_LANGUAGE_TO_ENGLISH } from '../config/locks'
import { LanguageSwitcher } from './LanguageSwitcher'
import { disconnectDevice, getDeviceStatus } from '../lib/deviceApi'
import type { DeviceStatus } from '../lib/deviceApi'
import { exportAsCsv, exportAsJson } from '../lib/exportData'
import { importTrades, parseTradesJson } from '../lib/importData'
import { parseTradesExcel } from '../lib/importExcel'
import { importOrUpdateTrades } from '../lib/mergeImport'
import { sendTestPush, subscribeToPush } from '../lib/pushApi'
import { getStoredSession } from '../lib/session'
import { redeemTemplateSwitchCode } from '../lib/templateSwitchApi'
import { canSelectTemplateDirectly, renameWorkspace, updateFieldSettings, updateWorkspaceSettings } from '../lib/workspacesApi'
import type { FieldSettings, Workspace, WorkspaceTemplate } from '../lib/workspacesApi'
import { CURRENCIES } from '../types/trade'
import type { Trade } from '../types/trade'
import { TemplatePicker } from './TemplatePicker'
import styles from './WorkspaceSettings.module.css'

interface WorkspaceSettingsProps {
  workspace: Workspace
  accountId: string
  /** כל ה-workspace id-ים של החשבון (לא רק הפעיל) - נדרש ל-"Clear Trading Data",
   * שמנקה טריידים בכל ה-workspaces של Pro, לא רק בזה שמוצג כרגע. */
  workspaceIds: string[]
  tier: AccountTier
  trades: Trade[]
  onFieldSettingsChange: (fieldSettings: FieldSettings) => void
  onWorkspaceUpdated: (patch: Partial<Workspace>) => void
  /** נקרא אחרי "Clear Trading Data" מוצלח - App.tsx טוען מחדש workspaces+trades במקום
   * לעבור למסך נפרד, כי החשבון/דרגה/קוד/session נשארים כפי שהיו. */
  onTradingDataCleared: () => void | Promise<void>
  /** נקרא אחרי ייבוא מוצלח עם הטריידים החדשים שנוצרו בפועל - להוספה ל-state הקיים ב-App.tsx. */
  onTradesImported: (imported: Trade[]) => void
  /** נקרא אחרי ייבוא Excel עם השלמת שדות בטריידים קיימים - להחלפה ב-state הקיים לפי id. */
  onTradesUpdated: (updated: Trade[]) => void
  /** פותח את מודל קוד הגישה - להזנת קוד Pro/שדרוג. */
  onOpenAccessCode: () => void
  /** נקרא אחרי שהתבנית נשמרה בהצלחה (TemplatePicker) - זהה ל-App.tsx's handleTemplateSelected
   * שכבר מועבר ל-Tools, כאן משמש כדי לעדכן את אותו state כשהבחירה קורית מכאן. */
  onTemplateSelected: (template: WorkspaceTemplate) => void
  /** מספר שעולה בכל פעם ש-PillNav's badge popover ניווט לכאן (תבנית נעולה שנלחצה) - גורם
   * לגלילה אל סעיף "Trading style" + פתיחת טופס ה-switch-code (אם רלוונטי, ר' `presetSwitchTemplate`).
   * לא מוגדר/0 = לא לגלול (ניווט רגיל לטאב Settings, לא דרך ה-badge). */
  focusTemplateSignal?: number
  /** התבנית הנעולה שנלחצה ב-badge popover - כשמוגדר ואי-אפשר לבחור ישירות (Basic עם תבנית
   * קיימת), פותח את טופס ה-switch-code עם התבנית הזו כבר נבחרת, כדי שלא יצטרך לבחור שוב. */
  presetSwitchTemplate?: WorkspaceTemplate | null
}

/**
 * מסך ההגדרות: הפעלה/כיבוי שדות אופציונליים, שם/מטבע בסיס של ה-workspace, ייצוא
 * JSON/CSV, וניקוי דאטה מסחרית עם אישור כפול. שינויים כאן לעולם לא נוגעים בדאטה קיימת
 * של טריידים - חוץ מ-"Clear Trading Data" עצמה, שהיא בלתי הפיכה ומוגנת באישור כפול,
 * אבל לא נוגעת בחשבון/דרגה/קוד גישה - רק בטריידים/watchlist (ראה `accountApi.clearAccountTradingData`).
 */
export function WorkspaceSettings({
  workspace,
  accountId,
  workspaceIds,
  tier,
  trades,
  onFieldSettingsChange,
  onWorkspaceUpdated,
  onTradingDataCleared,
  onTradesImported,
  onTradesUpdated,
  onOpenAccessCode,
  onTemplateSelected,
  focusTemplateSignal,
  presetSwitchTemplate,
}: WorkspaceSettingsProps) {
  const { t } = useLanguage()

  const TEMPLATE_LABELS: Record<WorkspaceTemplate, string> = {
    day: t('templatePicker.day.name'),
    swing: t('templatePicker.swing.name'),
    longterm: t('templatePicker.longterm.name'),
    crypto: t('templatePicker.crypto.name'),
  }

  const FIELD_LABELS: Record<keyof FieldSettings, string> = {
    stopLoss: t('tradeForm.stopLossLabel'),
    takeProfit: t('tradeForm.takeProfitLabel'),
    fee: t('common.fee'),
    notes: t('common.notes'),
    setup: t('tradeForm.setupLabel'),
    requireExactTime: t('workspaceSettings.requireExactTimeLabel'),
  }

  const TIER_LABELS: Record<AccountTier, string> = {
    demo: t('workspaceSettings.tierDemo'),
    basic: t('workspaceSettings.tierBasic'),
    pro: t('workspaceSettings.tierPro'),
  }

  const CLEAR_CONFIRM_WORD = t('workspaceSettings.clearDataConfirmWord')

  const [saving, setSaving] = useState<keyof FieldSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(workspace.name)
  const [nameSaving, setNameSaving] = useState(false)
  const [currencySaving, setCurrencySaving] = useState(false)

  // תקציב סיכון יומי (Day Trading בלבד - robust-munching-puffin.md סבב C2). מחרוזת מקומית
  // (לא number) כדי לאפשר שדה ריק/מצב עריכה חופשי בזמן הקלדה, בדיוק כמו `name` למעלה -
  // שמירה קורית ב-onBlur, לא בכל הקשה.
  const [riskBudgetInput, setRiskBudgetInput] = useState(workspace.dailyRiskBudget === null ? '' : String(workspace.dailyRiskBudget))
  const [riskBudgetSaving, setRiskBudgetSaving] = useState(false)

  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [clearSuccess, setClearSuccess] = useState(false)

  const [pushEnabling, setPushEnabling] = useState(false)
  const [pushStatus, setPushStatus] = useState<string | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null)
  const [deviceStatusError, setDeviceStatusError] = useState<string | null>(null)
  const [disconnectingIndex, setDisconnectingIndex] = useState<number | null>(null)

  // בחירת/החלפת תבנית (robust-munching-puffin.md סבב B) - שני מסלולים נפרדים לפי הרשאה:
  // canSelectTemplateDirectly (Demo/Pro, או Basic בבחירה הראשונה) פותח את TemplatePicker
  // ישירות (כותב ישירות ללקוח - מותר, ר' 027_protect_workspace_template.sql). Basic עם
  // תבנית כבר קיימת **חייב** לעבור דרך switch-template Edge Function שמקבלת קוד+תבנית
  // יחד וכותבת את שתיהן תחת service_role - טריגר ה-DB חוסם כל כתיבה ישירה של הלקוח כאן,
  // אז אין עוד שלב-ביניים של "פתח TemplatePicker אחרי קוד תקין" כמו שהיה בטיוטה הראשונה.
  const canPickTemplateDirectly = canSelectTemplateDirectly(tier, workspace.template)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [switchFormOpen, setSwitchFormOpen] = useState(false)
  const [switchCode, setSwitchCode] = useState('')
  const [switchTemplate, setSwitchTemplate] = useState<WorkspaceTemplate | ''>('')
  const [switchSubmitting, setSwitchSubmitting] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  // ניווט מ-PillNav's badge popover (תבנית נעולה שנלחצה) - גולל לסעיף הזה ופותח את טופס
  // ה-switch-code מוכן-מראש, במקום UI מקביל בתוך הפופאובר עצמו (ר' focusTemplateSignal ב-props).
  const templateSectionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focusTemplateSignal) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    templateSectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
    if (presetSwitchTemplate && !canPickTemplateDirectly) {
      setPickerOpen(false)
      setSwitchError(null)
      setSwitchCode('')
      setSwitchTemplate(presetSwitchTemplate)
      setSwitchFormOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTemplateSignal])

  const handleTemplatePicked = (template: WorkspaceTemplate) => {
    onTemplateSelected(template)
    setPickerOpen(false)
  }

  const submitSwitchForm = async (e: FormEvent) => {
    e.preventDefault()
    const session = getStoredSession()
    if (!session || !switchCode.trim() || !switchTemplate) return
    setSwitchSubmitting(true)
    setSwitchError(null)
    try {
      await redeemTemplateSwitchCode(session.accessToken, workspace.id, switchCode.trim(), switchTemplate)
      onTemplateSelected(switchTemplate)
      setSwitchFormOpen(false)
      setSwitchCode('')
      setSwitchTemplate('')
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : t('workspaceSettings.templateSwitchFailed'))
    } finally {
      setSwitchSubmitting(false)
    }
  }

  useEffect(() => {
    if (tier === 'demo') return
    const session = getStoredSession()
    if (!session) return
    let cancelled = false
    getDeviceStatus(session.accessToken)
      .then((status) => {
        if (!cancelled) setDeviceStatus(status)
      })
      .catch((err) => {
        if (!cancelled) setDeviceStatusError(err instanceof Error ? err.message : t('workspaceSettings.deviceStatusFailed'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier])

  const handleDisconnectDevice = async (index: number) => {
    const session = getStoredSession()
    if (!session) return
    setDisconnectingIndex(index)
    setDeviceStatusError(null)
    try {
      await disconnectDevice(session.accessToken, index)
      const refreshed = await getDeviceStatus(session.accessToken)
      setDeviceStatus(refreshed)
    } catch (err) {
      setDeviceStatusError(err instanceof Error ? err.message : t('workspaceSettings.deviceDisconnectFailed'))
    } finally {
      setDisconnectingIndex(null)
    }
  }

  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  /** 'success' = כל השורות עברו, 'partial' = חלק מהשורות/שגיאות, 'error' = כלום לא עבר (0 נוצרו/עודכנו/ללא שינוי). */
  const [importTone, setImportTone] = useState<'success' | 'partial' | 'error' | null>(null)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  /** Breakdown לכרטיס-הסיכום (import-export-feedback-directions.html כיוון 3) - נגזר
   * מאותם מספרים שכבר מחושבים ל-importStatus, לא דאטה נוספת. ריק = בלי stat-grid
   * (המקרה שבו אף שורה לא זוהתה בכלל). */
  const [importStats, setImportStats] = useState<{ key: string; labelKey: TranslationKey; value: number; tone: 'created' | 'updated' | 'skipped' }[]>([])
  const importInputRef = useRef<HTMLInputElement>(null)

  const toggle = async (key: keyof FieldSettings) => {
    const next = { ...workspace.fieldSettings, [key]: !workspace.fieldSettings[key] }
    setSaving(key)
    setError(null)
    try {
      await updateFieldSettings(workspace.id, next)
      onFieldSettingsChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceSettings.saveFieldFailed'))
    } finally {
      setSaving(null)
    }
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === workspace.name) return
    setNameSaving(true)
    setError(null)
    try {
      await renameWorkspace(workspace.id, trimmed)
      onWorkspaceUpdated({ name: trimmed })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceSettings.renameFailed'))
      setName(workspace.name)
    } finally {
      setNameSaving(false)
    }
  }

  const changeCurrency = async (baseCurrency: Workspace['baseCurrency']) => {
    setCurrencySaving(true)
    setError(null)
    try {
      await updateWorkspaceSettings(workspace.id, { baseCurrency })
      onWorkspaceUpdated({ baseCurrency })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceSettings.currencyChangeFailed'))
    } finally {
      setCurrencySaving(false)
    }
  }

  /** מחרוזת ריקה = מבטל את התקציב (null) - כל ערך אחר מנותח כמספר, שלילי/NaN לא נשמר. */
  const saveRiskBudget = async () => {
    const trimmed = riskBudgetInput.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setRiskBudgetInput(workspace.dailyRiskBudget === null ? '' : String(workspace.dailyRiskBudget))
      return
    }
    if (parsed === workspace.dailyRiskBudget) return
    setRiskBudgetSaving(true)
    setError(null)
    try {
      await updateWorkspaceSettings(workspace.id, { dailyRiskBudget: parsed })
      onWorkspaceUpdated({ dailyRiskBudget: parsed })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceSettings.dailyRiskBudgetSaveFailed'))
      setRiskBudgetInput(workspace.dailyRiskBudget === null ? '' : String(workspace.dailyRiskBudget))
    } finally {
      setRiskBudgetSaving(false)
    }
  }

  const enablePush = async () => {
    setPushEnabling(true)
    setPushStatus(null)
    try {
      await subscribeToPush(accountId)
      setPushStatus(t('workspaceSettings.pushEnabledSuccess'))
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : t('workspaceSettings.enablePushFailed'))
    } finally {
      setPushEnabling(false)
    }
  }

  const sendTest = async () => {
    const session = getStoredSession()
    if (!session) {
      setTestStatus(t('workspaceSettings.noActiveSession'))
      return
    }
    setTestSending(true)
    setTestStatus(null)
    try {
      await sendTestPush(session.accessToken)
      setTestStatus(t('workspaceSettings.testSentSuccess'))
    } catch (err) {
      setTestStatus(err instanceof Error ? err.message : t('workspaceSettings.sendTestFailed'))
    } finally {
      setTestSending(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // מאפשר לבחור שוב את אותו קובץ (input לא מפעיל onChange בבחירה זהה בלי איפוס)
    if (!file) return
    setImporting(true)
    setImportStatus(null)
    setImportErrors([])
    setImportTone(null)
    setImportStats([])
    setImportFileName(file.name)
    try {
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        const { rows, errors, detectedHeaders } = await parseTradesExcel(buffer)
        setImportErrors(errors)
        const result = await importOrUpdateTrades(workspace.id, accountId, rows, trades)
        onTradesImported(result.createdTrades)
        onTradesUpdated(result.updatedTrades)

        if (result.created === 0 && result.updated === 0 && result.unchanged === 0) {
          // אף שורה לא זוהתה בכלל - כנראה כותרות העמודות לא תואמות לאף מילה נרדפת שאנו מכירים.
          // מציגים את הכותרות הגולמיות שנקראו כדי שהמשתמש יבין מיד מה קרה, בלי לנחש.
          setImportStatus(
            t('workspaceSettings.importExcelNoRows', {
              headers: detectedHeaders.length > 0 ? detectedHeaders.join(', ') : '—',
            }),
          )
          setImportTone('error')
        } else {
          setImportStatus(
            t('workspaceSettings.importExcelResult', {
              created: result.created,
              updated: result.updated,
              unchanged: result.unchanged,
            }),
          )
          setImportTone(errors.length > 0 || result.ambiguous > 0 ? 'partial' : 'success')
          setImportStats([
            { key: 'created', labelKey: 'workspaceSettings.importStatCreated', value: result.created, tone: 'created' },
            { key: 'updated', labelKey: 'workspaceSettings.importStatUpdated', value: result.updated, tone: 'updated' },
            { key: 'unchanged', labelKey: 'workspaceSettings.importStatUnchanged', value: result.unchanged, tone: 'skipped' },
          ])
        }
        if (result.ambiguous > 0) {
          setImportErrors((prev) => [...prev, t('workspaceSettings.importAmbiguous', { count: result.ambiguous })])
        }
      } else {
        const text = await file.text()
        const parsedTrades = parseTradesJson(text)
        const result = await importTrades(workspace.id, accountId, parsedTrades, trades)
        onTradesImported(result.importedTrades)
        setImportStatus(t('workspaceSettings.importResult', { imported: result.imported, skipped: result.skipped }))
        setImportTone(result.imported > 0 ? (result.skipped > 0 ? 'partial' : 'success') : 'error')
        setImportStats([
          { key: 'imported', labelKey: 'workspaceSettings.importStatImported', value: result.imported, tone: 'created' },
          { key: 'skipped', labelKey: 'workspaceSettings.importStatSkipped', value: result.skipped, tone: 'skipped' },
        ])
      }
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : t('workspaceSettings.importFailed'))
      setImportTone('error')
      setImportStats([])
    } finally {
      setImporting(false)
    }
  }

  const startClear = () => {
    setClearStep(1)
    setConfirmText('')
    setClearError(null)
    setClearSuccess(false)
  }

  const confirmClear = async () => {
    if (confirmText !== CLEAR_CONFIRM_WORD) return
    setClearing(true)
    setClearError(null)
    try {
      await clearAccountTradingData(accountId, workspaceIds)
      setClearStep(0)
      setConfirmText('')
      setClearSuccess(true)
      await onTradingDataCleared()
    } catch (err) {
      setClearError(err instanceof Error ? err.message : t('workspaceSettings.clearDataFailed'))
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span className={`eyebrow ${styles.eyebrow}`}>{t('workspaceSettings.eyebrow')}</span>
        <h2 className={`hero-title ${styles.heroTitle}`}>{t('nav.settings')}</h2>
        <p className={styles.pageNote}>{t('workspaceSettings.pageNote')}</p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.workspaceTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.workspaceHint')}</span>
        </div>
        <div className={`${styles.card} glass`}>
          {!HIDE_WORKSPACE_NAME_UI && (
            <div className={styles.rowLine}>
              <span className={styles.rowLbl}>{t('common.name')}</span>
              <input
                className={styles.textInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                disabled={nameSaving}
              />
            </div>
          )}
          <div className={styles.rowLine}>
            <span className={styles.rowLbl}>{t('workspaceSettings.currentTier')}</span>
            <span className={styles.tierChip}>{TIER_LABELS[tier]}</span>
          </div>
          {!LOCK_LANGUAGE_TO_ENGLISH && (
            <div className={styles.rowLine}>
              <span className={styles.rowLbl}>{t('workspaceSettings.languageLabel')}</span>
              <LanguageSwitcher className={styles.textInput} />
            </div>
          )}
          {!LOCK_CURRENCY_TO_USD && (
            <div className={styles.rowLine}>
              <span className={styles.rowLbl}>
                {t('workspaceSettings.baseCurrencyLabel')}
                <span className={styles.rowSub}>{t('workspaceSettings.baseCurrencyHint')}</span>
              </span>
              <select
                className={styles.textInput}
                value={workspace.baseCurrency}
                onChange={(e) => changeCurrency(e.target.value as Workspace['baseCurrency'])}
                disabled={currencySaving}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tier !== 'pro' && (
            <>
              <p className={styles.hint} style={{ marginTop: 14 }}>
                {t('workspaceSettings.proHint')}
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.actionAmber} onClick={onOpenAccessCode}>
                  {t('access.enterCode')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.section} ref={templateSectionRef}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.templateTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.templateHint')}</span>
        </div>
        <div className={`${styles.card} glass`}>
          <div className={styles.rowLine}>
            <span className={styles.rowLbl}>{t('workspaceSettings.templateCurrentLabel')}</span>
            <span className={styles.tierChip}>
              {workspace.template ? TEMPLATE_LABELS[workspace.template] : t('workspaceSettings.templateNotSelected')}
            </span>
          </div>

          {!canPickTemplateDirectly && !pickerOpen && (
            <p className={styles.hint} style={{ marginTop: 14 }}>
              {t('workspaceSettings.templateSwitchHint')}
            </p>
          )}

          {!pickerOpen && !switchFormOpen && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionAmber}
                onClick={() => {
                  setSwitchError(null)
                  setSwitchCode('')
                  setSwitchTemplate('')
                  if (canPickTemplateDirectly) setPickerOpen(true)
                  else setSwitchFormOpen(true)
                }}
              >
                {workspace.template ? t('workspaceSettings.templateChangeButton') : t('workspaceSettings.templateChooseButton')}
              </button>
            </div>
          )}

          {switchFormOpen && !pickerOpen && (
            <form className="count-in" onSubmit={submitSwitchForm} style={{ marginTop: 14 }}>
              <div className={styles.rowLine}>
                <span className={styles.rowLbl}>{t('workspaceSettings.templateSwitchNewLabel')}</span>
                <select
                  className={styles.textInput}
                  value={switchTemplate}
                  onChange={(e) => setSwitchTemplate(e.target.value as WorkspaceTemplate | '')}
                  disabled={switchSubmitting}
                >
                  <option value="" disabled>
                    {t('workspaceSwitcher.templateChooseLater')}
                  </option>
                  {(['day', 'swing', 'longterm', 'crypto'] as const).map((tpl) => (
                    <option key={tpl} value={tpl}>
                      {TEMPLATE_LABELS[tpl]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.rowLine}>
                <span className={styles.rowLbl}>{t('accessCode.title')}</span>
                <input
                  className={styles.textInput}
                  value={switchCode}
                  onChange={(e) => setSwitchCode(e.target.value)}
                  placeholder={t('accessCode.placeholder')}
                  disabled={switchSubmitting}
                />
              </div>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.actionAmber}
                  disabled={switchSubmitting || !switchCode.trim() || !switchTemplate}
                >
                  {switchSubmitting ? t('accessCode.checking') : t('workspaceSettings.templateSwitchConfirm')}
                </button>
                <button type="button" onClick={() => setSwitchFormOpen(false)} disabled={switchSubmitting}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
          {switchError && <p className={styles.status}>{switchError}</p>}

          {pickerOpen && (
            <div className="count-in" style={{ marginTop: 14 }}>
              <TemplatePicker workspaceId={workspace.id} onSelected={handleTemplatePicked} />
              <div className={styles.actions} style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setPickerOpen(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* תקציב סיכון יומי - Day Trading בלבד (robust-munching-puffin.md סבב C2), אותו דפוס
              של סעיף מותנה-בתבנית כמו שאר הסעיף הזה. */}
          {workspace.template === 'day' && (
            <div className={styles.rowLine}>
              <span className={styles.rowLbl}>
                {t('workspaceSettings.dailyRiskBudgetLabel')}
                <span className={styles.rowSub}>{t('workspaceSettings.dailyRiskBudgetHint')}</span>
              </span>
              <input
                className={styles.textInput}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder={t('workspaceSettings.dailyRiskBudgetPlaceholder')}
                value={riskBudgetInput}
                onChange={(e) => setRiskBudgetInput(e.target.value)}
                onBlur={saveRiskBudget}
                disabled={riskBudgetSaving}
              />
            </div>
          )}
        </div>
      </div>

      {/* מוצג גם כש-deviceStatus נשאר null (ה-fetch נכשל, למשל device-status עוד לא פרוס) -
          כל עוד יש deviceStatusError, כדי שהמשתמש יראה הודעת שגיאה ברורה במקום שהסעיף
          כולו ייעלם בלי הסבר. אם אין לא deviceStatus.hasCode ולא שגיאה (עדיין טוען, או
          שהחשבון פשוט לא מימש קוד) - לא מציגים כלום, כמו קודם. */}
      {tier !== 'demo' && (deviceStatus?.hasCode || deviceStatusError) && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>{t('workspaceSettings.devicesTitle')}</h3>
            <span className={styles.sectionHint}>{t('workspaceSettings.devicesHint')}</span>
          </div>
          <div className={`${styles.card} glass`}>
            {deviceStatus?.hasCode &&
              (deviceStatus.unlimitedDevices ? (
                <p className={styles.hint}>{t('workspaceSettings.devicesUnlimited')}</p>
              ) : (
                <div className={styles.list}>
                  {deviceStatus.deviceIndexes.map((index) => {
                    const cooldownActive = deviceStatus.cooldownRemainingDays > 0
                    const disabled = cooldownActive || disconnectingIndex !== null
                    return (
                      <div className={styles.rowLine} key={index}>
                        <span className={styles.rowLbl}>{t('workspaceSettings.deviceLabel', { n: index + 1 })}</span>
                        <button type="button" onClick={() => handleDisconnectDevice(index)} disabled={disabled}>
                          {disconnectingIndex === index
                            ? t('workspaceSettings.disconnecting')
                            : cooldownActive
                              ? t('workspaceSettings.disconnectCooldown', { days: deviceStatus.cooldownRemainingDays })
                              : t('workspaceSettings.disconnectButton')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            {deviceStatusError && <p className={styles.status}>{deviceStatusError}</p>}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.optionalFieldsTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.optionalFieldsHint')}</span>
        </div>
        <div className={`${styles.card} glass`}>
          <div className={styles.list}>
            {(Object.keys(FIELD_LABELS) as (keyof FieldSettings)[]).map((key) => (
              <label className={`${styles.rowLine} ${styles.toggleRow}`} key={key}>
                <span className={styles.rowLbl}>
                  {FIELD_LABELS[key]}
                  {key === 'requireExactTime' && (
                    <span className={styles.rowSub}>{t('workspaceSettings.requireExactTimeHint')}</span>
                  )}
                </span>
                <span className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={workspace.fieldSettings[key]}
                    disabled={saving === key}
                    onChange={() => toggle(key)}
                  />
                  <span className={styles.switchTrack} />
                  <span className={styles.switchKnob} />
                </span>
              </label>
            ))}
          </div>
          <p className={styles.status}>{error ?? ''}</p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.pushTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.pushHintShort')}</span>
        </div>
        <div className={`${styles.card} glass`}>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            {t('workspaceSettings.pushHint')}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.actionAmber} onClick={enablePush} disabled={pushEnabling}>
              {pushEnabling ? t('workspaceSettings.enablingPush') : t('workspaceSettings.enablePush')}
            </button>
            <button type="button" onClick={sendTest} disabled={testSending}>
              {testSending ? t('workspaceSettings.sendingTest') : t('workspaceSettings.sendTest')}
            </button>
          </div>
          <p className={styles.status}>{pushStatus ?? testStatus ?? ''}</p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.exportTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.exportImportHintShort')}</span>
        </div>
        <div className={`${styles.card} glass`}>
          <div className={styles.formatList}>
            <div className={styles.formatItem}>
              <span className={styles.formatName}>JSON</span>
              <span className={styles.formatDesc}>{t('workspaceSettings.exportJsonHint')}</span>
            </div>
            <div className={styles.formatItem}>
              <span className={styles.formatName}>CSV</span>
              <span className={styles.formatDesc}>{t('workspaceSettings.exportCsvHint')}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => exportAsJson(trades)}>
              {t('workspaceSettings.exportJson')}
            </button>
            <button type="button" onClick={() => exportAsCsv(trades)}>
              {t('workspaceSettings.exportCsv')}
            </button>
          </div>

          <div className={`${styles.rowLine} ${styles.importDivider}`}>
            <span className={styles.rowLbl}>{t('workspaceSettings.importTitle')}</span>
          </div>
          <div className={styles.formatList}>
            <div className={styles.formatItem}>
              <span className={styles.formatName}>{t('workspaceSettings.importExcelLabel')}</span>
              <span className={styles.formatDesc}>{t('workspaceSettings.importExcelHint')}</span>
            </div>
            <div className={styles.formatItem}>
              <span className={styles.formatName}>JSON</span>
              <span className={styles.formatDesc}>{t('workspaceSettings.importHint')}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.xlsx"
              hidden
              onChange={handleImportFile}
            />
            <button type="button" className={styles.actionAmber} onClick={() => importInputRef.current?.click()} disabled={importing}>
              {importing ? t('workspaceSettings.importing') : t('workspaceSettings.importButton')}
            </button>
          </div>
          {importStatus && (
            <div
              className={`${styles.importResult} count-in ${
                importTone === 'success'
                  ? styles.importResultSuccess
                  : importTone === 'error'
                    ? styles.importResultError
                    : styles.importResultPartial
              }`}
            >
              <div className={styles.importResultHead}>
                <span
                  className={`${styles.importResultIcon} ${
                    importTone === 'error' ? styles.importResultIconError : styles.importResultIconOk
                  }`}
                  aria-hidden="true"
                >
                  {importTone === 'error' ? '!' : '✓'}
                </span>
                <div>
                  <p className={styles.importResultTitle}>
                    {t(
                      importTone === 'success'
                        ? 'workspaceSettings.importResultTitleSuccess'
                        : importTone === 'error'
                          ? 'workspaceSettings.importResultTitleError'
                          : 'workspaceSettings.importResultTitlePartial',
                    )}
                  </p>
                  {importFileName && <p className={styles.importResultFile}>{importFileName}</p>}
                </div>
              </div>
              <p className={styles.importResultText}>{importStatus}</p>
              {importStats.length > 0 && (
                <div className={styles.importStatGrid}>
                  {importStats.map((stat) => (
                    <div
                      key={stat.key}
                      className={`${styles.importStatCell} ${
                        stat.tone === 'created'
                          ? styles.importStatCellCreated
                          : stat.tone === 'updated'
                            ? styles.importStatCellUpdated
                            : styles.importStatCellSkipped
                      }`}
                    >
                      <span className={`num ${styles.importStatValue}`}>{stat.value}</span>
                      <span className={styles.importStatLabel}>{t(stat.labelKey)}</span>
                    </div>
                  ))}
                </div>
              )}
              {importErrors.length > 0 && (
                <ul className={styles.importResultList}>
                  {importErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importErrors.length > 5 && (
                    <li>{t('workspaceSettings.importMoreErrors', { count: importErrors.length - 5 })}</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.contactTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.contactHint')}</span>
        </div>
        <div className={`${styles.card} glass`}>
          <p className={styles.hint}>{t('workspaceSettings.contactText')}</p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>{t('workspaceSettings.dangerZoneTitle')}</h3>
          <span className={styles.sectionHint}>{t('workspaceSettings.dangerZoneHint')}</span>
        </div>
        <div className={styles.dangerCard}>
          <div className={styles.dangerTitle}>{t('workspaceSettings.clearDataButton')}</div>
          <p className={styles.hint} style={{ marginBottom: 14 }}>
            {t('workspaceSettings.dangerCardHint')}
          </p>
          {clearStep === 0 && (
            <>
              <button type="button" className={styles.dangerButton} onClick={startClear}>
                {t('workspaceSettings.clearDataButton')}
              </button>
              {clearSuccess && <p className={`${styles.successBanner} count-in`}>{t('workspaceSettings.clearDataSuccess')}</p>}
            </>
          )}

          {clearStep === 1 && (
            <div className={`${styles.confirmBox} count-in`}>
              <p>{t('workspaceSettings.clearDataConfirmStep1')}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.dangerButton} onClick={() => setClearStep(2)}>
                  {t('common.yesContinue')}
                </button>
                <button type="button" onClick={() => setClearStep(0)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {clearStep === 2 && (
            <div className={`${styles.confirmBox} count-in`}>
              <p>{t('workspaceSettings.clearDataConfirmStep2', { word: CLEAR_CONFIRM_WORD })}</p>
              <input
                className={styles.textInput}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={confirmClear}
                  disabled={confirmText !== CLEAR_CONFIRM_WORD || clearing}
                >
                  {clearing ? t('workspaceSettings.clearingData') : t('workspaceSettings.clearDataForever')}
                </button>
                <button type="button" onClick={() => setClearStep(0)} disabled={clearing}>
                  {t('common.cancel')}
                </button>
              </div>
              {clearError && <p className={`${styles.status} count-in`}>{clearError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
