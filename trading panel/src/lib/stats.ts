import type { Trade } from '../types/trade'

export interface PnlInput {
  direction: Trade['direction']
  entryPrice: number
  exitPrice: number | null
  quantity: number
  fee: number | null
}

/**
 * מחשב P&L לטרייד. מחזיר null כל עוד אין מחיר יציאה (פוזיציה פתוחה).
 * Long: (exit - entry) * qty - fee | Short: (entry - exit) * qty - fee
 */
export function computePnl({ direction, entryPrice, exitPrice, quantity, fee }: PnlInput): number | null {
  if (exitPrice === null || Number.isNaN(exitPrice)) return null
  if (Number.isNaN(entryPrice) || Number.isNaN(quantity)) return null

  const raw = direction === 'long' ? (exitPrice - entryPrice) * quantity : (entryPrice - exitPrice) * quantity
  return raw - (fee ?? 0)
}

function closedTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.pnl !== null)
}

/** אחוז טריידים סגורים עם רווח (pnl > 0), מתוך כלל הטריידים הסגורים. 0 אם אין טריידים סגורים. */
export function winRate(trades: Trade[]): number {
  const closed = closedTrades(trades)
  if (closed.length === 0) return 0
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length
  return (wins / closed.length) * 100
}

export function totalPnl(trades: Trade[]): number {
  return closedTrades(trades).reduce((sum, t) => sum + (t.pnl ?? 0), 0)
}

export interface EquityPoint {
  date: string
  cumulative: number
}

/** עקומת הון: P&L מצטבר לאורך זמן, ממוין לפי תאריך יציאה (רק טריידים סגורים). */
export function equityCurve(trades: Trade[]): EquityPoint[] {
  const closed = closedTrades(trades)
    .slice()
    .sort((a, b) => new Date(a.exitAt as string).getTime() - new Date(b.exitAt as string).getTime())

  let running = 0
  return closed.map((t) => {
    running += t.pnl ?? 0
    return { date: t.exitAt as string, cumulative: running }
  })
}

export interface WinLossAverage {
  /** ממוצע רווח בטריידים מרוויחים (מספר חיובי, 0 אם אין) */
  avgWin: number
  /** ממוצע הפסד בטריידים מפסידים (מספר שלילי, 0 אם אין) */
  avgLoss: number
}

export function avgWinLoss(trades: Trade[]): WinLossAverage {
  const closed = closedTrades(trades)
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0)

  const avgWin = wins.length ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0

  return { avgWin, avgLoss }
}

/**
 * יחס Risk:Reward ממוצע, מבוסס על Stop Loss / Take Profit שהוגדרו מראש בטרייד
 * (risk = |entry - stop|, reward = |takeProfit - entry|). מתעלם מטריידים בלי שני השדות.
 * מחזיר null אם אין ולו טרייד אחד עם שני השדות.
 */
export function avgRiskReward(trades: Trade[]): number | null {
  const withBoth = trades.filter((t) => t.stopLoss !== null && t.takeProfit !== null)
  if (withBoth.length === 0) return null

  const ratios = withBoth
    .map((t) => {
      const risk = Math.abs(t.entryPrice - (t.stopLoss as number))
      const reward = Math.abs((t.takeProfit as number) - t.entryPrice)
      return risk === 0 ? null : reward / risk
    })
    .filter((r): r is number => r !== null)

  if (ratios.length === 0) return null
  return ratios.reduce((s, r) => s + r, 0) / ratios.length
}

export interface PeriodCount {
  /** "YYYY-MM" */
  period: string
  count: number
}

