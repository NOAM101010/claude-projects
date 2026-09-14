import { ExternalLink, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency, formatDateTime } from '../lib/format'
import { bestTrade, totalPnl, winRate, worstTrade } from '../lib/stats'
import { tradingViewUrl } from '../lib/tradingView'
import type { Trade } from '../types/trade'
import styles from './DailyTradingView.module.css'

interface DailyTradingViewProps {
  /** תאריך היום המוצג (רק לתצוגה בכותרת). */
  date: Date
  /** טריידים סגורים שה-exitAt שלהם נופל ביום הזה בלבד - כבר מסונן לפני שמגיע לכאן. */
  dayTrades: Trade[]
  locale: string
  onClose: () => void
  /** פותח את אותו טופס עריכה קיים (App.tsx's `openEditForm`) - אין UI מקבילה כאן. */
  onEditTrade: (trade: Trade) => void
}

/**
 * תצוגת "יום מסחר" - נפתחת בלחיצה על תא יום בלוח השנה (או על צ'יפ Best/Worst Day).
 * מרונדרת דרך portal ישירות ל-document.body, בדיוק כמו ה-lightbox של `ChartImageThumbnail` -
 * `MonthlyCalendar`'s own `.hero`/day cells נושאים את אנימציית הכניסה `count-in`, שמשאירה
 * `transform` לא-none לצמיתות (`animation-fill-mode: both`) והופכת אותם ל-containing block
 * עבור `position:fixed` - בלי portal התצוגה הזו הייתה נלכדת בתוך תא הלוח הקטן.
 */
export function DailyTradingView({ date, dayTrades, locale, onClose, onEditTrade }: DailyTradingViewProps) {
  const { t } = useLanguage()

  const netPnl = totalPnl(dayTrades)
  const wr = winRate(dayTrades)
  const best = bestTrade(dayTrades)
  const worst = worstTrade(dayTrades)
  // עם טרייד יחיד ביום, Win Rate טריוויאלי (0%/100%) ו-Best/Worst הם אותו טרייד בדיוק -
  // אותה תבנית כמו ה-degenerate filter fix ב-TradeList.tsx: מציגים רק Net P&L + Trade Count.
  const hasMultipleTrades = dayTrades.length >= 2
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)

  return createPortal(
    <div className={`${styles.overlay} modal-overlay-in`} role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`${styles.panel} metal-panel holo-edge holo-edge--amber det-frame modal-panel-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <span className="eyebrow">{t('monthlyCalendar.dailyView.title')}</span>
            <h2 className={styles.dateTitle}>{dateLabel}</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('monthlyCalendar.dailyView.close')}>
            <X size={18} />
          </button>
        </div>

        {dayTrades.length === 0 ? (
          <p className={styles.empty}>{t('monthlyCalendar.dailyView.noneClosed')}</p>
        ) : (
          <>
            <div className={styles.summary}>
              <div className={styles.summaryStat}>
                <span className={styles.summaryLabel}>{t('monthlyCalendar.dailyView.netPnl')}</span>
                <span className={`num ${styles.summaryValue} ${netPnl >= 0 ? styles.positive : styles.negative}`}>
                  {formatCurrency(netPnl, dayTrades[0].currency, locale)}
                </span>
              </div>
              <div className={styles.summaryStat}>
                <span className={styles.summaryLabel}>{t('monthlyCalendar.dailyView.tradeCount')}</span>
                <span className={`num ${styles.summaryValue}`}>{dayTrades.length}</span>
              </div>
              {hasMultipleTrades && (
                <div className={styles.summaryStat}>
                  <span className={styles.summaryLabel}>{t('monthlyCalendar.dailyView.winRate')}</span>
                  <span className={`num ${styles.summaryValue}`}>{wr.toFixed(1)}%</span>
                </div>
              )}
              {hasMultipleTrades && best && (
                <div className={styles.summaryStat}>
                  <span className={`det-chip det-chip--up ${styles.summaryChip}`}>{t('monthlyCalendar.dailyView.bestTrade')}</span>
                  <span className={`num ${styles.summaryValue} ${styles.positive}`}>{formatCurrency(best.pnl ?? 0, best.currency, locale)}</span>
                </div>
              )}
              {hasMultipleTrades && worst && (
                <div className={styles.summaryStat}>
                  <span className={`det-chip det-chip--down ${styles.summaryChip}`}>{t('monthlyCalendar.dailyView.worstTrade')}</span>
                  <span className={`num ${styles.summaryValue} ${styles.negative}`}>{formatCurrency(worst.pnl ?? 0, worst.currency, locale)}</span>
                </div>
              )}
            </div>

            <div className={styles.list}>
              {dayTrades.map((trade) => (
                <button type="button" key={trade.id} className={`${styles.row} row-hover`} onClick={() => onEditTrade(trade)}>
                  <a
                    href={tradingViewUrl(trade.symbol)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.rowSymbol}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {trade.symbol}
                    <ExternalLink size={11} className={styles.externalIcon} />
                  </a>
                  <span className={trade.direction === 'long' ? styles.badgeLong : styles.badgeShort}>
                    {trade.direction === 'long' ? t('common.long') : t('common.short')}
                  </span>
                  <span className={styles.rowPrices}>
                    {trade.entryPrice} → {trade.exitPrice ?? '—'}
                  </span>
                  <span className={styles.rowTime}>{formatDateTime(trade.exitAt, locale)}</span>
                  <span className={`${styles.rowPnl} ${(trade.pnl ?? 0) >= 0 ? styles.positive : styles.negative}`}>
                    {formatCurrency(trade.pnl ?? 0, trade.currency, locale)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
