import { BookOpen, Calculator, Calendar, Home, Radar, Settings } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
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

interface PillNavProps {
  tab: Tab
  onChangeTab: (tab: Tab) => void
  /** תוכן חופשי לקצה השני של הפס - כרגע WorkspaceSwitcher/ThemeSwitcher/NotificationBell/HeaderClock (ראה App.tsx). */
  actions?: ReactNode
}

/**
 * ניווט עליון בסגנון "pill-nav" (בהשראת swing-trader): באנר קבוע למעלה עם לוגו/מותג,
 * קבוצת כפתורי ניווט בתוך גלולה מתכתית (btn-metal, ראה index.css), ופעולות בקצה השני.
 * flex רגיל (בלי row-reverse ידני) כדי שה-RTL/LTR יתהפך אוטומטית לפי dir על ה-<html>.
 */
export function PillNav({ tab, onChangeTab, actions }: PillNavProps) {
  const t = useTranslation()

  return (
    <header className={`${styles.header} glass-blur`}>
      <div className={styles.inner}>
        <div className={`${styles.brand} btn-metal`}>
          <span className={styles.logo}>
            <span className={styles.logoInner}>T</span>
          </span>
          <span className={styles.brandText}>TradePanel</span>
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