/** מספר טריידים (לפי תאריך כניסה) מקובצים לפי חודש, ממוין כרונולוגית. */
export function tradesCountByMonth(trades: Trade[]): PeriodCount[] {
  const counts = new Map<string, number>()
  for (const t of trades) {
    const d = new Date(t.entryAt)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts.set(period, (counts.get(period) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period))
}

/** Profit Factor = סה"כ רווחים חיוביים / |סה"כ הפסדים|. null אם אין הפסדים בכלל (מוצג כ-"∞" ב-UI). */
export function profitFactor(trades: Trade[]): number | null {
  const closed = closedTrades(trades)
  const grossWin = closed.filter((t) => (t.pnl ?? 0) > 0).reduce((s, t) => s + (t.pnl ?? 0), 0)
  const grossLoss = Math.abs(closed.filter((t) => (t.pnl ?? 0) < 0).reduce((s, t) => s + (t.pnl ?? 0), 0))
  return grossLoss > 0 ? grossWin / grossLoss : null
}

/** תוחלת רווח/הפסד ממוצעת לטרייד = winRate*avgWin - (1-winRate)*|avgLoss|. 0 אם אין טריידים סגורים. */
export function expectancy(trades: Trade[]): number {
  const closed = closedTrades(trades)
  if (closed.length === 0) return 0
  const wr = winRate(trades) / 100
  const { avgWin, avgLoss } = avgWinLoss(trades)
  return wr * avgWin + (1 - wr) * avgLoss
}

export interface HoldDaysInfo {
  /** ממוצע ימי החזקה (exit - entry) לטריידים מנצחים */
  winners: number
  /** ממוצע ימי החזקה לטריידים מפסידים */
  losers: number
}

/** זמן החזקה ממוצע בימים, בנפרד למנצחים ולמפסידים (רק טריידים סגורים). */
export function avgHoldDays(trades: Trade[]): HoldDaysInfo {
  const closed = closedTrades(trades)
  const holdDays = (t: Trade) => (new Date(t.exitAt as string).getTime() - new Date(t.entryAt).getTime()) / 86_400_000

  const wins = closed.filter((t) => (t.pnl ?? 0) > 0)
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0)

  return {
    winners: wins.length ? wins.reduce((s, t) => s + holdDays(t), 0) / wins.length : 0,
    losers: losses.length ? losses.reduce((s, t) => s + holdDays(t), 0) / losses.length : 0,
  }
}

export interface StreakInfo {
  current: { type: 'win' | 'loss' | 'none'; count: number }
  longestWin: number
  longestLoss: number
}

/** רצפי ניצחון/הפסד רצופים, ממוינים כרונולוגית לפי תאריך יציאה (רק טריידים סגורים). */
export function streaks(trades: Trade[]): StreakInfo {
  const closed = closedTrades(trades)
    .slice()
    .sort((a, b) => new Date(a.exitAt as string).getTime() - new Date(b.exitAt as string).getTime())

  let longestWin = 0
  let longestLoss = 0
  let runningWin = 0
  let runningLoss = 0

  for (const t of closed) {
    const pnl = t.pnl ?? 0
    if (pnl > 0) {
      runningWin += 1
      runningLoss = 0
      longestWin = Math.max(longestWin, runningWin)
    } else if (pnl < 0) {
      runningLoss += 1
      runningWin = 0
      longestLoss = Math.max(longestLoss, runningLoss)
    } else {
      runningWin = 0
      runningLoss = 0
    }
  }

  let current: StreakInfo['current'] = { type: 'none', count: 0 }
  if (closed.length > 0) {
    const lastPnl = closed[closed.length - 1].pnl ?? 0
    if (lastPnl > 0) current = { type: 'win', count: runningWin }
    else if (lastPnl < 0) current = { type: 'loss', count: runningLoss }
  }

  return { current, longestWin, longestLoss }
}

export interface DrawdownInfo {
  /** גודל הירידה המקסימלית מהשיא בעקומת ההון (מספר חיובי) */
  amount: number
  /** אותה ירידה, כאחוז מהשיא שקדם לה (0 אם השיא הוא 0) */
  percent: number
}

/** Max Drawdown: הירידה המקסימלית מהשיא לאורך עקומת ההון המצטברת. */
export function maxDrawdown(trades: Trade[]): DrawdownInfo {
  const curve = equityCurve(trades)
  let peak = 0
  let amount = 0
  let percent = 0

  for (const point of curve) {
    if (point.cumulative > peak) peak = point.cumulative
    const dd = peak - point.cumulative
    if (dd > amount) {
      amount = dd
      percent = peak !== 0 ? (dd / Math.abs(peak)) * 100 : 0
    }
  }

  return { amount, percent }
}

