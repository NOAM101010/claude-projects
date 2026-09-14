import { Clock, ExternalLink, Radar } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { formatCurrency, formatDuration } from '../lib/format'
import { computeLivePnl, liveRMultiple, slTpProgress } from '../lib/livePnl'
import { LIVE_PRICE_REFRESH_MS, fetchOpenPositionPrices, type OpenPositionQuote } from '../lib/marketData'
import { tradingViewUrl } from '../lib/tradingView'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './OpenPositions.module.css'

interface OpenPositionsProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
}

/**
 * "Open Positions Board": תצוגה חיה של הטריידים הפתוחים (`pnl === null`, ראה types/trade.ts),
 * עם P&L שמחושב **לתצוגה בלבד** מול מחיר נוכחי (`computeLivePnl` - שום דבר לא נכתב ל-DB,
 * ראה שם). המחירים מגיעים מ-`open-positions-prices` (Edge Function ייעודית, לא watchlist-prices)
 * בפולינג של `LIVE_PRICE_REFRESH_MS` - **רק כל עוד המסך הזה מותקן/גלוי** (ה-hook הזה חי
 * כאן, לא הועלה ל-App.tsx כמו useMarketData - אין סיבה לצרוך קריאות API כשהמשתמש לא
 * מסתכל על הטאב הזה, בניגוד ל-Home שצריך לשרוד מעברי טאב).
 */
