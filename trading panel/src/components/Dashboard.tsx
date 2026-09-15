import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLanguage } from '../i18n/LanguageContext'
import type { AccountTier } from '../lib/accountApi'
import { getHistoricalRate, toApiDate } from '../lib/exchangeRates'
import {
  avgHoldDays,
  avgRiskReward,
  avgWinLoss,
  bestTrade,
  dailyPnl,
  equityCurve,
  expectancy,
  maxDrawdown,
  profitFactor,
  statsByDayOfWeek,
  statsBySymbol,
  streaks,
  tradesCountByMonth,
  totalPnl,
  weeklyRecap,
  winRate,
  worstTrade,
} from '../lib/stats'
import { formatDateTime } from '../lib/format'
import { BestWorstSpotlight } from './BestWorstSpotlight'
import { PnlCalendar } from './PnlCalendar'
import { StreakCard } from './StreakCard'
import { WeeklyRecapCard } from './WeeklyRecapCard'
import type { CurrencyCode, Trade } from '../types/trade'
import type { GroupStats } from '../lib/stats'
import styles from './Dashboard.module.css'

interface DashboardProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
  tier: AccountTier
  /** פותח את מודל קוד הגישה (שדרוג) - מועבר ל-`WeeklyRecapCard` (Pro-only), אותו מנגנון כמו שאר האפליקציה. */
  onOpenAccessCode: () => void
  onSelectSymbol?: (symbol: string) => void
  /** לא נצרך כאן יותר - ה"By Setup" table הוסרה מהמסך הזה בכוונה, אבל ה-prop נשאר כדי
   * לא לגעת בשרשרת ה-`goToFilteredTrades`/`TradeFilter` הכללית (App.tsx -> Journal.tsx),
   * שתומכת גם בסוג `'setup'` באופן גנרי יחד עם `'symbol'` (ראה `TradeList.tsx`). */
  onSelectSetup?: (setup: string) => void
}

/** מציג מספר לפי מטבע הבסיס של ה-workspace (כל הטריידים כאן כבר הומרו אליו - ראה `useConvertedTrades`). */
function formatBase(value: number, currency: CurrencyCode, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value)
}

/**
 * ממיר את ה-pnl של כל טרייד למטבע הבסיס של ה-workspace, לפי השער ההיסטורי ליום
 * היציאה (או הכניסה אם עדיין פתוח) - ראה trading-journal-plan.md סעיף "מטבע בדשבורד".
 * הטריידים המקוריים (state ב-App) לעולם לא משתנים - זו תצוגה נגזרת בלבד.
 */
function useConvertedTrades(trades: Trade[], baseCurrency: CurrencyCode) {
  const [converted, setConverted] = useState<Trade[]>(trades)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setConverting(true)
      setError(false)
      try {
        const result = await Promise.all(
          trades.map(async (t) => {
            if (t.pnl === null) return { ...t, currency: baseCurrency }
            if (t.currency === baseCurrency) return t
            const rateDate = toApiDate(t.exitAt ?? t.entryAt)
            const rate = await getHistoricalRate(rateDate, t.currency, baseCurrency)
            return { ...t, pnl: t.pnl * rate, currency: baseCurrency }
          }),
        )
        if (!cancelled) setConverted(result)
      } catch {
        if (!cancelled) {
          setError(true)
          setConverted(trades)
        }
      } finally {
        if (!cancelled) setConverting(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [trades, baseCurrency])

  return { convertedTrades: converted, converting, conversionError: error }
}

function GroupTable({
  title,
  rows,
  baseCurrency,
  locale,
  onSelect,
  maxRows,
}: {
  title: string
  rows: GroupStats[]
  baseCurrency: CurrencyCode
  locale: string
  onSelect?: (key: string) => void
  /** אם מוגדר ויש יותר שורות ממנו - מציג רק את ה-N הראשונות + כפתור "הצג הכל" שמרחיב במקום.
   * לא מוגדר = כל השורות מוצגות תמיד (התנהגות מקורית, כמו ב"By Day of Week"). */
  maxRows?: number
}) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) {
    return (
      <div className={`${styles.section} metal-panel holo-edge`}>
        <h3 className="eyebrow">{title}</h3>
        <p className={styles.chartEmpty}>{t('dashboard.noClosedTrades')}</p>
      </div>
    )
  }
  const isCapped = maxRows !== undefined && rows.length > maxRows
  const visibleRows = isCapped && !expanded ? rows.slice(0, maxRows) : rows
  return (
    <div className={`${styles.section} metal-panel holo-edge`}>
      <h3 className="eyebrow">{title}</h3>
      <div className={styles.groupTable}>
        <div className={styles.groupHeaderRow}>
          <span>{t('dashboard.colName')}</span>
          <span>{t('dashboard.colTrades')}</span>
          <span>{t('dashboard.colWinRate')}</span>
          <span>{t('dashboard.colCumPnl')}</span>
        </div>
        {visibleRows.map((r) => (
          <button
            type="button"
            key={r.key}
            className={styles.groupRow}
            onClick={() => onSelect?.(r.key)}
            disabled={!onSelect}
          >
            <span className={styles.groupKey}>{r.key}</span>
            <span className={styles.num}>{r.trades}</span>
            <span className={styles.num}>{r.winRate.toFixed(0)}%</span>
            <span className={`${styles.num} ${r.pnl >= 0 ? styles.positive : styles.negative}`}>
              {formatBase(r.pnl, baseCurrency, locale)}
            </span>
          </button>
        ))}
      </div>
      {isCapped && (
        <button type="button" className={`btn-metal ${styles.groupExpandBtn}`} onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('dashboard.showLessRows') : t('dashboard.showAllRows', { count: rows.length })}
        </button>
      )}
    </div>
  )
}

