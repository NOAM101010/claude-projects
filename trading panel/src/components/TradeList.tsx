import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
import { isTradeOpen, profitFactor, totalPnl, winRate } from '../lib/stats'
import { tradingViewUrl } from '../lib/tradingView'
import { DEFAULT_TRADE_FILTERS, filterTrades, hasActiveFilters, type DateRangePreset, type DirectionFilter, type TradeFiltersState, type TypeFilter } from '../lib/tradeFilters'
import type { Trade } from '../types/trade'
import type { TradeFilter } from '../App'
import { ChartImageThumbnail } from './ChartImageThumbnail'
import styles from './TradeList.module.css'

interface TradeListProps {
  trades: Trade[]
  filter?: TradeFilter | null
  onClearFilter?: () => void
  onAdd: () => void
  onEdit: (trade: Trade) => void
  onDelete: (id: string) => void
  /** בעלות המצב הועברה ל-`Journal.tsx` (ולא `useState` מקומי כאן) כדי שהחיפוש/פילטרים
   * ישרדו מעבר בין תת-טאבים (Trades/Dashboard/Positions) - `TradeList` נכנס/יוצא מה-DOM
   * בכל מעבר כזה (ראה `Journal.tsx`), אז state מקומי כאן היה מתאפס בכל חזרה ל-Trades. */
  advFilters: TradeFiltersState
  setAdvFilters: Dispatch<SetStateAction<TradeFiltersState>>
}

const DATE_PRESETS: DateRangePreset[] = ['all', 'today', 'thisWeek', 'thisMonth', 'last3Months', 'thisYear', 'custom']
/** זמן שבו כפתור המחיקה נשאר במצב "לאשר?" לפני שחוזר אוטומטית למצב הרגיל. */
const DELETE_CONFIRM_TIMEOUT_MS = 4000

/**
 * מיני-spark-line של שורת טרייד סגור: קו ישר יחיד בין 2 הנקודות האמיתיות היחידות
 * שקיימות לטרייד - מחיר כניסה ומחיר יציאה (אין היסטוריית מחיר בין לבין, אז אין
 * כאן שום נקודת ביניים מומצאת). המיקום האנכי מקודד רק כיוון (עלה/ירד), לא גודל
 * שינוי מדויק - אין למה להשוות אחוזי-שינוי בין שורות בקנה מידה משותף כשהערך
 * המספרי המדויק כבר מוצג בעמודת P&L. לטריידים פתוחים (אין exit) אין spark-line
 * בכלל - ראו קריאה למטה.
 */
