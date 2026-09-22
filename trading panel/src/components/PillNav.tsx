import { useEffect, useRef, useState } from 'react'
import { BookOpen, Calculator, Calendar, ChevronDown, Home, Lock, Radar, Settings } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { useModalEscape } from '../hooks/useModalEscape'
import type { AccountTier } from '../lib/accountApi'
import { canSelectTemplateDirectly, setWorkspaceTemplate } from '../lib/workspacesApi'
import type { Workspace, WorkspaceTemplate } from '../lib/workspacesApi'
import styles from './PillNav.module.css'

export type Tab = 'home' | 'journal' | 'positions' | 'tools' | 'calendar' | 'settings'

interface NavItem {
  tab: Tab
  labelKey: TranslationKey
  icon: ComponentType<{ size?: number; className?: string }>
}

/** פריטי הגלולה הראשית (עם טקסט+אייקון). Settings **לא** כאן - הוא כפתור אייקון נפרד, ראה `settingsButton` למטה. */
const NAV_ITEMS: NavItem[] = [
  { tab: 'home', labelKey: 'nav.home', icon: Home },
  { tab: 'journal', labelKey: 'nav.journal', icon: BookOpen },
  { tab: 'positions', labelKey: 'nav.openPositions', icon: Radar },
  { tab: 'tools', labelKey: 'nav.tools', icon: Calculator },
  { tab: 'calendar', labelKey: 'nav.calendar', icon: Calendar },
]

const TEMPLATES: WorkspaceTemplate[] = ['day', 'swing', 'longterm', 'crypto']

const TEMPLATE_NAME_KEY: Record<WorkspaceTemplate, TranslationKey> = {
  day: 'templatePicker.day.name',
  swing: 'templatePicker.swing.name',
  longterm: 'templatePicker.longterm.name',
  crypto: 'templatePicker.crypto.name',
}

interface PillNavProps {
  tab: Tab
  onChangeTab: (tab: Tab) => void
  /** תוכן חופשי לקצה השני של הפס - כרגע WorkspaceSwitcher/ThemeSwitcher/NotificationBell/HeaderClock (ראה App.tsx). */
  actions?: ReactNode
  /** ה-workspace הפעיל + הדרגה - נדרשים ל-badge/popover בחירת תבנית מהירה (header-direction-b.html).
   * אופציונליים כדי לא לשבור קריאות ישנות/בדיקות שלא מזינים אותם - כשלא מועברים, ה-badge לא מוצג. */
  workspace?: Workspace
  tier?: AccountTier
  /** נקרא אחרי שהתבנית נבחרה/הוחלפה ישירות מה-badge (Demo/Pro, או Basic בבחירה הראשונה) -
   * זהה ל-App.tsx's handleTemplateSelected, מעדכן את ה-state המקומי אחרי שהכתיבה ל-DB הצליחה. */
  onTemplateSelected?: (template: WorkspaceTemplate) => void
  /** נקרא כשנלחצת תבנית נעולה (Basic עם תבנית קיימת) - App.tsx מנווט לטאב Settings וגולל
   * לסעיף "Trading style" הקיים (WorkspaceSettings.tsx), לא בונה UI מקביל כאן. */
  onOpenTemplateSettings?: (template: WorkspaceTemplate) => void
}

/**
 * ניווט עליון בסגנון "pill-nav" (בהשראת swing-trader): באנר קבוע למעלה עם לוגו/מותג,
 * badge לבחירת תבנית מסחר מהירה (header-direction-b.html), קבוצת כפתורי ניווט בתוך גלולה
 * מתכתית (btn-metal, ראה index.css), ופעולות בקצה השני. flex רגיל (בלי row-reverse ידני)
 * כדי שה-RTL/LTR יתהפך אוטומטית לפי dir על ה-<html>.
 */
