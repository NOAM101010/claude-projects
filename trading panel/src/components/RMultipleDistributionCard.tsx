import type { CSSProperties } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import { rMultipleDistribution } from '../lib/stats'
import type { Trade } from '../types/trade'
import styles from './RMultipleDistributionCard.module.css'

interface RMultipleDistributionCardProps {
  trades: Trade[]
  tier: AccountTier
  /** פותח את מודל קוד הגישה (שדרוג) - אותו מנגנון בדיוק כמו `SetupPerformanceCard`. */
  onOpenAccessCode: () => void
}

/**
 * "R-Multiple Distribution" (Pro, Day Trading בלבד) - היסטוגרמה של `rMultipleDistribution`
 * (טריידים סגורים עם Stop Loss, אותה נוסחת R בדיוק כמו `avgRiskReward`/`liveRMultiple`).
 * אותו דפוס Pro-lock בדיוק כמו `SetupPerformanceCard`: non-Pro מקבל טיזר, Pro בלי אף טרייד
 * שעומד בקריטריונים (כל 7 הדליים ב-0) מקבל `null` - ראה `showRMultipleDistribution` ב-
 * `Dashboard.tsx`. שונה מ-`SetupPerformanceCard`/`TimeOfDayPerformanceCard`: כל 7 הדליים
 * תמיד מוצגים בסדר קבוע (גם עם count=0), הבר מודד *ספירת טריידים* לא $ P&L, ואין צבע
 * חיובי/שלילי לפי סימן - זו התפלגות, לא דירוג ביצועים.
 */
export function RMultipleDistributionCard({ trades, tier, onOpenAccessCode }: RMultipleDistributionCardProps) {
  const { t } = useLanguage()

  if (tier !== 'pro') {
    return (
      <div className={`${styles.card} metal-panel holo-edge holo-edge--amber`}>
        <h3 className={styles.title}>{t('dashboard.rMultipleTitleLocked')}</h3>
        <div className={styles.lockedTeaser} aria-hidden="true">
          {['-1..0R', '0..1R', '1..2R'].map((label, i) => (
            <div key={i} className={styles.row}>
              <span className={styles.rowLabel}>{label}</span>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${styles.barFillPos}`} style={{ width: `${[45, 100, 62][i]}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.upgradeHint}>
          {t('dashboard.rMultipleLocked')}{' '}
          <button type="button" onClick={onOpenAccessCode}>
            {t('access.enterCode')}
          </button>
        </p>
      </div>
    )
  }

  const buckets = rMultipleDistribution(trades)
  const totalCount = buckets.reduce((s, b) => s + b.count, 0)

  if (totalCount === 0) return null

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <div className={`${styles.card} metal-panel holo-edge count-in`}>
      <h3 className={styles.title}>{t('dashboard.rMultipleTitle')}</h3>
      <div className={styles.rows}>
        {buckets.map((b, i) => {
          const widthPercent = (b.count / maxCount) * 100
          const negative = b.bucket.startsWith('<') || b.bucket.startsWith('-')
          return (
            <div key={b.bucket} className={styles.row} style={{ '--row-index': i } as CSSProperties}>
              <div className={styles.rowHeader}>
                <span className={styles.rowLabel}>{b.bucket}</span>
                <span className={styles.rowPnl}>{t('dashboard.rMultipleRowMeta', { count: b.count })}</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${negative ? styles.barFillNeg : styles.barFillPos}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