function TradeSpark({ entry, exit }: { entry: number; exit: number }) {
  const w = 60
  const h = 20
  const up = exit >= entry
  const y1 = up ? h - 3 : 3
  const y2 = up ? 3 : h - 3
  return (
    <svg
      className={`${styles.spark} ${up ? styles.sparkUp : styles.sparkDown}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1={2} y1={y1} x2={w - 2} y2={y2} />
    </svg>
  )
}

export function TradeList({ trades, filter, onClearFilter, onAdd, onEdit, onDelete, advFilters, setAdvFilters }: TradeListProps) {
  const { t, locale } = useLanguage()
  // מחיקה דורשת אישור-לחיצה-שנייה קלה (לא ה-2-שלבים הכבד של Clear Trading Data - זה טרייד
  // בודד והפיך דרך ה-Undo toast ב-App.tsx). לחיצה שנייה על אותה שורה תוך `DELETE_CONFIRM_TIMEOUT_MS`
  // מבצעת בפועל; אחרת חוזר למצב רגיל. שורה אחת בלבד יכולה להיות במצב אישור בו-זמנית.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const confirmTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current)
    }
  }, [])

  const requestDelete = (id: string) => {
    if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current)
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      onDelete(id)
    } else {
      setConfirmingDeleteId(id)
      confirmTimerRef.current = window.setTimeout(() => setConfirmingDeleteId(null), DELETE_CONFIRM_TIMEOUT_MS)
    }
  }

  // הפילטר הקיים (קליק על סימבול/setup מה-Dashboard) הוא שכבה נפרדת שמצטמצמת קודם;
  // הפילטרים המתקדמים החדשים (חיפוש/סוג/כיוון/תאריך) פועלים בנוסף (AND), לא במקומו.
  const preFiltered = filter
    ? trades.filter((trade) => (filter.type === 'symbol' ? trade.symbol === filter.value : (trade.setup ?? 'No setup') === filter.value))
    : trades

  const filtered = useMemo(() => filterTrades(preFiltered, advFilters), [preFiltered, advFilters])
  const sorted = useMemo(
    () => filtered.slice().sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime()),
    [filtered],
  )
  const maxPositionValue = sorted.reduce((max, trade) => Math.max(max, trade.entryPrice * trade.quantity), 0)

  const closedFiltered = useMemo(() => filtered.filter((t) => !isTradeOpen(t)), [filtered])
  const avgTrade = closedFiltered.length > 0 ? totalPnl(closedFiltered) / closedFiltered.length : 0
  const summaryPf = profitFactor(filtered)
  const summaryCurrency = filtered[0]?.currency ?? 'USD'
  // ה-Win Rate/Profit Factor הופכים חסרי-משמעות (100%/∞ או 0%/0) כשהפילטר כבר מצמצם
  // לטריידים מרוויחים/מפסידים בלבד - במקרה הזה מציגים Total Trades/Avg Trade במקומם.
  const isDegenerateTypeFilter = advFilters.type === 'winning' || advFilters.type === 'losing'

  const advActive = hasActiveFilters(advFilters)

  function updateFilters(patch: Partial<TradeFiltersState>) {
    setAdvFilters((prev) => ({ ...prev, ...patch }))
  }

  function clearAdvFilters() {
    setAdvFilters(DEFAULT_TRADE_FILTERS)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2>{t('nav.trades')}</h2>
        <button type="button" className={styles.addButton} onClick={onAdd}>
          {t('tradeList.addButton')}
        </button>
      </div>

      {filter && (
        <div className={styles.filterBanner}>
          <span>
            {t('tradeList.filteredByLabel', { type: filter.type === 'symbol' ? t('common.symbol') : t('common.setup') })}{' '}
            <strong>{filter.value}</strong>
          </span>
          <button type="button" onClick={onClearFilter}>
            {t('tradeList.clearFilter')}
          </button>
        </div>
      )}

      <div className={`${styles.filterBar} metal-panel`}>
        <div className={styles.filterRow}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('tradeList.filters.searchPlaceholder')}
            value={advFilters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
          />

          <div className={styles.segmented}>
            {(['all', 'winning', 'losing', 'open'] as TypeFilter[]).map((type) => (
              <button
                key={type}
                type="button"
                data-active={advFilters.type === type}
                onClick={() => updateFilters({ type })}
              >
                {t(`tradeList.filters.type.${type}` as const)}
              </button>
            ))}
          </div>

          <div className={styles.segmented}>
            {(['all', 'long', 'short'] as DirectionFilter[]).map((direction) => (
              <button
                key={direction}
                type="button"
                data-active={advFilters.direction === direction}
                onClick={() => updateFilters({ direction })}
              >
                {t(`tradeList.filters.direction.${direction}` as const)}
              </button>
            ))}
          </div>

          <select
            className={styles.dateSelect}
            value={advFilters.datePreset}
            onChange={(e) => updateFilters({ datePreset: e.target.value as DateRangePreset })}
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {t(`tradeList.filters.date.${preset}` as const)}
              </option>
            ))}
          </select>

          {advActive && (
            <button type="button" className={styles.clearFiltersButton} onClick={clearAdvFilters}>
              {t('tradeList.filters.clearAll')}
            </button>
          )}
        </div>

        {advFilters.datePreset === 'custom' && (
          <div className={styles.customRangeRow}>
            <label>
              {t('tradeList.filters.fromLabel')}
              <input type="date" value={advFilters.customFrom} onChange={(e) => updateFilters({ customFrom: e.target.value })} />
            </label>
            <label>
              {t('tradeList.filters.toLabel')}
              <input type="date" value={advFilters.customTo} onChange={(e) => updateFilters({ customTo: e.target.value })} />
            </label>
          </div>
        )}

        <p className={styles.resultCount}>
          {sorted.length === 0 ? t('tradeList.filters.noResults') : t('tradeList.filters.resultCount', { count: sorted.length })}
        </p>
      </div>

      {sorted.length > 0 && (
        <div className={styles.summaryStrip} data-count={isDegenerateTypeFilter ? 3 : 4}>
          {!isDegenerateTypeFilter && (
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>{t('tradeList.filters.summaryWinRate')}</span>
              <span className={styles.summaryValue}>{winRate(filtered).toFixed(1)}%</span>
            </div>
          )}
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>{t('tradeList.filters.summaryNetPnl')}</span>
            <span className={`${styles.summaryValue} ${totalPnl(filtered) >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
              {formatCurrency(totalPnl(filtered), summaryCurrency, locale)}
            </span>
          </div>
          {isDegenerateTypeFilter ? (
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>{t('tradeList.filters.summaryTotalTrades')}</span>
              <span className={styles.summaryValue}>{filtered.length}</span>
            </div>
          ) : (
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>{t('tradeList.filters.summaryProfitFactor')}</span>
              <span className={styles.summaryValue}>{summaryPf === null ? '∞' : summaryPf.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>{t('tradeList.filters.summaryAvgTrade')}</span>
            <span className={`${styles.summaryValue} ${avgTrade >= 0 ? styles.summaryPositive : styles.summaryNegative}`}>
              {formatCurrency(avgTrade, summaryCurrency, locale)}
            </span>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{filter || advActive ? t('tradeList.emptyFiltered') : t('tradeList.emptyAll')}</p>
          <p className={styles.emptyHint}>{filter || advActive ? t('tradeList.emptyFilteredHint') : t('tradeList.emptyAllHint')}</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('tradeList.columnSymbol')}</th>
                  <th>{t('tradeList.columnSide')}</th>
                  <th className="num">{t('tradeList.columnEntry')}</th>
                  <th className="num">{t('tradeList.columnExit')}</th>
                  <th>{t('tradeList.columnTrend')}</th>
                  <th className="num">{t('tradeList.columnPnl')}</th>
                  <th>{t('tradeList.columnDate')}</th>
                  <th>{t('tradeList.columnSize')}</th>
                  <th>{t('tradeList.columnActions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((trade) => {
                  const sizePercent = maxPositionValue > 0 ? ((trade.entryPrice * trade.quantity) / maxPositionValue) * 100 : 0
                  const rowAccent = isTradeOpen(trade)
                    ? styles.rowNeutral
                    : (trade.pnl ?? 0) > 0
                      ? styles.rowPositive
                      : (trade.pnl ?? 0) < 0
                        ? styles.rowNegative
                        : styles.rowNeutral
                  // תג "LIVE" מסומן על כל טרייד פתוח (לא רק שורה 0) - מבוסס מצב הטרייד
                  // ולא על מיקום בתצוגה הממוינת/מסוננת.
                  const isFreshest = isTradeOpen(trade)
                  return (
                    <tr className={`${styles.row} ${rowAccent} ${isFreshest ? styles.rowFresh : ''} row-hover count-in`} key={trade.id}>
                      <td className={styles.symbol}>
                        <div className={styles.symbolCell}>
                          <a href={tradingViewUrl(trade.symbol)} target="_blank" rel="noopener noreferrer" className={styles.symbolLink}>
                            {trade.symbol}
                            <ExternalLink size={11} className={styles.externalIcon} />
                          </a>
                          {trade.chartImageUrl && <ChartImageThumbnail path={trade.chartImageUrl} variant="icon" />}
                          {isFreshest && <span className={styles.freshChip}>{t('tradeList.freshBadge')}</span>}
                        </div>
                      </td>
                      <td>
                        <span className={trade.direction === 'long' ? styles.badgeLong : styles.badgeShort}>
                          {trade.direction === 'long' ? 'Long' : 'Short'}
                        </span>
                      </td>
                      <td className={`num ${styles.mono}`}>{trade.entryPrice}</td>
                      <td className={`num ${styles.mono}`}>{trade.exitPrice ?? '—'}</td>
                      <td>
                        {trade.exitPrice !== null ? (
                          <TradeSpark entry={trade.entryPrice} exit={trade.exitPrice} />
                        ) : (
                          <span className={styles.mono}>—</span>
                        )}
                      </td>
                      <td className="num">
                        {isTradeOpen(trade) ? (
                          <span className={styles.pnlOpen}>{t('common.open')}</span>
                        ) : (
                          <span className={`${styles.pnl} ${(trade.pnl ?? 0) >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                            {formatCurrency(trade.pnl ?? 0, trade.currency, locale)}
                          </span>
                        )}
                      </td>
                      <td className={styles.mono}>{formatDate(trade.entryAt, locale)}</td>
                      <td>
                        <div className={styles.sizeTrack}>
                          <div
                            className={`${styles.sizeFill} ${
                              isTradeOpen(trade) ? styles.sizeNeutral : (trade.pnl ?? 0) >= 0 ? styles.sizePositive : styles.sizeNegative
                            }`}
                            style={{ width: `${sizePercent}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" onClick={() => onEdit(trade)}>
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className={`${styles.deleteButton} ${confirmingDeleteId === trade.id ? styles.deleteButtonConfirm : ''}`}
                            onClick={() => requestDelete(trade.id)}
                          >
                            {confirmingDeleteId === trade.id ? t('common.confirmDelete') : t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
          {sorted.map((trade) => (
            <div className={`${styles.card} metal-panel holo-edge det-frame row-hover count-in`} key={trade.id}>
              <div className={styles.cardTop}>
                <div className={styles.symbolGroup}>
                  <a href={tradingViewUrl(trade.symbol)} target="_blank" rel="noopener noreferrer" className={`${styles.symbol} ${styles.symbolLink}`}>
                    {trade.symbol}
                    <ExternalLink size={12} className={styles.externalIcon} />
                  </a>
                  <span className={trade.direction === 'long' ? styles.badgeLong : styles.badgeShort}>
                    {trade.direction === 'long' ? 'Long' : 'Short'}
                  </span>
                </div>
                {isTradeOpen(trade) ? (
                  <span className={styles.pnlOpen}>{t('common.open')}</span>
                ) : (
                  <span className={`${styles.pnl} ${(trade.pnl ?? 0) >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                    {formatCurrency(trade.pnl ?? 0, trade.currency, locale)}
                  </span>
                )}
              </div>

              <div className={styles.body}>
                {trade.chartImageUrl && <ChartImageThumbnail path={trade.chartImageUrl} />}
                <div className={styles.meta}>
                  <span>{t('tradeList.entryLabel', { value: `${formatDateTime(trade.entryAt, locale)} @ ${trade.entryPrice}` })}</span>
                  <span>
                    {t('tradeList.exitLabel', {
                      value: trade.exitAt ? `${formatDateTime(trade.exitAt, locale)} @ ${trade.exitPrice}` : '—',
                    })}
                  </span>
                  <span>{t('tradeList.quantityLabel', { value: trade.quantity })}</span>
                  {trade.stopLoss !== null && <span>{t('tradeList.slLabel', { value: trade.stopLoss })}</span>}
                  {trade.takeProfit !== null && <span>{t('tradeList.tpLabel', { value: trade.takeProfit })}</span>}
                </div>
              </div>

              {trade.notes && <p className={styles.notes}>{trade.notes}</p>}

              <div className={styles.cardActions}>
                <button type="button" onClick={() => onEdit(trade)}>
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className={`${styles.deleteButton} ${confirmingDeleteId === trade.id ? styles.deleteButtonConfirm : ''}`}
                  onClick={() => requestDelete(trade.id)}
                >
                  {confirmingDeleteId === trade.id ? t('common.confirmDelete') : t('common.delete')}
                </button>
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  )
}
