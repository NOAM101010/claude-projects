import { useMemo, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { CALENDAR_DOW, CALENDAR_MONTHS } from '../i18n/translations'
import type { DailyPnl } from '../lib/stats'
import styles from './PnlCalendar.module.css'

interface PnlCalendarProps {
  dailyPnl: DailyPnl[]
}

/** צבע התא לפי עוצמת הרווח/הפסד היחסית למקסימום בשנה המוצגת. */
function colorFor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0 || pnl === 0) return 'rgba(var(--overlay-tint), 0.06)'
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
  const alpha = (0.15 + intensity * 0.75).toFixed(2)
  return pnl > 0 ? `rgba(34, 197, 94, ${alpha})` : `rgba(239, 68, 68, ${alpha})`
}

interface GridDay {
  date: string
  inYear: boolean
  dow: number
}

/** מפת חום P&L יומית שנתית, בהשראת GitHub contributions. הגריד עצמו נשאר LTR (כרונולוגיה) גם באפליקציה RTL. */
export function PnlCalendar({ dailyPnl }: PnlCalendarProps) {
  const { t, language, locale } = useLanguage()
  const MONTHS = CALENDAR_MONTHS[language]
  const DOW = CALENDAR_DOW[language]
  const years = useMemo(() => Array.from(new Set(dailyPnl.map((d) => d.date.slice(0, 4)))).sort(), [dailyPnl])
  const [year, setYear] = useState(() => years[years.length - 1] ?? String(new Date().getFullYear()))
  const activeYear = years.includes(year) ? year : (years[years.length - 1] ?? year)

  const dataMap = useMemo(() => {
    const m = new Map<string, DailyPnl>()
    for (const d of dailyPnl) m.set(d.date, d)
    return m
  }, [dailyPnl])

  const { weeks, monthLabels, maxAbs } = useMemo(() => {
    const yearNum = Number(activeYear)
    const jan1 = new Date(Date.UTC(yearNum, 0, 1))
    const dec31 = new Date(Date.UTC(yearNum, 11, 31))
    const startDow = jan1.getUTCDay()
    const gridStart = new Date(jan1.getTime() - startDow * 86_400_000)

    const days: GridDay[] = []
    let cursor = new Date(gridStart)
    while (cursor <= dec31 || days.length % 7 !== 0) {
      const dateStr = cursor.toISOString().slice(0, 10)
      days.push({ date: dateStr, inYear: cursor.getUTCFullYear() === yearNum, dow: cursor.getUTCDay() })
      cursor = new Date(cursor.getTime() + 86_400_000)
      if (cursor > dec31 && cursor.getUTCDay() === 0) break
    }

    const weeksArr: GridDay[][] = []
    for (let i = 0; i < days.length; i += 7) weeksArr.push(days.slice(i, i + 7))

    const labels: { weekIndex: number; label: string }[] = []
    let lastMonth = -1
    weeksArr.forEach((week, wi) => {
      const firstInYearDay = week.find((d) => d.inYear)
      if (!firstInYearDay) return
      const m = Number(firstInYearDay.date.slice(5, 7)) - 1
      if (m !== lastMonth) {
        labels.push({ weekIndex: wi, label: MONTHS[m] })
        lastMonth = m
      }
    })

    const maxAbsVal = Math.max(1, ...dailyPnl.filter((d) => d.date.startsWith(activeYear)).map((d) => Math.abs(d.pnl)))

    return { weeks: weeksArr, monthLabels: labels, maxAbs: maxAbsVal }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear, dailyPnl, language])

  const [hover, setHover] = useState<DailyPnl | null>(null)

  const yearEntries = dailyPnl.filter((d) => d.date.startsWith(activeYear))
  const yearTotal = yearEntries.reduce((s, d) => s + d.pnl, 0)
  const yearTradingDays = yearEntries.length

  if (dailyPnl.length === 0) {
    return <p className={styles.empty}>{t('dashboard.noClosedTradesChart')}</p>
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.summary}>
          {t('calendar.summary', { days: yearTradingDays, year: activeYear })}{' '}
          <span className={`${styles.summaryValue} num ${yearTotal >= 0 ? styles.positive : styles.negative}`}>
            {yearTotal >= 0 ? '+' : ''}
            {yearTotal.toFixed(2)}
          </span>
        </span>
        {years.length > 1 && (
          <div className={styles.years}>
            {years.map((y) => (
              <button key={y} type="button" data-active={y === activeYear} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      <div dir="ltr" className={styles.gridScroll}>
        <div className={styles.gridInner}>
          <div className={styles.monthRow} style={{ width: weeks.length * 23 }}>
            {monthLabels.map((m) => (
              <span key={m.weekIndex} className={styles.monthLabel} style={{ insetInlineStart: m.weekIndex * 23 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className={styles.gridBody}>
            <div className={styles.dowColumn}>
              {DOW.map((d, i) => (
                <div key={i} className={styles.dowCell}>
                  {i % 2 === 1 ? d : ''}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className={styles.weekColumn}>
                {week.map((day, di) => {
                  const data = dataMap.get(day.date)
                  return (
                    <div
                      key={di}
                      className={styles.dayCell}
                      style={{
                        background: day.inYear ? colorFor(data?.pnl ?? 0, maxAbs) : undefined,
                        visibility: day.inYear ? 'visible' : 'hidden',
                      }}
                      onMouseEnter={() => day.inYear && setHover(data ?? { date: day.date, pnl: 0, trades: 0 })}
                      onMouseLeave={() => setHover(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.hoverInfo}>
          {hover && hover.trades > 0 ? (
            <>
              {t('calendar.hoverWithTrades', {
                date: new Date(hover.date).toLocaleDateString(locale),
                pnl: `${hover.pnl >= 0 ? '+' : ''}${hover.pnl.toFixed(2)}`,
                trades: hover.trades,
              })}
            </>
          ) : hover ? (
            t('calendar.hoverNoTrades', { date: new Date(hover.date).toLocaleDateString(locale) })
          ) : (
            t('calendar.hoverHint')
          )}
        </span>
        <span className={styles.legend}>
          <span>{t('common.loss')}</span>
          <span className={styles.legendSwatch} style={{ background: 'rgba(239, 68, 68, 0.8)' }} />
          <span className={styles.legendSwatch} style={{ background: 'rgba(var(--overlay-tint), 0.06)' }} />
          <span className={styles.legendSwatch} style={{ background: 'rgba(34, 197, 94, 0.8)' }} />
          <span>{t('common.profit')}</span>
        </span>
      </div>
    </div>
  )
}
