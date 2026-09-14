import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency, formatDateTime } from '../lib/format'
import { ChartImageThumbnail } from './ChartImageThumbnail'
import type { Trade } from '../types/trade'
import styles from './BestWorstSpotlight.module.css'

interface SpotlightHalfProps {
  label: string
  variant: 'up' | 'down'
  trade: Trade | null
  locale: string
  emptyLabel: string
}

function SpotlightHalf({ label, variant, trade, locale, emptyLabel }: SpotlightHalfProps) {
  if (!trade) {
    return (
      <div className={styles.half}>
        <span className={`det-chip ${variant === 'up' ? 'det-chip--up' : 'det-chip--down'} ${styles.badge}`}>{label}</span>
        <p className={styles.emptyText}>{emptyLabel}</p>
      </div>
    )
  }

  const sideLabel = trade.direction === 'long' ? 'Long' : 'Short'

  return (
    <div className={styles.half}>
      <div className={styles.halfHeader}>
        <span className={`det-chip ${variant === 'up' ? 'det-chip--up' : 'det-chip--down'} ${styles.badge}`}>{label}</span>
        {trade.chartImageUrl && <ChartImageThumbnail path={trade.chartImageUrl} />}
      </div>
      <span className={styles.symbol}>{trade.symbol}</span>
      <span className={`${styles.pnl} ${variant === 'up' ? styles.positive : styles.negative}`}>
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
 * בקו דק.
 */
export function BestWorstSpotlight({ best, worst, locale }: BestWorstSpotlightProps) {
  const { t } = useLanguage()

  return (
    <div className={styles.card}>
      <SpotlightHalf label={t('dashboard.best')} variant="up" trade={best} locale={locale} emptyLabel={t('dashboard.noClosedTrades')} />
      <div className={styles.divider} />
      <SpotlightHalf label={t('dashboard.worst')} variant="down" trade={worst} locale={locale} emptyLabel={t('dashboard.noClosedTrades')} />
    </div>
  )
}
