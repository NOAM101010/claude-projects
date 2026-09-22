import { useEffect, useRef, useState } from 'react'
import { Crown } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { canCreateWorkspace } from '../lib/workspacesApi'
import type { Workspace, WorkspaceTemplate } from '../lib/workspacesApi'
import type { AccountTier } from '../lib/accountApi'
import { getWorkspacePnlTotals } from '../lib/tradesApi'
import { formatCurrency } from '../lib/format'
import { HIDE_NEW_WORKSPACE_BUTTON, HIDE_WORKSPACE_NAME_UI } from '../config/locks'
import { useModalEscape } from '../hooks/useModalEscape'
import styles from './WorkspaceSwitcher.module.css'

/** רשימת התבניות + מפתח שם - ר' TemplatePicker.tsx (אותו מיפוי, כפול בכוונה: כאן זו רק
 * בחירת ברירת-מחדל אופציונלית ב-select פשוט, לא הכרטיסים המלאים עם תיאור). */
const CREATE_TEMPLATE_OPTIONS: { value: WorkspaceTemplate; labelKey: 'templatePicker.day.name' | 'templatePicker.swing.name' | 'templatePicker.longterm.name' | 'templatePicker.crypto.name' }[] = [
  { value: 'day', labelKey: 'templatePicker.day.name' },
  { value: 'swing', labelKey: 'templatePicker.swing.name' },
  { value: 'longterm', labelKey: 'templatePicker.longterm.name' },
  { value: 'crypto', labelKey: 'templatePicker.crypto.name' },
]

/** אות + מחלקת צבע לכל תבנית ב-badge (workspace-switcher-cards-directions.html כיוון 1) -
 * ללא תבנית (עדיין לא נבחרה) מוצג האות הראשונה של השם עם badge ניטרלי. */
const TEMPLATE_BADGE: Record<WorkspaceTemplate, { letter: string; className: string; nameKey: TranslationKey }> = {
  day: { letter: 'D', className: 'day', nameKey: 'templatePicker.day.name' },
  swing: { letter: 'S', className: 'swing', nameKey: 'templatePicker.swing.name' },
  longterm: { letter: 'L', className: 'long', nameKey: 'templatePicker.longterm.name' },
  crypto: { letter: 'C', className: 'crypto', nameKey: 'templatePicker.crypto.name' },
}

interface WorkspaceSwitcherProps {
  accountId: string
  workspaces: Workspace[]
  activeWorkspaceId: string
  tier: AccountTier
  onSwitch: (id: string) => void
  /** template אופציונלי - Pro תמיד חופשי לבחור תבנית כבר ביצירה (ר' createWorkspace). */
  onCreate: (name: string, template?: WorkspaceTemplate) => Promise<void>
  /** פותח את מודל קוד הגישה (שדרוג ל-Pro) - ראה trading-journal-plan.md סעיף 1/5. */
  onOpenAccessCode: () => void
}

/**
 * בורר מרחבי עבודה בהדר. ל-Pro (או כשכבר קיים יותר מ-workspace אחד, למקרה של
 * downgrade עתידי) מציג trigger + dropdown של כרטיסי-preview (badge תבנית + שם + Total
 * P&L, workspace-switcher-cards-directions.html כיוון 1) + יצירה - ראה
 * trading-journal-plan.md סעיף 2. לדרגות שאינן Pro עם workspace יחיד מציג נקודת כניסה
 * ברורה לשדרוג, כדי שהמעבר ל-Pro לא יהיה "תור סמוי" בלי כפתור.
 */
