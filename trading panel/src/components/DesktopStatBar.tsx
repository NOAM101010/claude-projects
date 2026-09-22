import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency } from '../lib/format'
import { isTradeOpen, totalPnl, winRate } from '../lib/stats'
import type { Trade } from '../types/trade'
import type { Workspace } from '../lib/workspacesApi'
import styles from './DesktopStatBar.module.css'

interface DesktopStatBarProps {
  trades: Trade[]
  baseCurrency: Workspace['baseCurrency']
}

/** "YYYY-MM-DD" בזמן מקומי (לא UTC) - לזיהוי "היום" עקבי עם מה שהמשתמש רואה על השעון שלו. */
function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todaysPnl(trades: Trade[]): number {
  const today = localDateKey(new Date())
  return trades
    .filter((t) => !isTradeOpen(t) && t.exitAt !== null && localDateKey(new Date(t.exitAt)) === today)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0)
}

/**
 * פס סטטיסטיקות עליון, desktop-only ("Wide Console" - קונספט B, ר' progress.md). נדבק
 * מתחת ל-PillNav. מוצג רק דרך media query ב-CSS (לא render-blocking JS) כדי שלא ייטען/יחושב
 * לשווא במובייל - עם זאת התוכן עצמו זול לחישוב (סכומים טהורים על trades שכבר ב-state).
 * 4 ערכים אמיתיים בלבד - אין "Equity"/"Account Size" גלובלי במוצר הזה, לא ממציאים כאלה.
 * הסכומים כאן גולמיים (בלי המרת שער היסטורי כמו ב-Dashboard) - מדויק כשכל הטריידים
 * באותו מטבע (המצב היחיד האפשרי כרגע, ר' LOCK_CURRENCY_TO_USD).
 */
export function DesktopStatBar({ trades, baseCurrency }: DesktopStatBarProps) {
  const { t, locale } = useLanguage()

  const total = totalPnl(trades)
  const today = todaysPnl(trades)
  const wr = winRate(trades)
  const openCount = trades.filter(isTradeOpen).length

  return (
    <div className={`${styles.bar} metal-panel`} aria-hidden={false}>
      <div className={styles.stat}>
        <span className={styles.label}>{t('dashboard.kpiTotalPnl')}</span>
        <span key={total} className={`${styles.value} num value-pop ${total >= 0 ? styles.pos : styles.neg}`}>
          {formatCurrency(total, baseCurrency, locale)}
        </span>
      </div>
      <div className={styles.stat}>
        <span className={styles.label}>{t('desktopStatBar.todayPnl')}</span>
        <span key={today} className={`${styles.value} num value-pop ${today >= 0 ? styles.pos : styles.neg}`}>
          {formatCurrency(today, baseCurrency, locale)}
        </span>
      </div>
      <div className={styles.stat}>
        <span className={styles.label}>{t('dashboard.kpiWinRate')}</span>
        <span key={wr} className={`${styles.value} num value-pop`}>{wr.toFixed(1)}%</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.label}>{t('desktopStatBar.openPositions')}</span>
        <span key={openCount} className={`${styles.value} num value-pop`}>{openCount}</span>
      </div>
    </div>
  )
}
