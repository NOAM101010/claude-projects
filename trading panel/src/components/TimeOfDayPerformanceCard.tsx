import type { CSSProperties } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import { formatCurrency } from '../lib/format'
import { performanceByHourOfDay } from '../lib/stats'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './TimeOfDayPerformanceCard.module.css'

interface TimeOfDayPerformanceCardProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
  locale: string
  tier: AccountTier
  /** פותח את מודל קוד הגישה (שדרוג) - אותו מנגנון בדיוק כמו `SetupPerformanceCard`. */
  onOpenAccessCode: () => void
}

/** "9:00" מתוך key="9" (שעה מקומית, 0-23) - פורמט תצוגה בלבד, `performanceByHourOfDay` עצמה טהורה. */
function hourLabel(key: string): string {
  return `${key.padStart(2, '0')}:00`
}

/**
 * "Performance by Hour of Day" (Pro, Day Trading בלבד) - פילוח טריידים סגורים לפי שעת כניסה
 * (`performanceByHourOfDay`), אותו דפוס Pro-lock/ריק בדיוק כמו `SetupPerformanceCard`: non-Pro
 * מקבל טיזר מטושטש עם דאטה קבועה, Pro בלי טריידים סגורים מקבל `null` (לא מוצג בכלל - ראה
 * `showTimeOfDay` ב-`Dashboard.tsx`), Pro עם דאטה מקבל בארים מדורגים ממוינים כרונולוגית
 * (לא לפי P&L כמו `SetupPerformanceCard` - סדר שעות קבוע קריא יותר כאן).
 */
export function TimeOfDayPerformanceCard({ trades, baseCurrency, locale, tier, onOpenAccessCode }: TimeOfDayPerformanceCardProps) {
  const { t } = useLanguage()

  if (tier !== 'pro') {
    return (
      <div className={`${styles.card} metal-panel holo-edge holo-edge--amber`}>
        <h3 className={styles.title}>{t('dashboard.timeOfDayTitleLocked')}</h3>
        <div className={styles.lockedTeaser} aria-hidden="true">
          {['9:00', '11:00', '14:00'].map((label, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.rowLabel}>{label}</span>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${styles.barFillPos}`} style={{ width: `${[100, 68, 40][i]}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.upgradeHint}>
          {t('dashboard.timeOfDayLocked')}{' '}
          <button type="button" onClick={onOpenAccessCode}>
            {t('access.enterCode')}
          </button>
        </p>
      </div>
    )
  }

  const rows = performanceByHourOfDay(trades).sort((a, b) => Number(a.key) - Number(b.key))

  if (rows.length === 0) return null

  const maxAbsPnl = Math.max(...rows.map((r) => Math.abs(r.pnl)), 1)

  return (
    <div className={`${styles.card} metal-panel holo-edge count-in`}>
      <h3 className={styles.title}>{t('dashboard.timeOfDayTitle')}</h3>
      <div className={styles.rows}>
        {rows.map((r, i) => {
          const positive = r.pnl >= 0
          const widthPercent = (Math.abs(r.pnl) / maxAbsPnl) * 100
          return (
            <div key={r.key} className={styles.row} style={{ '--row-index': i } as CSSProperties}>
              <div className={styles.rowHeader}>
                <span className={styles.rowLabel}>{hourLabel(r.key)}</span>
                <span className={`${styles.rowPnl} ${positive ? styles.positive : styles.negative}`}>
                  {formatCurrency(r.pnl, baseCurrency, locale)}
                </span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${positive ? styles.barFillPos : styles.barFillNeg}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <span className={styles.rowMeta}>
                {t('dashboard.timeOfDayRowMeta', { trades: r.trades, winRate: r.winRate.toFixed(0) })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