export function Dashboard({ trades, baseCurrency, tier, onOpenAccessCode, onSelectSymbol }: DashboardProps) {
  const { t, locale } = useLanguage()
  const { convertedTrades, converting, conversionError } = useConvertedTrades(trades, baseCurrency)

  const closedCount = convertedTrades.filter((t) => t.pnl !== null).length
  const openCount = convertedTrades.length - closedCount
  const { avgWin, avgLoss } = avgWinLoss(convertedTrades)
  const rr = avgRiskReward(convertedTrades)
  const curve = equityCurve(convertedTrades)
  const monthly = tradesCountByMonth(convertedTrades)
  const total = totalPnl(convertedTrades)
  const pf = profitFactor(convertedTrades)
  const exp = expectancy(convertedTrades)
  const holdDays = avgHoldDays(convertedTrades)
  const streakInfo = streaks(convertedTrades)
  const drawdown = maxDrawdown(convertedTrades)
  const calendarData = dailyPnl(convertedTrades)
  const bySymbol = statsBySymbol(convertedTrades)
  const byDayOfWeek = statsByDayOfWeek(convertedTrades)
  const recap = weeklyRecap(convertedTrades)

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span className={`eyebrow ${styles.eyebrow}`}>{baseCurrency}</span>
        <h2 className={`hero-title ${styles.heroTitle}`}>{t('nav.dashboard')}</h2>
        <p className={styles.note}>
          {t('dashboard.note', { currency: baseCurrency })} {converting && t('dashboard.convertingSuffix')}
        </p>
        {conversionError && <p className={styles.note}>{t('dashboard.conversionFailed')}</p>}
      </div>

      <div className={`${styles.kpiCard} ${styles.kpiHero} metal-panel holo-edge holo-edge--amber det-frame count-in`}>
        <div className={styles.kpiHeroTop}>
          <span className={styles.kpiLabel}>{t('dashboard.kpiTotalPnl')}</span>
          {total >= 0 ? (
            <TrendingUp size={18} className={styles.positive} />
          ) : (
            <TrendingDown size={18} className={styles.negative} />
          )}
        </div>
        <span className={`${styles.kpiHeroValue} ${total >= 0 ? styles.positive : styles.negative}`}>
          {formatBase(total, baseCurrency, locale)}
        </span>
        <div className={styles.kpiHeroChips}>
          <span className={`det-chip ${winRate(convertedTrades) >= 50 ? 'det-chip--up' : 'det-chip--down'} ${styles.kpiHeroChip}`}>
            {t('dashboard.kpiWinRate')} · {winRate(convertedTrades).toFixed(1)}%
          </span>
          <span className={`det-chip ${styles.kpiHeroChip} ${styles.kpiHeroChipMuted}`}>
            {t('dashboard.kpiTradesClosedOpen')} · {closedCount} / {openCount}
          </span>
        </div>
      </div>

      <div className={styles.kpiGroup}>
        <h3 className={`eyebrow ${styles.kpiGroupTitle}`}>{t('dashboard.groupPerformance')}</h3>
        <div className={styles.performanceGrid}>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiProfitFactor')}</span>
            <span className={`${styles.kpiValue} ${pf === null || pf >= 1 ? styles.positive : styles.negative}`}>
              {pf === null ? '∞' : pf.toFixed(2)}
            </span>
          </div>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiExpectancy')}</span>
            <span className={`${styles.kpiValue} ${exp >= 0 ? styles.positive : styles.negative}`}>
              {formatBase(exp, baseCurrency, locale)}
            </span>
          </div>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiAvgWin')}</span>
            <span className={`${styles.kpiValue} ${styles.positive}`}>{formatBase(avgWin, baseCurrency, locale)}</span>
          </div>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiAvgLoss')}</span>
            <span className={`${styles.kpiValue} ${styles.negative}`}>{formatBase(avgLoss, baseCurrency, locale)}</span>
          </div>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiAvgRR')}</span>
            <span className={styles.kpiValue}>{rr === null ? '—' : `1:${rr.toFixed(2)}`}</span>
          </div>
        </div>
      </div>

      <div className={styles.kpiGroup}>
        <h3 className={`eyebrow ${styles.kpiGroupTitle}`}>{t('dashboard.groupBehavior')}</h3>
        <div className={styles.behaviorGrid}>
          <StreakCard streakInfo={streakInfo} size="lg" />
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.consecutiveWins')}</span>
            <span className={`${styles.kpiValue} ${styles.positive}`}>{streakInfo.longestWin}</span>
          </div>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.consecutiveLosses')}</span>
            <span className={`${styles.kpiValue} ${styles.negative}`}>{streakInfo.longestLoss}</span>
          </div>
          <div className={`${styles.kpiCard} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiAvgHoldTime')}</span>
            <span className={styles.kpiValue}>
              {holdDays.winners.toFixed(1)} / {holdDays.losers.toFixed(1)} <span className={styles.kpiUnit}>{t('common.days')}</span>
            </span>
          </div>
          <div className={`${styles.kpiCard} ${styles.kpiCardWide} metal-panel holo-edge`}>
            <span className={styles.kpiLabel}>{t('dashboard.kpiMaxDrawdown')}</span>
            <span className={`${styles.kpiValueLg} ${drawdown.amount > 0 ? styles.negative : ''}`}>
              {formatBase(-drawdown.amount, baseCurrency, locale)}{' '}
              <span className={styles.kpiUnit}>({drawdown.percent.toFixed(0)}%)</span>
            </span>
          </div>
        </div>
      </div>

      <div className={`${styles.section} metal-panel holo-edge`}>
        <h3 className="eyebrow">{t('dashboard.heatmapTitle')}</h3>
        <PnlCalendar dailyPnl={calendarData} />
      </div>

      <div className={styles.chartsGrid}>
        <div className={`${styles.section} metal-panel holo-edge`}>
          <h3 className="eyebrow">{t('dashboard.equityCurveTitle')}</h3>
          {curve.length === 0 ? (
            <p className={styles.chartEmpty}>{t('dashboard.noClosedTradesChart')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={curve.map((p) => ({ ...p, label: formatDateTime(p.date, locale) }))}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} minTickGap={20} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={60} stroke="var(--border)" />
                <Tooltip
                  formatter={(value) => formatBase(Number(value), baseCurrency, locale)}
                  contentStyle={{
                    fontSize: 13,
                    background: 'var(--metal-1)',
                    border: '1px solid var(--border-hi)',
                    borderRadius: 10,
                    color: 'var(--text-h)',
                  }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="var(--accent-2)" fill="url(#equityFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`${styles.section} metal-panel holo-edge`}>
          <h3 className="eyebrow">{t('dashboard.tradesByMonthTitle')}</h3>
          {monthly.length === 0 ? (
            <p className={styles.chartEmpty}>{t('dashboard.noTradesYet')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={30} allowDecimals={false} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{
                    fontSize: 13,
                    background: 'var(--metal-1)',
                    border: '1px solid var(--border-hi)',
                    borderRadius: 10,
                    color: 'var(--text-h)',
                  }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--accent-2)" fill="var(--accent-bg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={styles.spotlightGrid}>
        <div className={`${styles.section} metal-panel holo-edge`}>
          <h3 className="eyebrow">{t('dashboard.bestWorstTitle')}</h3>
          <BestWorstSpotlight best={bestTrade(convertedTrades)} worst={worstTrade(convertedTrades)} locale={locale} />
        </div>

        <WeeklyRecapCard recap={recap} baseCurrency={baseCurrency} locale={locale} tier={tier} onOpenAccessCode={onOpenAccessCode} />
      </div>

      <div className={styles.groupsGrid}>
        <GroupTable
          title={t('dashboard.bySymbolTitle')}
          rows={bySymbol}
          baseCurrency={baseCurrency}
          locale={locale}
          onSelect={onSelectSymbol}
          maxRows={6}
        />
        <GroupTable title={t('dashboard.byDayOfWeekTitle')} rows={byDayOfWeek} baseCurrency={baseCurrency} locale={locale} />
      </div>
    </div>
  )
}
