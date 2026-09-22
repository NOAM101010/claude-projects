import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency } from '../lib/format'
import { dailyRiskBudgetUsage } from '../lib/stats'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './DailyRiskBudgetCard.module.css'

interface DailyRiskBudgetCardProps {
  trades: Trade[]
  /** לא-null בכל מקום שהכרטיס בפועל מוצג - `Dashboard.tsx` כבר מוודא `dailyRiskBudget !== null`
   * לפני שהוא מרנדר את הכרטיס הזה בכלל (ראה `showDailyRiskBudget`). */
  dailyRiskBudget: number
  baseCurrency: CurrencyCode
  locale: string
}

/**
 * "תקציב סיכון יומי" (Day Trading בלבד, חינם לכולם - robust-munching-puffin.md סבב C2) -
 * P&L נטו של טריידים שנסגרו היום מול התקציב שהוגדר ב-Settings (`dailyRiskBudgetUsage`).
 * לא Pro-gated: בניגוד ל-Setup Performance/Time of Day/R-Multiple (כרטיסי "תובנה" על
 * היסטוריה), זה כלי ניהול-סיכון בזמן-אמת - ממוקם ב-Dashboard בנפרד מ-`.insightsGrid`.
 */
export function DailyRiskBudgetCard({ trades, dailyRiskBudget, baseCurrency, locale }: DailyRiskBudgetCardProps) {
  const { t } = useLanguage()
  const { netPnlToday, budgetUsedPercent } = dailyRiskBudgetUsage(trades, dailyRiskBudget)
  const overBudget = budgetUsedPercent >= 100

  return (
    <div className={`${styles.card} metal-panel holo-edge ${overBudget ? 'holo-edge--amber' : ''} count-in`}>
      <h3 className={styles.title}>{t('dashboard.dailyRiskBudgetTitle')}</h3>
      <div className={styles.topRow}>
        <span className={`${styles.pnl} ${netPnlToday >= 0 ? styles.positive : styles.negative}`}>
          {formatCurrency(netPnlToday, baseCurrency, locale)}
        </span>
        <span className={styles.budgetLabel}>
          {t('dashboard.dailyRiskBudgetOf', { budget: formatCurrency(dailyRiskBudget, baseCurrency, locale) })}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${overBudget ? styles.barFillDanger : ''}`} style={{ width: `${budgetUsedPercent}%` }} />
      </div>
      <span className={styles.meta}>{t('dashboard.dailyRiskBudgetUsedPercent', { percent: budgetUsedPercent.toFixed(0) })}</span>
    </div>
  )
}
