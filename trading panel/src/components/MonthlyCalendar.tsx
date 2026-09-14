import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { CALENDAR_DOW, MONTH_NAMES } from '../i18n/translations'
import { formatCurrency } from '../lib/format'
import { dailyPnl, dayActivityLevel, winRate } from '../lib/stats'
import type { DailyPnl } from '../lib/stats'
import { shareOrDownloadCanvas } from '../lib/canvasExport'
import { renderMonthlyCalendarToCanvas } from '../lib/monthlyCalendarCanvas'
import { DailyTradingView } from './DailyTradingView'
import { TradeOfTheMonthCard } from './TradeOfTheMonthCard'
import type { CurrencyCode, Trade } from '../types/trade'
import styles from './MonthlyCalendar.module.css'

interface MonthlyCalendarProps {
  trades: Trade[]
  baseCurrency: CurrencyCode
  /** פותח את אותו טופס עריכה קיים (App.tsx's `openEditForm`) - נקרא מתוך `DailyTradingView`. */
  onEditTrade: (trade: Trade) => void
}

interface DayCell {
  date: Date
  key: string
  inMonth: boolean
  data: DailyPnl | undefined
}

/** צבע התא (רקע) לפי עוצמת ה-P&L היחסית למקסימום בחודש המוצג - אותה נוסחה כמו `PnlCalendar`, אך גוון עמוק יותר כי התא כאן גדול ומציג ספרה בפועל. */
function backgroundFor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0 || pnl === 0) return 'rgba(var(--overlay-tint), 0.03)'
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
  const alpha = (0.12 + intensity * 0.55).toFixed(2)
  return pnl > 0 ? `rgba(34, 197, 94, ${alpha})` : `rgba(239, 68, 68, ${alpha})`
}

/**
 * מסך "Calendar" עצמאי, ניתן לניווט חודש-חודש - **לא** אותו דבר כמו `PnlCalendar.tsx`
 * (מפת החום השנתית המשובצת בתוך Dashboard, שנשארת בדיוק כמו שהיא). כאן כל תא יום
 * מציג את סכום ה-P&L בפועל כמספר (לא רק צבע+hover), כי המסך הזה מוקדש כולו לזה.
 * דאטה: אותה שכבת אגרגציה `dailyPnl` מ-`stats.ts` שכבר צורכת `PnlCalendar`, מסוננת
 * בצד קליינט לחודש הנבחר בלבד - בלי fetch חדש (הטריידים כבר נטענים ב-`App.tsx`).
 */