export function OpenPositions({ trades, baseCurrency }: OpenPositionsProps) {
  const { t, locale } = useLanguage()
  const [quotes, setQuotes] = useState<Record<string, OpenPositionQuote | null>>({})
  // "עכשיו" ל-Time in Trade - מתעדכן יחד עם פולינג המחירים (לא טיימר נפרד, ראה CLAUDE.md
  // task packet: אין צורך בדיוק לשנייה, מספיק לרענן בקצב שהמחירים כבר מתרעננים בו).
  const [now, setNow] = useState(() => Date.now())

  const openTrades = trades.filter((tr) => tr.pnl === null)

  useEffect(() => {
    if (openTrades.length === 0) return
    let cancelled = false
    const refresh = () => {
      fetchOpenPositionPrices().then((data) => {
        if (!cancelled) {
          setQuotes(data)
          setNow(Date.now())
        }
      })
    }
    refresh()
    const interval = setInterval(refresh, LIVE_PRICE_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades.length])

  if (openTrades.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={`${styles.emptyCard} metal-panel holo-edge count-in`}>
          <Radar size={30} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{t('openPositions.emptyTitle')}</p>
          <p className={styles.emptyHint}>{t('openPositions.emptyHint')}</p>
        </div>
      </div>
    )
  }

  const rows = openTrades.map((trade) => {
    const quote = quotes[trade.symbol.toUpperCase()] ?? null
    const price = quote?.price ?? null
    const live = computeLivePnl(trade, price)
    const progress = slTpProgress(trade, price)
    const rMultiple = liveRMultiple(trade, price)
    return { trade, quote, live, progress, rMultiple }
  })

  const totalOpenPnl = rows.reduce((sum, r) => sum + (r.live.pnl ?? 0), 0)
  const anyPnlKnown = rows.some((r) => r.live.pnl !== null)

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.overview} metal-panel holo-edge det-frame count-in`}>
        <div className={styles.overviewStat}>
          <span className={styles.overviewLabel}>{t('openPositions.countLabel')}</span>
          <span className={`num ${styles.overviewValue}`}>{openTrades.length}</span>
        </div>
        <div className={styles.overviewDivider} />
        <div className={styles.overviewStat}>
          <span className={styles.overviewLabel}>{t('openPositions.totalPnlLabel')}</span>
          <span
            key={anyPnlKnown ? totalOpenPnl : 'pending'}
            className={`num ${styles.overviewValue} value-pop ${totalOpenPnl > 0 ? styles.positive : totalOpenPnl < 0 ? styles.negative : ''}`}
          >
            {anyPnlKnown ? formatCurrency(totalOpenPnl, baseCurrency, locale) : t('openPositions.pending')}
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        {rows.map(({ trade, quote, live, progress, rMultiple }) => {
          const sign = live.pnl === null ? 'pending' : live.pnl > 0 ? 'up' : live.pnl < 0 ? 'down' : 'flat'
          const hasStop = trade.stopLoss !== null
          const hasTarget = trade.takeProfit !== null
          return (
            <div key={trade.id} className={`${styles.card} metal-panel holo-edge count-in`} data-sign={sign}>
              <div className={styles.cardHeader}>
                <a href={tradingViewUrl(trade.symbol)} target="_blank" rel="noopener noreferrer" className={styles.symbol}>
                  {trade.symbol}
                  <ExternalLink size={11} className={styles.externalIcon} />
                </a>
                <div className={styles.headerRight}>
                  <span className={styles.timeInTrade} title={t('openPositions.timeInTrade')}>
                    <Clock size={10.5} />
                    {formatDuration(trade.entryAt, new Date(now))}
                  </span>
                  <span className={trade.direction === 'long' ? styles.badgeLong : styles.badgeShort}>
                    {trade.direction === 'long' ? t('common.long') : t('common.short')}
                  </span>
                </div>
              </div>

              <div className={styles.priceRow}>
                <div className={styles.priceBlock}>
                  <span className={styles.priceLabel}>{t('openPositions.entryLabel')}</span>
                  <span className="num">{formatCurrency(trade.entryPrice, trade.currency, locale)}</span>
                </div>
                <div className={styles.priceBlock}>
                  <span className={styles.priceLabel}>{t('openPositions.currentLabel')}</span>
                  {quote ? (
                    <span key={quote.price} className="num value-pop">
                      {formatCurrency(quote.price, trade.currency, locale)}
                    </span>
                  ) : (
                    <span className={`num ${styles.pending}`}>{t('openPositions.awaitingQuote')}</span>
                  )}
                  {quote && (
                    <span
                      key={quote.changePercent}
                      className={`num ${styles.todayChange} ${quote.changePercent > 0 ? styles.positive : quote.changePercent < 0 ? styles.negative : ''}`}
                      title={t('openPositions.todayChange')}
                    >
                      {t('openPositions.todayChange')} {quote.changePercent >= 0 ? '+' : ''}
                      {quote.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              <div className={`${styles.pnlRow} det-chip ${sign === 'up' ? 'det-chip--up' : sign === 'down' ? 'det-chip--down' : ''}`}>
                {live.pnl !== null ? (
                  <>
                    <span key={live.pnl} className="value-pop">
                      {live.pnl >= 0 ? '+' : ''}
                      {formatCurrency(live.pnl, trade.currency, locale)}
                    </span>
                    {live.pnlPercent !== null && (
                      <span key={live.pnlPercent}>
                        ({live.pnlPercent >= 0 ? '+' : ''}
                        {live.pnlPercent.toFixed(2)}%)
                      </span>
                    )}
                    {rMultiple !== null && (
                      <span key={rMultiple} className={styles.rMultiple} title={t('openPositions.rMultiple')}>
                        {rMultiple >= 0 ? '+' : ''}
                        {rMultiple.toFixed(2)}R
                      </span>
                    )}
                  </>
                ) : (
                  <span>{t('openPositions.awaitingQuote')}</span>
                )}
              </div>

              {(hasStop || hasTarget) && (
                <div className={styles.slTpBar}>
                  <div className={styles.slTpTrack}>
                    {hasStop && (
                      <div className={styles.slTpSide} title={`${t('openPositions.stopLoss')} ${progress.toStopPercent?.toFixed(0) ?? 0}%`}>
                        {progress.toStopPercent !== null && (
                          <>
                            <div className={styles.slTpFillStop} style={{ width: `${progress.toStopPercent}%` }} />
                            <div className={styles.slTpMarkerStop} style={{ right: `${progress.toStopPercent}%` }} />
                          </>
                        )}
                      </div>
                    )}
                    <div className={styles.slTpEntryMark} title={t('openPositions.entryLabel')} />
                    {hasTarget && (
                      <div className={styles.slTpSide} title={`${t('openPositions.takeProfit')} ${progress.toTargetPercent?.toFixed(0) ?? 0}%`}>
                        {progress.toTargetPercent !== null && (
                          <>
                            <div className={styles.slTpFillTarget} style={{ width: `${progress.toTargetPercent}%` }} />
                            <div className={styles.slTpMarkerTarget} style={{ left: `${progress.toTargetPercent}%` }} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(hasStop || hasTarget) && (
                <div className={styles.riskRow}>
                  {hasStop && (
                    <span className={styles.riskChip}>
                      {t('openPositions.stopLoss')}: {formatCurrency(trade.stopLoss as number, trade.currency, locale)}
                    </span>
                  )}
                  {hasTarget && (
                    <span className={styles.riskChip}>
                      {t('openPositions.takeProfit')}: {formatCurrency(trade.takeProfit as number, trade.currency, locale)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