export interface DailyPnl {
  /** "YYYY-MM-DD" (לפי תאריך היציאה, UTC) */
  date: string
  pnl: number
  trades: number
}

/** P&L יומי מצטבר, מקובץ לפי תאריך יציאה - לשימוש במפת חום שנתית. */
export function dailyPnl(trades: Trade[]): DailyPnl[] {
  const closed = closedTrades(trades)
  const map = new Map<string, DailyPnl>()

  for (const t of closed) {
    const key = (t.exitAt as string).slice(0, 10)
    const entry = map.get(key) ?? { date: key, pnl: 0, trades: 0 }
    entry.pnl += t.pnl ?? 0
    entry.trades += 1
    map.set(key, entry)
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export interface GroupStats {
  key: string
  trades: number
  winRate: number
  pnl: number
}

function groupClosedBy(trades: Trade[], keyFn: (t: Trade) => string): GroupStats[] {
  const closed = closedTrades(trades)
  const map = new Map<string, Trade[]>()

  for (const t of closed) {
    const key = keyFn(t)
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }

  return Array.from(map.entries())
    .map(([key, arr]) => {
      const wins = arr.filter((t) => (t.pnl ?? 0) > 0).length
      return {
        key,
        trades: arr.length,
        winRate: (wins / arr.length) * 100,
        pnl: arr.reduce((s, t) => s + (t.pnl ?? 0), 0),
      }
    })
    .sort((a, b) => b.pnl - a.pnl)
}

/** פילוח טריידים סגורים לפי סימבול, ממוין לפי P&L מצטבר יורד. */
export function statsBySymbol(trades: Trade[]): GroupStats[] {
  return groupClosedBy(trades, (t) => t.symbol)
}

/** פילוח טריידים סגורים לפי style/setup, ממוין לפי P&L מצטבר יורד. טריידים בלי setup מקובצים תחת "ללא הגדרה". */
export function statsBySetup(trades: Trade[]): GroupStats[] {
  return groupClosedBy(trades, (t) => t.setup ?? 'ללא הגדרה')
}

export function bestTrade(trades: Trade[]): Trade | null {
  const closed = closedTrades(trades)
  if (closed.length === 0) return null
  return closed.reduce((best, t) => ((t.pnl ?? 0) > (best.pnl ?? 0) ? t : best))
}

export function worstTrade(trades: Trade[]): Trade | null {
  const closed = closedTrades(trades)
  if (closed.length === 0) return null
  return closed.reduce((worst, t) => ((t.pnl ?? 0) < (worst.pnl ?? 0) ? t : worst))
}

export interface TradeOfTheMonth {
  trade: Trade
  /** מספר טריידים סגורים בחודש הקלנדרי הזה (כולל הטרייד עצמו) - ל"Best of N". */
  closedCountInMonth: number
}

/**
 * הטרייד הכי טוב (P&L גבוה ביותר, טריידים סגורים בלבד) מתוך טריידים שה-`exitAt`
 * שלהם נופל בחודש הקלנדרי הנוכחי (לפי `referenceDate`, ברירת מחדל `new Date()`) -
 * "טרייד החודש" מתחדש כל חודש, לא מסתכל על כל ההיסטוריה. null אם אין אף טרייד
 * סגור החודש.
 */
export function tradeOfTheMonth(trades: Trade[], referenceDate: Date = new Date()): TradeOfTheMonth | null {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()

  const closedThisMonth = closedTrades(trades).filter((t) => {
    const exit = new Date(t.exitAt as string)
    return exit.getFullYear() === year && exit.getMonth() === month
  })

  if (closedThisMonth.length === 0) return null

  const best = closedThisMonth.reduce((best, t) => ((t.pnl ?? 0) > (best.pnl ?? 0) ? t : best))
  return { trade: best, closedCountInMonth: closedThisMonth.length }
}