export function WorkspaceSwitcher({
  accountId,
  workspaces,
  activeWorkspaceId,
  tier,
  onSwitch,
  onCreate,
  onOpenAccessCode,
}: WorkspaceSwitcherProps) {
  const { t, locale } = useLanguage()
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<WorkspaceTemplate | ''>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pnlTotals, setPnlTotals] = useState<Record<string, number>>({})
  const wrapperRef = useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0]

  useEffect(() => {
    if (tier !== 'pro' && workspaces.length <= 1) return
    if (!open) return
    let cancelled = false
    // Lazy - נשלף רק כשהדרופדאון באמת נפתח (לא בכל render), ראה getWorkspacePnlTotals.
    getWorkspacePnlTotals(
      accountId,
      workspaces.map((ws) => ws.id),
    )
      .then((totals) => {
        if (!cancelled) setPnlTotals(totals)
      })
      .catch(() => {
        // best-effort - הכרטיסים פשוט לא יציגו P&L הפעם, לא חוסם את המעבר בין workspaces.
      })
    return () => {
      cancelled = true
    }
  }, [open, accountId, workspaces, tier])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const closeDropdown = () => {
    setOpen(false)
    setShowCreate(false)
  }
  const dropdownRef = useModalEscape<HTMLDivElement>(open, closeDropdown)

  if (tier !== 'pro' && workspaces.length <= 1) {
    return (
      <div className={styles.wrapper}>
        <button
          type="button"
          className={styles.newButton}
          onClick={onOpenAccessCode}
          aria-label={t('workspaceSwitcher.upgradeButton')}
          title={t('workspaceSwitcher.upgradeButton')}
        >
          <Crown size={14} className={styles.upgradeIcon} aria-hidden="true" />
          <span className={styles.upgradeText}>{t('workspaceSwitcher.upgradeButton')}</span>
        </button>
      </div>
    )
  }

  if (HIDE_WORKSPACE_NAME_UI) {
    return null
  }

  const canCreate = canCreateWorkspace(tier, workspaces.length)

  const openCreate = () => {
    setError(null)
    setName('')
    setTemplate('')
    setShowCreate(true)
  }

  const submitCreate = async () => {
    if (!name.trim()) {
      setError(t('workspaceSwitcher.nameRequired'))
      return
    }
    setCreating(true)
    setError(null)
    try {
      await onCreate(name.trim(), template || undefined)
      setShowCreate(false)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workspaceSwitcher.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('workspaceSwitcher.ariaLabel')}
        aria-expanded={open}
      >
        {activeWorkspace && (
          <span className={`${styles.triggerBadge} ${activeWorkspace.template ? styles[`badge_${TEMPLATE_BADGE[activeWorkspace.template].className}`] : styles.badge_none}`}>
            {activeWorkspace.template ? TEMPLATE_BADGE[activeWorkspace.template].letter : activeWorkspace.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className={styles.triggerName}>{activeWorkspace?.name}</span>
      </button>

      {open && (
        <div ref={dropdownRef} className={`${styles.dropdown} metal-panel holo-edge count-in`}>
          <ul className={styles.cardList}>
            {workspaces.map((ws) => {
              const pnl = pnlTotals[ws.id]
              const badge = ws.template ? TEMPLATE_BADGE[ws.template] : null
              return (
                <li key={ws.id}>
                  <button
                    type="button"
                    className={`${styles.wsCard} ${ws.id === activeWorkspaceId ? styles.wsCardActive : ''}`}
                    onClick={() => {
                      onSwitch(ws.id)
                      setOpen(false)
                    }}
                  >
                    <span className={`${styles.wsBadge} ${badge ? styles[`badge_${badge.className}`] : styles.badge_none}`}>
                      {badge ? badge.letter : ws.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.wsMain}>
                      <span className={styles.wsName}>{ws.name}</span>
                      <span className={styles.wsSub}>
                        {badge ? t(badge.nameKey) : t('workspaceSwitcher.noTemplateHint')}
                        {ws.id === activeWorkspaceId ? ` · ${t('workspaceSwitcher.activeNow')}` : ''}
                      </span>
                    </span>
                    {pnl !== undefined && (
                      <span className={`num ${styles.wsPnl} ${pnl >= 0 ? styles.wsPnlPos : styles.wsPnlNeg}`}>
                        {formatCurrency(pnl, ws.baseCurrency, locale)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {!showCreate && !HIDE_NEW_WORKSPACE_BUTTON && (
            <button type="button" className={styles.newButtonInDropdown} onClick={openCreate}>
              {t('workspaceSwitcher.newWorkspace')}
            </button>
          )}

          {showCreate && !HIDE_NEW_WORKSPACE_BUTTON && (
            <div className={styles.createBoxInline}>
              {canCreate ? (
                <>
                  <input
                    className={styles.input}
                    placeholder={t('workspaceSwitcher.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                  <select
                    className={styles.input}
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as WorkspaceTemplate | '')}
                    aria-label={t('workspaceSwitcher.templateLabel')}
                  >
                    <option value="">{t('workspaceSwitcher.templateChooseLater')}</option>
                    {CREATE_TEMPLATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                  <div className={styles.actions}>
                    <button type="button" onClick={submitCreate} disabled={creating}>
                      {creating ? t('common.creating') : t('common.create')}
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)} disabled={creating}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <p className={styles.upgradeHint}>
                  {tier === 'pro' ? <>{t('workspaceSwitcher.proLimitReached')}</> : <>{t('workspaceSwitcher.requiresUpgrade')}</>}{' '}
                  {tier === 'pro' ? (
                    <button type="button" onClick={() => setShowCreate(false)}>
                      {t('common.close')}
                    </button>
                  ) : (
                    <button type="button" onClick={onOpenAccessCode}>
                      {t('access.enterCode')}
                    </button>
                  )}
                </p>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
