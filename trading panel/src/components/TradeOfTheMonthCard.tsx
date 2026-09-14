import { useMemo, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { tradeOfTheMonth } from '../lib/stats'
import { formatCurrency } from '../lib/format'
import { shareOrDownloadCanvas } from '../lib/canvasExport'
import { renderTradeCardToCanvas } from '../lib/tradeCardCanvas'
import type { Trade } from '../types/trade'
import styles from './TradeOfTheMonthCard.module.css'

interface TradeOfTheMonthCardProps {
  /** טריידים כבר-מומרים למטבע הבסיס (כמו ש-Dashboard מזין ל-bestTrade/worstTrade). */
  trades: Trade[]
  locale: string
  /**
   * "עכשיו" הנגזר לצורך קביעת החודש - ברירת המחדל (לא מוזן, Dashboard) היא today האמיתי.
   * `MonthlyCalendar` מזין כאן את החודש שמנווטים אליו כרגע (`cursor`), כדי ש"טרייד החודש"
   * המוצג יתעדכן בהתאם לחודש הנצפה בלוח, לא יישאר תקוע על החודש האמיתי.
   */
  referenceDate?: Date
  /**
   * גרסה מצומצמת לשורה אחת - בלי גרף SVG רקע, בלי מפריד/שורת meta - משמשת בתוך
   * `MonthlyCalendar` ששביר לגובה מסך יחיד (עוצב לצילום, אסור גלילה).
   */
  compact?: boolean
}

/** אחוז שינוי אמיתי לפי כיוון הטרייד - long: (exit-entry)/entry, short: (entry-exit)/entry. */
function pctChange(trade: Trade): number {
  if (trade.exitPrice === null) return 0
  const diff = trade.direction === 'long' ? trade.exitPrice - trade.entryPrice : trade.entryPrice - trade.exitPrice
  return trade.entryPrice === 0 ? 0 : (diff / trade.entryPrice) * 100
}

function holdDays(trade: Trade): number {
  if (!trade.exitAt) return 0
  return Math.max(0, Math.round((new Date(trade.exitAt).getTime() - new Date(trade.entryAt).getTime()) / 86_400_000))
}

/**
 * "Trade of the Month": הטרייד הכי טוב שנסגר בחודש הקלנדרי הנוכחי (מתחדש כל חודש -
 * ר' `tradeOfTheMonth` ב-stats.ts). מציג תצוגה מקדימה אמיתית בתוך האפליקציה + כפתור
 * שיתוף שמייצא PNG 9:16 מזהה בתוכן (ר' `renderTradeCardToCanvas`). לעולם לא מציג
 * גודל חשבון/יתרה כוללת - רק נתוני הטרייד הבודד.
 */
export function TradeOfTheMonthCard({ trades, locale, referenceDate, compact = false }: TradeOfTheMonthCardProps) {
  const { t } = useLanguage()
  const [sharing, setSharing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const result = useMemo(() => tradeOfTheMonth(trades, referenceDate), [trades, referenceDate])
  // "Trade of the Month" is a share-worthy highlight, not a raw stat - the best/worst
  // widget already shows the true best trade even when it's a loss. Framing a losing
  // trade as this month's "best" would read as celebrating a loss, so this card only
  // ever shows a real winner; otherwise it says so plainly instead of forcing one.
  const hasWinner = result !== null && (result.trade.pnl ?? 0) > 0

  if (!result || !hasWinner) {
    const emptyText = result
      ? t('dashboard.tradeOfTheMonthNoWinnerYet', {
          symbol: result.trade.symbol,
          pnl: formatCurrency(result.trade.pnl ?? 0, result.trade.currency, locale),
        })
      : t('dashboard.tradeOfTheMonthEmpty')

    if (compact) {
      return (
        <div className={`${styles.compactSection} metal-panel holo-edge`}>
          <span className="eyebrow">{t('dashboard.tradeOfTheMonthTitle')}</span>
          <span className={styles.compactEmptyText}>{emptyText}</span>
        </div>
      )
    }

    return (
      <div className={`${styles.section} metal-panel holo-edge`}>
        <h3 className="eyebrow">{t('dashboard.tradeOfTheMonthTitle')}</h3>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{emptyText}</p>
          <p className={styles.emptyHint}>{t('dashboard.tradeOfTheMonthEmptyHint')}</p>
        </div>
      </div>
    )
  }

  const { trade, closedCountInMonth } = result
  const positive = (trade.pnl ?? 0) >= 0
  const pct = pctChange(trade)
  const days = holdDays(trade)
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(trade.exitAt as string))
  const sideLabel = trade.direction === 'long' ? 'Long' : 'Short'
  const metaLabel = `${t('dashboard.tradeOfTheMonthHoldDays', { count: days })} · ${t('dashboard.tradeOfTheMonthSizeLabel')} ${trade.quantity}`
  const pnlLabel = trade.pnl !== null ? formatCurrency(trade.pnl, trade.currency, locale) : '—'
  const pctLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  const bestOfLabel = t('dashboard.tradeOfTheMonthBestOf', { count: closedCountInMonth })

  // גרף רקע: שתי נקודות בלבד - כניסה ויציאה - מנורמלות ל-0..100.
  const entry = trade.entryPrice
  const exit = trade.exitPrice ?? trade.entryPrice
  const min = Math.min(entry, exit)
  const max = Math.max(entry, exit)
  const range = max - min || 1
  const yFor = (v: number) => 80 - ((v - min) / range) * 60

  const handleShare = async () => {
    setSharing(true)
    try {
      const canvas = canvasRef.current ?? document.createElement('canvas')
      renderTradeCardToCanvas(canvas, {
        symbol: trade.symbol,
        pnlLabel,
        pnlPositive: positive,
        pctLabel,
        monthLabel,
        bestOfLabel,
        sideLabel,
        metaLabel,
        entryPrice: entry,
        exitPrice: exit,
      })
      await shareOrDownloadCanvas(canvas, `${trade.symbol}-trade-of-the-month.png`, t('dashboard.tradeOfTheMonthTitle'))
    } finally {
      setSharing(false)
    }
  }

  if (compact) {
    return (
      <div className={`${styles.compactSection} metal-panel holo-edge holo-edge--amber count-in`}>
        <span className="eyebrow">{t('dashboard.tradeOfTheMonthTitle')}</span>
        <div className={styles.compactRow}>
          <span className={styles.compactSymbol}>{trade.symbol}</span>
          <span className={`${styles.compactPnl} ${positive ? styles.positive : styles.negative}`}>{pnlLabel}</span>
          <span className={`${styles.compactPct} ${positive ? styles.positive : styles.negative}`}>{pctLabel}</span>
          <span className={styles.compactBestOf}>{bestOfLabel}</span>
          <button
            type="button"
            className={`${styles.compactShareButton} btn-metal`}
            onClick={handleShare}
            disabled={sharing}
            aria-label={t('common.share')}
          >
            <Share2 size={13} />
          </button>
        </div>
        <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className={`${styles.section} metal-panel holo-edge holo-edge--amber count-in`}>
      <div className={styles.header}>
        <h3 className="eyebrow">{t('dashboard.tradeOfTheMonthTitle')}</h3>
        <button type="button" className={`${styles.shareButton} btn-metal`} onClick={handleShare} disabled={sharing}>
          <Share2 size={14} />
          {t('common.share')}
        </button>
      </div>

      <div className={`${styles.card} glass`}>
        <svg className={styles.chart} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="8" y1={yFor(entry)} x2="92" y2={yFor(exit)} className={positive ? styles.chartLinePos : styles.chartLineNeg} />
          <circle cx="8" cy={yFor(entry)} r="2" className={positive ? styles.chartDotPos : styles.chartDotNeg} />
          <circle cx="92" cy={yFor(exit)} r="2" className={positive ? styles.chartDotPos : styles.chartDotNeg} />
        </svg>

        <span className={styles.month}>{monthLabel}</span>
        <span className={styles.symbol}>{trade.symbol}</span>
        <span className={`${styles.pnl} ${positive ? styles.positive : styles.negative}`}>{pnlLabel}</span>
        <span className={`${styles.pct} ${positive ? styles.positive : styles.negative}`}>{pctLabel}</span>
        <span className={styles.bestOf}>{bestOfLabel}</span>
        <div className={styles.divider} />
        <span className={styles.meta}>
          {sideLabel} · {metaLabel}
        </span>
      </div>

      <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />
    </div>
  )
}
