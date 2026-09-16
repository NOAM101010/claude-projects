import { useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { clearAccountTradingData } from '../lib/accountApi'
import type { AccountTier } from '../lib/accountApi'
import { HIDE_WORKSPACE_NAME_UI, LOCK_CURRENCY_TO_USD, LOCK_LANGUAGE_TO_ENGLISH } from '../config/locks'
import { LanguageSwitcher } from './LanguageSwitcher'
import { exportAsCsv, exportAsJson } from '../lib/exportData'
import { importTrades, parseTradesJson } from '../lib/importData'
import { parseTradesExcel } from '../lib/importExcel'
import { importOrUpdateTrades } from '../lib/mergeImport'
import { sendTestPush, subscribeToPush } from '../lib/pushApi'
import { getStoredSession } from '../lib/session'
import { renameWorkspace, updateFieldSettings, updateWorkspaceSettings } from '../lib/workspacesApi'
import type { FieldSettings, Workspace } from '../lib/workspacesApi'
import { CURRENCIES } from '../types/trade'
import type { Trade } from '../types/trade'
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
}: WorkspaceSettingsProps) {
  const { t } = useLanguage()

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

  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [clearSuccess, setClearSuccess] = useState(false)

  const [pushEnabling, setPushEnabling] = useState(false)
  const [pushStatus, setPushStatus] = useState<string | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  /** 'success' = כל השורות עברו, 'partial' = חלק מהשורות/שגיאות, 'error' = כלום לא עבר (0 נוצרו/עודכנו/ללא שינוי). */
  const [importTone, setImportTone] = useState<'success' | 'partial' | 'error' | null>(null)
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
      }
    } catch (err) {
      setImportStatus(err instanceof Error ? err.message : t('workspaceSettings.importFailed'))
      setImportTone('error')
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
              <p className={styles.importResultText}>{importStatus}</p>
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