export function PillNav({ tab, onChangeTab, actions, workspace, tier, onTemplateSelected, onOpenTemplateSettings }: PillNavProps) {
  const t = useTranslation()

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selecting, setSelecting] = useState<WorkspaceTemplate | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const closePopover = () => setPopoverOpen(false)
  const popoverRef = useModalEscape<HTMLDivElement>(popoverOpen, closePopover)

  // סגירה בלחיצה מחוץ ל-badge/popover - אותו דפוס בדיוק כמו NotificationBell.tsx.
  useEffect(() => {
    if (!popoverOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [popoverOpen])

  const showTemplateBadge = Boolean(workspace && tier)
  const canPickDirectly = workspace && tier ? canSelectTemplateDirectly(tier, workspace.template) : true

  const handlePick = async (template: WorkspaceTemplate) => {
    if (!workspace) return
    if (template === workspace.template) {
      setPopoverOpen(false)
      return
    }
    if (!canPickDirectly) {
      setPopoverOpen(false)
      onOpenTemplateSettings?.(template)
      return
    }
    setSelecting(template)
    try {
      await setWorkspaceTemplate(workspace.id, template)
      onTemplateSelected?.(template)
    } finally {
      setSelecting(null)
      setPopoverOpen(false)
    }
  }

  return (
    <header className={`${styles.header} glass-blur`}>
      <div className={styles.inner}>
        <div className={styles.brandCluster} ref={wrapperRef}>
          <div className={`${styles.brand} btn-metal`}>
            <img src="/icons/logo-mark.png" alt="" className={styles.logo} />
            <span className={styles.brandText}>TradePanel</span>
          </div>

          {showTemplateBadge && (
            <>
              <button
                type="button"
                className={`${styles.templateBadge} btn-metal`}
                aria-haspopup="true"
                aria-expanded={popoverOpen}
                onClick={() => setPopoverOpen((v) => !v)}
              >
                <span className={styles.templateBadgeDot} />
                <span className={styles.templateBadgeLabel}>
                  {workspace?.template ? t(TEMPLATE_NAME_KEY[workspace.template]) : t('workspaceSettings.templateNotSelected')}
                </span>
                <ChevronDown size={13} className={`${styles.templateBadgeChev} ${popoverOpen ? styles.templateBadgeChevOpen : ''}`} />
              </button>

              {popoverOpen && (
                <div ref={popoverRef} className={`${styles.templatePopover} metal-panel holo-edge count-in`} role="menu">
                  <div className={styles.templatePopoverTitle}>{t('pillNav.templatePopoverTitle')}</div>
                  {TEMPLATES.map((template) => {
                    const active = workspace?.template === template
                    const locked = !canPickDirectly && !active
                    return (
                      <button
                        key={template}
                        type="button"
                        role="menuitem"
                        className={styles.templateOption}
                        data-active={active}
                        data-locked={locked}
                        disabled={selecting !== null}
                        onClick={() => handlePick(template)}
                      >
                        <span className={styles.templateOptionName}>{t(TEMPLATE_NAME_KEY[template])}</span>
                        {active && <span className={styles.templateOptionCheck}>✓</span>}
                        {locked && (
                          <span className={styles.templateOptionLock}>
                            <Lock size={11} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <nav className={styles.nav} aria-label="Tabs">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = tab === item.tab
            return (
              <button
                key={item.tab}
                type="button"
                data-active={active}
                aria-label={t(item.labelKey)}
                title={t(item.labelKey)}
                className={`${styles.navButton} btn-metal ${active ? 'btn-metal--active' : ''}`}
                onClick={() => onChangeTab(item.tab)}
              >
                <Icon size={16} className={styles.navIcon} />
                <span className={styles.navLabel}>{t(item.labelKey)}</span>
              </button>
            )
          })}
        </nav>

        <button
          type="button"
          aria-label={t('nav.settings')}
          title={t('nav.settings')}
          data-active={tab === 'settings'}
          className={`${styles.settingsButton} btn-metal ${tab === 'settings' ? 'btn-metal--active' : ''}`}
          onClick={() => onChangeTab('settings')}
        >
          <Settings size={17} />
        </button>

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  )
}