export function MonthlyCalendar({ trades, baseCurrency, onEditTrade }: MonthlyCalendarProps) {
  const { t, language, locale } = useLanguage()
  const DOW = CALENDAR_DOW[language]
  const MONTHS = MONTH_NAMES[language]

  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  // "YYYY-MM-DD" של היום שה-Daily Trading View פתוח עבורו כרגע, או null כשהתצוגה סגורה.
  const [openDayKey, setOpenDayKey] = useState<string | null>(null)

  const allDaily = useMemo(() => dailyPnl(trades), [trades])
  const dataMap = useMemo(() => {
    const m = new Map<string, DailyPnl>()
    for (const d of allDaily) m.set(d.date, d)
    return m
  }, [allDaily])
  const activityMap = useMemo(() => dayActivityLevel(trades), [trades])

  const monthKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  // נגזר מ-cursor (לא ה-"today" האמיתי) - כך ש"טרייד החודש" בלוח מתעדכן כשמנווטים חודש אחורה/קדימה.
  const tradeOfMonthRef = useMemo(() => new Date(cursor.year, cursor.month, 1), [cursor])

  const { weeks, monthEntries, maxAbs } = useMemo(() => {
    const firstOfMonth = new Date(cursor.year, cursor.month, 1)
    const startDow = firstOfMonth.getDay()
    const gridStart = new Date(cursor.year, cursor.month, 1 - startDow)

    const days: DayCell[] = []
    const cell = new Date(gridStart)
    // 6 שורות x 7 = 42 תאים, מכסה כל חודש כולל חודשים בני 31 יום שמתחילים בשבת
    for (let i = 0; i < 42; i++) {
      const key = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
      days.push({ date: new Date(cell), key, inMonth: cell.getMonth() === cursor.month, data: dataMap.get(key) })
      cell.setDate(cell.getDate() + 1)
    }

    const weeksArr: DayCell[][] = []
    for (let i = 0; i < days.length; i += 7) weeksArr.push(days.slice(i, i + 7))

    const entries = days.filter((d) => d.inMonth && d.data).map((d) => d.data as DailyPnl)
    const maxAbsVal = Math.max(1, ...entries.map((d) => Math.abs(d.pnl)))

    return { weeks: weeksArr, monthEntries: entries, maxAbs: maxAbsVal }
  }, [cursor, dataMap])

  const monthTotal = monthEntries.reduce((s, d) => s + d.pnl, 0)
  const bestDay = monthEntries.length ? monthEntries.reduce((best, d) => (d.pnl > best.pnl ? d : best)) : null
  const worstDay = monthEntries.length ? monthEntries.reduce((worst, d) => (d.pnl < worst.pnl ? d : worst)) : null
  // Total Trades = סה"כ טריידים בחודש (סכום, לא ספירת ימים כמו Trading Days).
  const totalTradesInMonth = monthEntries.reduce((s, d) => s + d.trades, 0)
  const avgPnlPerTradingDay = monthEntries.length > 0 ? monthTotal / monthEntries.length : 0

  // הטריידים הסגורים של היום הפתוח כרגע ב-Daily Trading View (כל ההיסטוריה, לא רק החודש
  // המוצג - כך שלחיצה על צ'יפ Best/Worst Day תמיד עובדת גם אם הוא לא מתאים לחודש הנוכחי).
  const openDayTrades = useMemo(() => {
    if (!openDayKey) return []
    return trades.filter((tr) => tr.pnl !== null && tr.exitAt && (tr.exitAt as string).slice(0, 10) === openDayKey)
  }, [trades, openDayKey])
  const openDayDate = openDayKey ? new Date(`${openDayKey}T00:00:00`) : null

  const goPrev = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))
  const goNext = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))

  const today = new Date()
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth()
  const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sharing, setSharing] = useState(false)

  const monthClosedTrades = useMemo(
    () =>
      trades.filter((t) => {
        if (t.pnl === null || !t.exitAt) return false
        const exit = new Date(t.exitAt)
        return exit.getFullYear() === cursor.year && exit.getMonth() === cursor.month
      }),
    [trades, cursor],
  )
  const monthWinRate = winRate(monthClosedTrades)

  const handleShare = async () => {
    setSharing(true)
    try {
      const canvas = canvasRef.current ?? document.createElement('canvas')
      renderMonthlyCalendarToCanvas(canvas, {
        monthLabel: `${MONTHS[cursor.month]} ${cursor.year}`,
        monthPnl: monthTotal,
        winRatePct: monthWinRate,
        tradingDays: monthEntries.length,
        bestDayPnl: bestDay ? bestDay.pnl : null,
        baseCurrency,
        locale,
        dow: DOW,
        weeks: weeks.map((week) =>
          week.map((day) => ({
            date: day.date.getDate(),
            inMonth: day.inMonth,
            pnl: day.data ? day.data.pnl : null,
            trades: day.data?.trades ?? 0,
          })),
        ),
        maxAbs,
        disclaimer: t('footer.disclaimer'),
      })
      await shareOrDownloadCanvas(canvas, `tradepanel-calendar-${monthKey}.png`, `${MONTHS[cursor.month]} ${cursor.year}`)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.hero} metal-panel holo-edge holo-edge--amber det-frame count-in`}>
        <div className={styles.heroNav}>
          <div className={styles.heroNavStart}>
            <button type="button" className={`${styles.navButton} btn-metal`} onClick={goPrev} aria-label={t('monthlyCalendar.prevMonth')}>
              <ChevronLeft size={18} />
            </button>
            {!isCurrentMonth && (
              <button type="button" className={`${styles.todayButton} btn-metal`} onClick={goToday}>
                {t('monthlyCalendar.todayButton')}
              </button>
            )}
          </div>
          <div className={styles.heroCenter}>
            <span className={`eyebrow ${styles.eyebrow}`}>{t('nav.calendar')}</span>
            <h1 className={`hero-title ${styles.heroTitle}`}>
              {MONTHS[cursor.month]} {cursor.year}
            </h1>
          </div>
          <div className={styles.heroNavEnd}>
            <button type="button" className={`${styles.navButton} btn-metal`} onClick={goNext} aria-label={t('monthlyCalendar.nextMonth')}>
              <ChevronRight size={18} />
            </button>
            <button type="button" className={`${styles.shareButton} btn-metal`} onClick={handleShare} disabled={sharing}>
              <Share2 size={14} />
              <span>{t('common.share')}</span>
            </button>
          </div>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span className={styles.heroStatLabel}>{t('monthlyCalendar.monthTotal')}</span>
            <span className={`num ${styles.heroStatValue} ${monthTotal >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(monthTotal, baseCurrency, locale)}
            </span>
          </div>
          <div className={styles.heroStat}>
            <span className={`num ${styles.heroStatValue}`}>{monthEntries.length}</span>
            <span className={styles.heroStatLabel}>{t('monthlyCalendar.tradingDays', { count: monthEntries.length })}</span>
          </div>
          <div className={styles.heroStat}>
            <span className={`num ${styles.heroStatValue}`}>{totalTradesInMonth}</span>
            <span className={styles.heroStatLabel}>{t('monthlyCalendar.totalTrades')}</span>
          </div>
          <div className={styles.heroStat}>
            <span className={`num ${styles.heroStatValue} ${avgPnlPerTradingDay >= 0 ? styles.positive : styles.negative}`}>
              {formatCurrency(avgPnlPerTradingDay, baseCurrency, locale)}
            </span>
            <span className={styles.heroStatLabel}>{t('monthlyCalendar.avgPerDay')}</span>
          </div>
          {bestDay && (
            <button type="button" className={`${styles.heroStat} ${styles.heroStatButton}`} onClick={() => setOpenDayKey(bestDay.date)}>
              <span className={`det-chip det-chip--up ${styles.heroChip}`}>{t('monthlyCalendar.bestDay')}</span>
              <span className={`num ${styles.heroStatValue} ${styles.positive}`}>{formatCurrency(bestDay.pnl, baseCurrency, locale)}</span>
            </button>
          )}
          {worstDay && (
            <button type="button" className={`${styles.heroStat} ${styles.heroStatButton}`} onClick={() => setOpenDayKey(worstDay.date)}>
              <span className={`det-chip det-chip--down ${styles.heroChip}`}>{t('monthlyCalendar.worstDay')}</span>
              <span className={`num ${styles.heroStatValue} ${styles.negative}`}>{formatCurrency(worstDay.pnl, baseCurrency, locale)}</span>
            </button>
          )}
        </div>
      </div>

      <TradeOfTheMonthCard trades={trades} locale={locale} referenceDate={tradeOfMonthRef} compact />

      <div className={`${styles.grid} metal-panel holo-edge`} key={monthKey} dir="ltr">
        <div className={styles.dowRow}>
          {DOW.map((d, i) => (
            <div key={i} className={styles.dowCell}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.weekRow}>
            {week.map((day, di) => {
              const idx = wi * 7 + di
              const hasData = day.inMonth && day.data
              const activity = hasData ? activityMap.get(day.key) : undefined
              const isSelected = openDayKey === day.key
              return (
                <button
                  key={day.key}
                  type="button"
                  disabled={!hasData}
                  onClick={() => hasData && setOpenDayKey(day.key)}
                  className={`${styles.dayCell} ${day.inMonth ? '' : styles.outMonth} ${hasData ? styles.dayCellClickable : ''} ${
                    isSelected ? styles.dayCellSelected : ''
                  } ${activity === 'high' ? styles.activityHigh : activity === 'low' ? styles.activityLow : ''} count-in`}
                  style={{
                    background: hasData ? backgroundFor(day.data!.pnl, maxAbs) : undefined,
                    animationDelay: `${idx * 8}ms`,
                  }}
                >
                  <span className={styles.dayNumber}>{day.date.getDate()}</span>
                  {hasData ? (
                    <>
                      <span className={`num ${styles.dayPnl} ${day.data!.pnl >= 0 ? styles.positive : styles.negative}`}>
                        {formatCurrency(day.data!.pnl, baseCurrency, locale)}
                      </span>
                      <span className={styles.dayTrades}>{t('monthlyCalendar.dayTradesCount', { count: day.data!.trades })}</span>
                    </>
                  ) : (
                    day.inMonth && <span className={styles.dayEmpty}>{t('monthlyCalendar.noTrades')}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {monthEntries.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{t('monthlyCalendar.noTradesInMonth')}</p>
          <p className={styles.emptyHint}>{t('monthlyCalendar.noTradesInMonthHint')}</p>
        </div>
      )}

      <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />

      {openDayDate && (
        <DailyTradingView
          date={openDayDate}
          dayTrades={openDayTrades}
          locale={locale}
          onClose={() => setOpenDayKey(null)}
          onEditTrade={onEditTrade}
        />
      )}
    </div>
  )
}
