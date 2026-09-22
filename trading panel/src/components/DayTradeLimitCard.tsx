import { useLanguage } from '../i18n/LanguageContext'
import { dayTradeLimitUsage } from '../lib/stats'
import type { Trade } from '../types/trade'
import styles from './DayTradeLimitCard.module.css'

interface DayTradeLimitCardProps {
  trades: Trade[]
  /** לא-null בכל מקום שהכרטיס בפועל מוצג - `Dashboard.tsx` כבר מוודא `maxTradesPerDay !== null`
   * לפני שהוא מרנדר את הכרטיס הזה בכלל (ראה `showDayTradeLimit`). */
  maxTradesPerDay: number
}

/**
 * "מגבלת טריידים ביום" (Day Trading בלבד, חינם לכולם - special-design round, כיוון
 * "נקודות מצטברות" ב-`card-day-trade-limit.html`) - נקודה אחת לכל טרייד מותר, מתמלאת
 * ככל שנפתחים טריידים היום. אותו דפוס בדיוק כמו `DailyRiskBudgetCard`: לא Pro-gated,
 * ממוקם ב-Dashboard בנפרד מ-`.insightsGrid` (כלי ניהול-סיכון בזמן-אמת, לא כרטיס תובנה).
 */
export function DayTradeLimitCard({ trades, maxTradesPerDay }: DayTradeLimitCardProps) {
  const { t } = useLanguage()
  const { tradesOpenedToday, limitReached } = dayTradeLimitUsage(trades, maxTradesPerDay)
  const remaining = Math.max(0, maxTradesPerDay - tradesOpenedToday)
  const dots = Array.from({ length: maxTradesPerDay }, (_, i) => i < tradesOpenedToday)

  return (
    <div className={`${styles.card} metal-panel holo-edge ${limitReached ? 'holo-edge--amber' : ''} count-in`}>
      <h3 className={styles.title}>{t('dashboard.dayTradeLimitTitle')}</h3>
      <div className={styles.dots}>
        {dots.map((filled, i) => {
          const isLastFilled = filled && i === tradesOpenedToday - 1
          return (
            <span
              key={i}
              className={`${styles.dot} ${filled ? styles.dotFilled : ''} ${isLastFilled && limitReached ? styles.dotDanger : ''}`}
            />
          )
        })}
      </div>
      <span className={styles.meta}>
        {limitReached
          ? t('dashboard.dayTradeLimitReached')
          : t('dashboard.dayTradeLimitRemaining', { opened: tradesOpenedToday, remaining })}
      </span>
    </div>
  )
}
