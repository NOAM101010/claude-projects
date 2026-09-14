import { ExternalLink } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { calculatePnl, calculatePositionSize } from '../lib/calculators'
import { formatCurrency } from '../lib/format'
import { fetchWatchlistPrices, type WatchlistQuote } from '../lib/marketData'
import { tradingViewUrl } from '../lib/tradingView'
import {
  MAX_WATCHLIST_ALERTS,
  canAddWatchlistAlert,
  createWatchlistAlert,
  deleteWatchlistAlert,
  listWatchlistAlerts,
  type WatchlistAlert,
  type WatchlistDirection,
} from '../lib/watchlistApi'
import styles from './Tools.module.css'

type ToolsTab = 'positionSize' | 'pnl' | 'watchlist'
type RiskMode = 'amount' | 'percent'
type TargetMode = 'price' | 'percent'

const WATCHLIST_PRICE_REFRESH_MS = 120_000

/** מנתח שדה טקסט מספרי לערך; מחזיר undefined אם ריק/לא תקין, כדי שהמחשבון יתייחס אליו כ"לא סופק". */
function parseField(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function PositionSizeCalculator() {
  const { t, locale } = useLanguage()
  const [accountSize, setAccountSize] = useState('10000')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLossPrice, setStopLossPrice] = useState('')
  const [riskMode, setRiskMode] = useState<RiskMode>('percent')
  const [riskAmount, setRiskAmount] = useState('')
  const [riskPercent, setRiskPercent] = useState('1')
  const [targetPrice, setTargetPrice] = useState('')

  const entryPriceNum = parseField(entryPrice)
  const stopLossNum = parseField(stopLossPrice)
  const targetPriceNum = parseField(targetPrice)
  const riskValueNum = riskMode === 'amount' ? parseField(riskAmount) : parseField(riskPercent)
  // "יש להזין ערכים כדי לחשב" מוצג אם עדיין חסר קלט נדרש (accountSize כבר יש לו ברירת
  // מחדל) - במקום מה שהיה קודם: 0/NaN שקטים בתוצאה בלי שום הסבר.
  const hasRequiredInputs =
    parseField(accountSize) !== undefined && entryPriceNum !== undefined && stopLossNum !== undefined && riskValueNum !== undefined

  const result = calculatePositionSize({
    accountSize: parseField(accountSize) ?? 0,
    entryPrice: entryPriceNum ?? 0,
    stopLossPrice: stopLossNum ?? 0,
    riskAmount: riskMode === 'amount' ? riskValueNum : undefined,
    riskPercent: riskMode === 'percent' ? riskValueNum : undefined,
  })

  // Risk:Reward ויזואלי בלבד - מחושב כאן, לא ב-calculators.ts, כי הוא לא חלק מהמחשבון
  // המקורי (אין שדה target ב-calculatePositionSize) אלא תצוגה נוספת מעל אותם שדות.
  const riskPerShare = entryPriceNum !== undefined && stopLossNum !== undefined ? Math.abs(entryPriceNum - stopLossNum) : undefined
  const rewardPerShare =
    entryPriceNum !== undefined && targetPriceNum !== undefined ? Math.abs(targetPriceNum - entryPriceNum) : undefined
  const riskRewardRatio =
    riskPerShare !== undefined && riskPerShare > 0 && rewardPerShare !== undefined ? rewardPerShare / riskPerShare : undefined

  return (
    <div className={`${styles.card} metal-panel holo-edge`}>
      <h2>{t('tools.positionSize.title')}</h2>
      <p className={styles.hint}>{t('tools.positionSize.hint')}</p>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="ps-account">{t('tools.positionSize.accountSizeLabel')}</label>
          <input id="ps-account" type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="ps-entry">{t('tools.positionSize.entryPriceLabel')}</label>
          <input id="ps-entry" type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="ps-stop">{t('tools.positionSize.stopLossPriceLabel')}</label>
        <input id="ps-stop" type="number" value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} />
      </div>

      <div className={styles.subGroup}>
        <span className={styles.subGroupLabel}>{t('tools.positionSize.riskSectionLabel')}</span>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>{t('tools.positionSize.riskModeLabel')}</label>
            <div className={styles.modeToggle}>
              <button type="button" data-active={riskMode === 'amount'} onClick={() => setRiskMode('amount')}>
                {t('tools.positionSize.riskModeAmount')}
              </button>
              <button type="button" data-active={riskMode === 'percent'} onClick={() => setRiskMode('percent')}>
                {t('tools.positionSize.riskModePercent')}
              </button>
            </div>
          </div>
          {riskMode === 'amount' ? (
            <div className={styles.field}>
              <label htmlFor="ps-risk-amount">{t('tools.positionSize.riskAmountLabel')}</label>
              <input id="ps-risk-amount" type="number" value={riskAmount} onChange={(e) => setRiskAmount(e.target.value)} />
            </div>
          ) : (
            <div className={styles.field}>
              <label htmlFor="ps-risk-percent">{t('tools.positionSize.riskPercentLabel')}</label>
              <input id="ps-risk-percent" type="number" value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="ps-target">{t('tools.positionSize.targetPriceLabel')}</label>
          <input id="ps-target" type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
        </div>
        {riskRewardRatio !== undefined && (
          <div className={styles.field}>
            <label>{t('tools.positionSize.riskRewardLabel')}</label>
            <span key={riskRewardRatio} className={`${styles.rrChip} value-pop`}>{`1 : ${riskRewardRatio.toFixed(2)}`}</span>
          </div>
        )}
      </div>

      {hasRequiredInputs ? (
        <div className={`${styles.resultsGrid} count-in`}>
          <div className={`${styles.resultCard} ${styles.resultCardPrimary} det-frame`}>
            <span className={styles.resultLabel}>{t('tools.positionSize.resultShares')}</span>
            <span key={result.shares} className={`num ${styles.resultValuePrimary} value-pop`}>{result.shares}</span>
          </div>
          <div className={styles.resultCard}>
            <span className={styles.resultLabel}>{t('tools.positionSize.resultDollarRisk')}</span>
            <span key={result.dollarRisk} className={`num ${styles.resultValue} ${styles.negative} value-pop`}>{formatCurrency(result.dollarRisk, 'USD', locale)}</span>
          </div>
          <div className={styles.resultCard}>
            <span className={styles.resultLabel}>{t('tools.positionSize.resultPercentRisked')}</span>
            <span key={result.percentOfAccountRisked} className={`num ${styles.resultValue} value-pop`}>{result.percentOfAccountRisked.toFixed(2)}%</span>
          </div>
        </div>
      ) : (
        <p className={styles.resultsPlaceholder}>{t('tools.calculatorEmptyState')}</p>
      )}
    </div>
  )
}

function PnlCalculatorTool() {
  const { t, locale } = useLanguage()
  const [entryPrice, setEntryPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [targetMode, setTargetMode] = useState<TargetMode>('price')
  const [targetPrice, setTargetPrice] = useState('')
  const [targetPercent, setTargetPercent] = useState('')

  const entryPriceNum = parseField(entryPrice)
  const quantityNum = parseField(quantity)
  const targetValueNum = targetMode === 'price' ? parseField(targetPrice) : parseField(targetPercent)
  const hasRequiredInputs = entryPriceNum !== undefined && quantityNum !== undefined && targetValueNum !== undefined

  const result = calculatePnl({
    entryPrice: entryPriceNum ?? 0,
    quantity: quantityNum ?? 0,
    direction,
    targetPrice: targetMode === 'price' ? targetValueNum : undefined,
    targetPercent: targetMode === 'percent' ? targetValueNum : undefined,
  })

  return (
    <div className={`${styles.card} metal-panel holo-edge`}>
      <h2>{t('tools.pnl.title')}</h2>
      <p className={styles.hint}>{t('tools.pnl.hint')}</p>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="pnl-entry">{t('tools.pnl.entryPriceLabel')}</label>
          <input id="pnl-entry" type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="pnl-qty">{t('tools.pnl.quantityLabel')}</label>
          <input id="pnl-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label>{t('tools.pnl.directionLabel')}</label>
          <div className={styles.directionToggle}>
            <button type="button" data-dir="long" data-active={direction === 'long'} onClick={() => setDirection('long')}>
              Long
            </button>
            <button type="button" data-dir="short" data-active={direction === 'short'} onClick={() => setDirection('short')}>
              Short
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label>{t('tools.pnl.targetModeLabel')}</label>
          <div className={styles.modeToggle}>
            <button type="button" data-active={targetMode === 'price'} onClick={() => setTargetMode('price')}>
              {t('tools.pnl.targetModePrice')}
            </button>
            <button type="button" data-active={targetMode === 'percent'} onClick={() => setTargetMode('percent')}>
              {t('tools.pnl.targetModePercent')}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {targetMode === 'price' ? (
          <div className={styles.field}>
            <label htmlFor="pnl-target-price">{t('tools.pnl.targetPriceLabel')}</label>
            <input id="pnl-target-price" type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
          </div>
        ) : (
          <div className={styles.field}>
            <label htmlFor="pnl-target-percent">{t('tools.pnl.targetPercentLabel')}</label>
            <input id="pnl-target-percent" type="number" value={targetPercent} onChange={(e) => setTargetPercent(e.target.value)} />
          </div>
        )}
      </div>

      {hasRequiredInputs ? (
        <div className={`${styles.resultsGrid} count-in`}>
          <div className={`${styles.resultCard} ${styles.resultCardWide} ${styles.resultCardPrimary} det-frame`}>
            <span className={styles.resultLabel}>{t('tools.pnl.resultProfitLoss')}</span>
            <span
              key={result.profitLoss}
              className={`num ${styles.resultValuePrimary} value-pop ${result.profitLoss >= 0 ? styles.positive : styles.negative}`}
            >
              {formatCurrency(result.profitLoss, 'USD', locale)}
            </span>
          </div>
          <div className={styles.resultCard}>
            <span className={styles.resultLabel}>{t('tools.pnl.resultProfitLossPercent')}</span>
            <span
              key={result.profitLossPercent}
              className={`num ${styles.resultValue} value-pop ${result.profitLossPercent >= 0 ? styles.positive : styles.negative}`}
            >
              {result.profitLossPercent >= 0 ? '+' : ''}
              {result.profitLossPercent.toFixed(2)}%
            </span>
          </div>
        </div>
      ) : (
        <p className={styles.resultsPlaceholder}>{t('tools.calculatorEmptyState')}</p>
      )}
    </div>
  )
}

function Watchlist({ accountId }: { accountId: string }) {
  const { t, locale } = useLanguage()
  const [alerts, setAlerts] = useState<WatchlistAlert[]>([])
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote | null>>({})
  const [loading, setLoading] = useState(true)
  const [symbol, setSymbol] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState<WatchlistDirection>('above')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeAlerts = alerts.filter((a) => a.active)

  useEffect(() => {
    let cancelled = false
    listWatchlistAlerts(accountId)
      .then((rows) => {
        if (!cancelled) setAlerts(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load watchlist')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      fetchWatchlistPrices().then((data) => {
        if (!cancelled) setQuotes(data)
      })
    }
    refresh()
    const interval = setInterval(refresh, WATCHLIST_PRICE_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeAlerts.length])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedSymbol = symbol.trim()
    const price = parseField(targetPrice)
    if (!trimmedSymbol || price === undefined) return
    if (!canAddWatchlistAlert(activeAlerts.length)) {
      setError(t('tools.watchlist.limitReached', { max: MAX_WATCHLIST_ALERTS }))
      return
    }

    setSubmitting(true)
    try {
      const created = await createWatchlistAlert(accountId, trimmedSymbol, price, direction, activeAlerts.length)
      setAlerts((prev) => [created, ...prev])
      setSymbol('')
      setTargetPrice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add watchlist alert')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    const previous = alerts
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    try {
      await deleteWatchlistAlert(id)
    } catch (err) {
      setAlerts(previous)
      setError(err instanceof Error ? err.message : 'Failed to remove watchlist alert')
    }
  }

  const atLimit = !canAddWatchlistAlert(activeAlerts.length)

  return (
    <div className={styles.watchlistWrapper}>
      <div className={`${styles.card} metal-panel holo-edge`}>
        <h2>{t('tools.watchlistTab')}</h2>
        <p className={styles.hint}>{t('tools.watchlist.hint', { max: MAX_WATCHLIST_ALERTS })}</p>

        <form onSubmit={handleAdd} className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="wl-symbol">{t('tools.watchlist.symbolLabel')}</label>
            <input
              id="wl-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={10}
              disabled={atLimit}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="wl-target">{t('tools.watchlist.targetPriceLabel')}</label>
            <input
              id="wl-target"
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              disabled={atLimit}
            />
          </div>
          <div className={styles.field}>
            <label>{t('tools.watchlist.directionLabel')}</label>
            <div className={styles.directionToggle}>
              <button
                type="button"
                data-dir="long"
                data-active={direction === 'above'}
                onClick={() => setDirection('above')}
                disabled={atLimit}
              >
                {t('tools.watchlist.directionAbove')}
              </button>
              <button
                type="button"
                data-dir="short"
                data-active={direction === 'below'}
                onClick={() => setDirection('below')}
                disabled={atLimit}
              >
                {t('tools.watchlist.directionBelow')}
              </button>
            </div>
          </div>
          <div className={styles.watchlistAddRow}>
            <button type="submit" className={`${styles.watchlistAddButton} btn-metal`} disabled={atLimit || submitting || !symbol.trim() || parseField(targetPrice) === undefined}>
              {submitting ? t('tools.watchlist.adding') : t('tools.watchlist.addButton')}
            </button>
            <span className={styles.hint}>{t('tools.watchlist.countLabel', { count: activeAlerts.length, max: MAX_WATCHLIST_ALERTS })}</span>
          </div>
        </form>

        {error && <p className={styles.watchlistError}>{error}</p>}
      </div>

      <div className={`${styles.card} metal-panel holo-edge`}>
        {loading ? (
          <p className={styles.hint}>{t('tools.watchlist.loading')}</p>
        ) : activeAlerts.length === 0 ? (
          <p className={styles.hint}>{t('tools.watchlist.empty')}</p>
        ) : (
          <ul className={styles.watchlistList}>
            {activeAlerts.map((alert) => {
              const quote = quotes[alert.symbol.toUpperCase()]
              return (
                <li key={alert.id} className={`${styles.watchlistRow} det-frame`}>
                  <div className={styles.watchlistSymbolBlock}>
                    <a
                      href={tradingViewUrl(alert.symbol)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.watchlistSymbol}
                    >
                      {alert.symbol}
                      <ExternalLink size={12} className={styles.externalIcon} />
                    </a>
                    <span className={styles.hint}>
                      {t('tools.watchlist.targetLabel')}: {alert.direction === 'above' ? '≥' : '≤'}{' '}
                      {formatCurrency(alert.targetPrice, 'USD', locale)}
                    </span>
                  </div>
                  <div className={styles.watchlistPriceBlock}>
                    <span className={styles.resultLabel}>{t('tools.watchlist.currentPriceLabel')}</span>
                    <span className={`num ${styles.resultValue}`}>
                      {quote ? formatCurrency(quote.price, 'USD', locale) : t('tools.watchlist.unavailable')}
                    </span>
                  </div>
                  <button type="button" className={styles.watchlistDeleteBtn} onClick={() => handleDelete(alert.id)}>
                    {t('tools.watchlist.deleteButton')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * מסך "Tools": sub-nav פנימי בין Position Size / P&L Calculator / Watchlist. שני
 * המחשבונים מחשבים חי תוך כדי הקלדה בלי קריאות רשת; ה-Watchlist היחיד שקורא לשרת
 * (רשימת ההתראות + מחירים חיים כל 2 דקות, ראה Watchlist למעלה).
 */
export function Tools({ accountId }: { accountId: string }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<ToolsTab>('positionSize')

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.subNav} btn-metal`}>
        <button type="button" data-active={tab === 'positionSize'} onClick={() => setTab('positionSize')}>
          {t('tools.positionSizeTab')}
        </button>
        <button type="button" data-active={tab === 'pnl'} onClick={() => setTab('pnl')}>
          {t('tools.pnlTab')}
        </button>
        <button type="button" data-active={tab === 'watchlist'} onClick={() => setTab('watchlist')}>
          {t('tools.watchlistTab')}
        </button>
      </div>

      {tab === 'positionSize' && <PositionSizeCalculator />}
      {tab === 'pnl' && <PnlCalculatorTool />}
      {tab === 'watchlist' && <Watchlist accountId={accountId} />}
    </div>
  )
}
