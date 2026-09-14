import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
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
}

export function TradeList({ trades, filter, onClearFilter, onAdd, onEdit, onDelete }: TradeListProps) {
  const { t, locale } = useLanguage()
  const filtered = filter
    ? trades.filter((trade) => (filter.type === 'symbol' ? trade.symbol === filter.value : (trade.setup ?? 'ללא הגדרה') === filter.value))
    : trades
  const sorted = filtered.slice().sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime())
  const maxPositionValue = sorted.reduce((max, trade) => Math.max(max, trade.entryPrice * trade.quantity), 0)

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

      {sorted.length === 0 ? (
        <p className={styles.empty}>{filter ? t('tradeList.emptyFiltered') : t('tradeList.emptyAll')}</p>
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
                  <th className="num">{t('tradeList.columnPnl')}</th>
                  <th>{t('tradeList.columnDate')}</th>
                  <th>{t('tradeList.columnSize')}</th>
                  <th>{t('tradeList.columnActions')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((trade) => {
                  const sizePercent = maxPositionValue > 0 ? ((trade.entryPrice * trade.quantity) / maxPositionValue) * 100 : 0
                  const rowAccent = trade.pnl === null ? styles.rowNeutral : trade.pnl > 0 ? styles.rowPositive : trade.pnl < 0 ? styles.rowNegative : styles.rowNeutral
                  return (
                    <tr className={`${styles.row} ${rowAccent} row-hover count-in`} key={trade.id}>
                      <td className={styles.symbol}>{trade.symbol}</td>
                      <td>
                        <span className={trade.direction === 'long' ? styles.badgeLong : styles.badgeShort}>
                          {trade.direction === 'long' ? 'Long' : 'Short'}
                        </span>
                      </td>
                      <td className={`num ${styles.mono}`}>{trade.entryPrice}</td>
                      <td className={`num ${styles.mono}`}>{trade.exitPrice ?? '—'}</td>
                      <td className="num">
                        {trade.pnl === null ? (
                          <span className={styles.pnlOpen}>{t('common.open')}</span>
                        ) : (
                          <span className={`${styles.pnl} ${trade.pnl >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                            {formatCurrency(trade.pnl, trade.currency, locale)}
                          </span>
                        )}
                      </td>
                      <td className={styles.mono}>{formatDate(trade.entryAt, locale)}</td>
                      <td>
                        <div className={styles.sizeTrack}>
                          <div
                            className={`${styles.sizeFill} ${
                              trade.pnl === null ? styles.sizeNeutral : trade.pnl >= 0 ? styles.sizePositive : styles.sizeNegative
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
                          <button type="button" className={styles.deleteButton} onClick={() => onDelete(trade.id)}>
                            {t('common.delete')}
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
                  <span className={styles.symbol}>{trade.symbol}</span>
                  <span className={trade.direction === 'long' ? styles.badgeLong : styles.badgeShort}>
                    {trade.direction === 'long' ? 'Long' : 'Short'}
                  </span>
                </div>
                {trade.pnl === null ? (
                  <span className={styles.pnlOpen}>{t('common.open')}</span>
                ) : (
                  <span className={`${styles.pnl} ${trade.pnl >= 0 ? styles.pnlPositive : styles.pnlNegative}`}>
                    {formatCurrency(trade.pnl, trade.currency, locale)}
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
                <button type="button" className={styles.deleteButton} onClick={() => onDelete(trade.id)}>
                  {t('common.delete')}
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
