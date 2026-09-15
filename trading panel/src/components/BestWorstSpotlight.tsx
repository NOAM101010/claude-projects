import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency, formatDateTime } from '../lib/format'
import { ChartImageThumbnail } from './ChartImageThumbnail'
import type { Trade } from '../types/trade'
import styles from './BestWorstSpotlight.module.css'

interface SpotlightHalfProps {
  label: string
  trade: Trade | null
  locale: string
  emptyLabel: string
}

/** הצבע נגזר תמיד מהסימן האמיתי של ה-pnl של הטרייד, לא מ"איזה חצי זה" (best/worst) - טרייד
 * "הכי גרוע" בתקופה יכול עדיין להיות רווחי (pnl >= 0) ואז הוא ירוק, לא אדום. */
function SpotlightHalf({ label, trade, locale, emptyLabel }: SpotlightHalfProps) {
  if (!trade) {
    return (
      <div className={`${styles.half} ${styles.halfDown}`}>
        <span className={`det-chip det-chip--down ${styles.badge}`}>{label}</span>
        <p className={styles.emptyText}>{emptyLabel}</p>
      </div>
    )
  }

  const isPositive = (trade.pnl ?? 0) >= 0
  const tileClass = isPositive ? styles.halfUp : styles.halfDown
  const sideLabel = trade.direction === 'long' ? 'Long' : 'Short'

  return (
    <div className={`${styles.half} ${tileClass}`}>
      <div className={styles.halfHeader}>
        <span className={`det-chip ${isPositive ? 'det-chip--up' : 'det-chip--down'} ${styles.badge}`}>{label}</span>
        {trade.chartImageUrl && <ChartImageThumbnail path={trade.chartImageUrl} />}
      </div>
      <span className={styles.symbol}>{trade.symbol}</span>
      <span className={`${styles.pnl} ${isPositive ? styles.positive : styles.negative}`}>
        {trade.pnl !== null ? formatCurrency(trade.pnl, trade.currency, locale) : '—'}
      </span>
      <span className={styles.meta}>
        {sideLabel} · {formatDateTime(trade.entryAt, locale)} → {formatDateTime(trade.exitAt, locale)}
      </span>
    </div>
  )
}

interface BestWorstSpotlightProps {
  best: Trade | null
  worst: Trade | null
  locale: string
}

/**
 * שדרוג ויזואלי לכרטיס Best/Worst הקיים ב-Dashboard (הלוגיקה כבר קיימת ב-`bestTrade()`/
 * `worstTrade()` ב-stats.ts) - כרטיס "spotlight" בולט, best למעלה worst למטה, מופרדים
 * בקו דק. כשיש רק טרייד סגור אחד בתקופה, best/worst הם אותו טרייד בדיוק (אותו `id`) -
 * מציגים אריח בודד ("Only closed trade") במקום שני אריחים זהים זה מתחת לזה.
 */
export function BestWorstSpotlight({ best, worst, locale }: BestWorstSpotlightProps) {
  const { t } = useLanguage()

  if (best && worst && best.id === worst.id) {
    return (
      <div className={styles.card}>
        <SpotlightHalf label={t('dashboard.onlyClosedTrade')} trade={best} locale={locale} emptyLabel={t('dashboard.noClosedTrades')} />
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <SpotlightHalf label={t('dashboard.best')} trade={best} locale={locale} emptyLabel={t('dashboard.noClosedTrades')} />
      <div className={styles.divider} />
      <SpotlightHalf label={t('dashboard.worst')} trade={worst} locale={locale} emptyLabel={t('dashboard.noClosedTrades')} />
    </div>
  )
}
