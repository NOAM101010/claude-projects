import { useLanguage } from '../i18n/LanguageContext'
import { lossSourceBreakdown } from '../lib/stats'
import { formatCurrency } from '../lib/format'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './LossSourceCard.module.css'

interface LossSourceCardProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
  locale: string
}

/**
 * "Where losses come from" - כרטיס insight בכל הדרגות (basic/pro/demo): מתוך טריידים סגורים
 * ומפסידים בלבד, איזה נתח מסך ה-$ שהופסד הגיע מ-long מול short (`lossSourceBreakdown` ב-
 * stats.ts). דורש לפחות 3 טריידים מפסידים *בכל כיוון* לפני שנטענת מסקנה כיוונית - מתחת לזה
 * (feedback: חשבון שסוחר כמעט אך ורק Long ומקבל "100% מ-Long" זו לא תובנה, זו סתם עובדה
 * טריוויאלית) הכרטיס כולו לא מוצג - `null`, לא הודעת "אין מספיק דאטה" (בניגוד לדפוס
 * "אין עדיין" הכן שקיים ב-`TradeOfTheMonthCard` - כאן זה לא "עוד מעט יהיה", זו קביעה
 * שאין כאן בכלל השוואה משמעותית לעשות).
 * כיוון (Long/Short) נשאר תמיד באנגלית בכל שפה - אותה קונבנציה כמו `sideLabel` ב-
 * `BestWorstSpotlight.tsx`/`WeeklyRecapCard.tsx`, לא מפתח `common.long/short` (שכן מתורגם -
 * הקשרים שונים).
 */
export function LossSourceCard({ trades, baseCurrency, locale }: LossSourceCardProps) {
  const { t } = useLanguage()
  const breakdown = lossSourceBreakdown(trades)

  if (!breakdown.sufficientData) return null

  const { longSharePercent, shortSharePercent, longLossAmount, shortLossAmount, dominantDirection } = breakdown

  const verdict =
    dominantDirection === null
      ? t('dashboard.lossSourceNoPattern')
      : t('dashboard.lossSourceVerdict', {
          percent: (dominantDirection === 'long' ? longSharePercent : shortSharePercent).toFixed(0),
          direction: dominantDirection === 'long' ? 'Long' : 'Short',
        })

  return (
    <div className={`${styles.card} metal-panel holo-edge count-in`}>
      <h3 className={styles.title}>{t('dashboard.lossSourceTitle')}</h3>
      <p className={`${styles.verdict} ${dominantDirection !== null ? styles.verdictStrong : ''}`}>{verdict}</p>

      {/* בר דו-כיווני שגדל משני צדי קו מרכז משותף - Long שמאלה, Short ימינה (בפועל: כל צד גדל
          מ-transform-origin בקצה הפנימי שלו, לא מהקצה החיצוני, כדי שהתנועה תיראה "נפתחת
          מהמרכז" ולא "בר רגיל שמתמלא") - מובחן מהבר המדורג הרגיל ב-SetupPerformanceCard. */}
      <div className={styles.diverging} role="img" aria-label={verdict}>
        <div className={styles.divergingTrack}>
          <div className={styles.halfLong}>
            <div className={styles.segLong} style={{ width: `${longSharePercent}%` }} />
          </div>
          <div className={styles.centerLine} />
          <div className={styles.halfShort}>
            <div className={styles.segShort} style={{ width: `${shortSharePercent}%` }} />
          </div>
        </div>
        <div className={styles.divergingLabels}>
          <span className={styles.divergingLabel}>Long · {longSharePercent.toFixed(0)}%</span>
          <span className={styles.divergingLabel}>{shortSharePercent.toFixed(0)}% · Short</span>
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotLong}`} />
          Long · {formatCurrency(-longLossAmount, baseCurrency, locale)} ({longSharePercent.toFixed(0)}%)
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.dot} ${styles.dotShort}`} />
          Short · {formatCurrency(-shortLossAmount, baseCurrency, locale)} ({shortSharePercent.toFixed(0)}%)
        </span>
      </div>
    </div>
  )
}
