import type { SlTpField, SlTpHistoryEntry } from './slTpHistoryApi'
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

/**
 * קריטריון קנוני יחיד ל"טרייד פתוח" - `exitPrice === null`, ולא `pnl`/`stopLoss`. פונקציה
 * משותפת שכל הקוד (סטטיסטיקות כאן, `TradeList`/`OpenPositions`/`DesktopStatBar`/
 * `MonthlyCalendar`/`tradeFilters.ts` וכו') חייב לקרוא לה, כדי שלא יהיו כמה בדיקות
 * לא-עקביות שיכולות להתפצל זו מזו (ר' באג היסטורי: `pnl` יכול היה להישאר `null` אחרי
 * ייבוא/מיזוג למרות ש-`exitPrice` כבר מולא - `importData.ts`/`mergeImport.ts` מתוקנים
 * כעת לחשב `pnl` תמיד מ-`computePnl()` ברגע ש-`exitPrice` קיים, כדי ששני השדות לא
 * ייצאו מסונכרנים).
 */
export function isTradeOpen(trade: Trade): boolean {
  return trade.exitPrice === null
}

function closedTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => !isTradeOpen(t))
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

/** סה"כ עמלות ששולמו על כל הטריידים הסגורים (סכום `fee ?? 0`). 0 אם אף טרייד לא כולל עמלה. */
export function totalFeesPaid(trades: Trade[]): number {
  return closedTrades(trades).reduce((sum, t) => sum + (t.fee ?? 0), 0)
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

/**
 * Max Drawdown: הירידה המקסימלית מהשיא לאורך עקומת ההון המצטברת - הנקודה עם ה-`drawdownAmount`
 * הגדול ביותר ב-`drawdownCurve` (אותה לוגיקת מעקב-שיא, לא כפולה - ראה שם).
 */
export function maxDrawdown(trades: Trade[]): DrawdownInfo {
  let amount = 0
  let percent = 0

  for (const point of drawdownCurve(trades)) {
    if (point.drawdownAmount > amount) {
      amount = point.drawdownAmount
      percent = point.drawdownPercent
    }
  }

  return { amount, percent }
}

export interface DrawdownPoint {
  date: string
  drawdownAmount: number
  drawdownPercent: number
}

/**
 * עקומת Drawdown ("underwater curve"): בכל נקודה בזמן, כמה רחוק המשתמש מהשיא שקדם לה
 * (השיא הרץ פחות המצטבר הנוכחי, גם כ-$ וגם כ-% מהשיא). מבוססת על אותה `equityCurve`
 * שמ-Max Drawdown משתמש בה, כדי ששתי הפונקציות לעולם לא יתפצלו זו מזו - ראה בדיקת
 * ה-cross-check ב-stats.test.ts.
 */
export function drawdownCurve(trades: Trade[]): DrawdownPoint[] {
  const curve = equityCurve(trades)
  let peak = 0

  return curve.map((point) => {
    if (point.cumulative > peak) peak = point.cumulative
    const dd = peak - point.cumulative
    return {
      date: point.date,
      drawdownAmount: dd,
      drawdownPercent: peak !== 0 ? (dd / Math.abs(peak)) * 100 : 0,
    }
  })
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

export type DayActivityLevel = 'low' | 'normal' | 'high'

/**
 * רמת פעילות יומית ("כמה יום זה חריג ביחס להרגלי המסחר של החשבון הזה") - נגזרת
 * מהנתונים בפועל, לא מסף קבוע (למשל "3+ טריידים = high" היה שרירותי ולא מתחשב
 * בזה שחשבון אחד עושה בממוצע טרייד ביום ואחר עושה 10). לוקחים רק ימים "פעילים"
 * (≥1 טרייד סגור) לבסיס הממוצע/סטיית-התקן - ימי אפס לא אמורים למשוך את הממוצע
 * למטה ולהפוך כל יום רגיל ל"high" מלאכותית. עם פחות מ-2 ימים פעילים (או סטיית
 * תקן 0, כשכל הימים הפעילים זהים) אין בסיס סטטיסטי משמעותי - הכל 'normal',
 * לא NaN/קריסה.
 */
export function dayActivityLevel(trades: Trade[]): Map<string, DayActivityLevel> {
  const daily = dailyPnl(trades)
  const result = new Map<string, DayActivityLevel>()
  if (daily.length === 0) return result

  const counts = daily.map((d) => d.trades)
  const mean = counts.reduce((s, c) => s + c, 0) / counts.length
  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length
  const stddev = Math.sqrt(variance)

  const canDifferentiate = daily.length >= 2 && stddev > 0
  const lowCutoff = mean - 0.5 * stddev
  const highCutoff = mean + 0.5 * stddev

  for (const d of daily) {
    if (!canDifferentiate) {
      result.set(d.date, 'normal')
    } else if (d.trades < lowCutoff) {
      result.set(d.date, 'low')
    } else if (d.trades > highCutoff) {
      result.set(d.date, 'high')
    } else {
      result.set(d.date, 'normal')
    }
  }

  return result
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

/** פילוח טריידים סגורים לפי style/setup, ממוין לפי P&L מצטבר יורד. טריידים בלי setup מקובצים תחת "No setup". */
export function statsBySetup(trades: Trade[]): GroupStats[] {
  return groupClosedBy(trades, (t) => t.setup ?? 'No setup')
}

const DAY_OF_WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** ימי המסחר בלבד (שני-שישי) - שבת/ראשון תמיד ריקים אצל המשתמש ולא מוצגים בטבלה. */
const WEEKDAY_NAMES = DAY_OF_WEEK_NAMES.slice(1, 6)

/**
 * פילוח טריידים סגורים לפי יום בשבוע (זמן מקומי) של תאריך היציאה - רק ימי המסחר
 * (שני-שישי) מוצגים תמיד, בסדר קלנדרי (גם ימים בלי טריידים, עם 0/סטטיסטיקה ריקה),
 * ולא ממוין לפי P&L כמו `groupClosedBy` הרגיל - כאן הסדר הקבוע יותר שימושי.
 */
export function statsByDayOfWeek(trades: Trade[]): GroupStats[] {
  const grouped = new Map(groupClosedBy(trades, (t) => DAY_OF_WEEK_NAMES[new Date(t.exitAt as string).getDay()]).map((g) => [g.key, g]))
  return WEEKDAY_NAMES.map((name) => grouped.get(name) ?? { key: name, trades: 0, winRate: 0, pnl: 0 })
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

export interface WeeklyRecap {
  /** מספר טריידים סגורים ב-7 הימים האחרונים (חלון נע, לא שבוע קלנדרי - שונה מ-`DateRangePreset` 'thisWeek' ב-tradeFilters.ts). */
  tradeCount: number
  /** P&L מצטבר בחלון, 0 אם אין טריידים סגורים. */
  netPnl: number
  /** אחוז טריידים מרוויחים בחלון, 0 אם אין טריידים סגורים. */
  winRate: number
  /** netPnl / tradeCount בחלון, 0 אם אין טריידים סגורים. שונה מ-`expectancy()` הכלל-חשבוני -
   * זה ממוצע גולמי מוגבל ל-7 הימים האחרונים בלבד, לא תוחלת מבוססת-win-rate על כל ההיסטוריה. */
  avgPnlPerTrade: number
  /** הטרייד עם ה-P&L הגבוה ביותר בחלון (גם אם שלילי - כמו `bestTrade()`, לא רק מנצחים). null אם אין טריידים סגורים בחלון. */
  bestTrade: { id: string; symbol: string; pnl: number } | null
  /** הטרייד עם ה-P&L הנמוך ביותר בחלון (אותו דפוס בדיוק כמו `bestTrade`, min במקום max - אם
   * יש רק טרייד אחד בחלון, best/worst הם אותו טרייד (אותו `id`) - `WeeklyRecapCard.tsx`
   * מזהה את זה לפי `id` ומציג אריח בודד במקום שני אריחים זהים). null אם אין טריידים סגורים בחלון. */
  worstTrade: { id: string; symbol: string; pnl: number } | null
  /** P&L נטו של חלון 7 הימים *שלפני* החלון הנוכחי (יום -14 עד יום -7 יחסית ל-referenceDate) -
   * להשוואת שבוע-מול-שבוע ב-WeeklyRecapCard. null אם לא היו טריידים סגורים בחלון הקודם, כדי
   * שלא נציג השוואה מטעה (למשל "+100%") מול שום דבר בפועל. */
  previousWeekNetPnl: number | null
}

/**
 * "Weekly Recap": סיכום 7 הימים האחרונים (חלון נע לפי `exitAt`, כולל `referenceDate` עצמו) -
 * לשימוש ב-`WeeklyRecapCard.tsx` (Pro-only). בכוונה *לא* אותו דבר כמו `matchesDateRange`'s
 * 'thisWeek' preset ב-tradeFilters.ts (שם/ראשון קלנדרי) - כאן תמיד "7 הימים האחרונים"
 * בפועל, בלי תלות באיזה יום השבוע היום.
 */
export function weeklyRecap(trades: Trade[], referenceDate: Date = new Date()): WeeklyRecap {
  const cutoff = new Date(referenceDate)
  cutoff.setDate(cutoff.getDate() - 7)

  const inWindow = closedTrades(trades).filter((t) => {
    const exit = new Date(t.exitAt as string).getTime()
    return exit >= cutoff.getTime() && exit <= referenceDate.getTime()
  })

  const tradeCount = inWindow.length
  const netPnl = inWindow.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const wins = inWindow.filter((t) => (t.pnl ?? 0) > 0).length
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0
  const best = tradeCount > 0 ? inWindow.reduce((b, t) => ((t.pnl ?? 0) > (b.pnl ?? 0) ? t : b)) : null
  const worst = tradeCount > 0 ? inWindow.reduce((w, t) => ((t.pnl ?? 0) < (w.pnl ?? 0) ? t : w)) : null

  // חלון-ההשוואה: 7 הימים שממש לפני החלון הנוכחי (יום -14 עד יום -7), לא חופף אליו.
  const previousCutoffStart = new Date(referenceDate)
  previousCutoffStart.setDate(previousCutoffStart.getDate() - 14)
  const previousCutoffEnd = new Date(cutoff)
  const previousWindow = closedTrades(trades).filter((t) => {
    const exit = new Date(t.exitAt as string).getTime()
    return exit >= previousCutoffStart.getTime() && exit < previousCutoffEnd.getTime()
  })
  const previousWeekNetPnl = previousWindow.length > 0 ? previousWindow.reduce((s, t) => s + (t.pnl ?? 0), 0) : null

  return {
    tradeCount,
    netPnl,
    winRate,
    avgPnlPerTrade: tradeCount > 0 ? netPnl / tradeCount : 0,
    bestTrade: best ? { id: best.id, symbol: best.symbol, pnl: best.pnl ?? 0 } : null,
    worstTrade: worst ? { id: worst.id, symbol: worst.symbol, pnl: worst.pnl ?? 0 } : null,
    previousWeekNetPnl,
  }
}

/** מינימום טריידים מפסידים סגורים בכל כיוון (long וגם short) לפני שקובעים טענה כיוונית -
 * ראה `lossSourceBreakdown`. "מספיק הפסדים בסה"כ" לא מספיק: אם כל ההפסדים (או כמעט כולם)
 * מגיעים מכיוון אחד כי החשבון כמעט ולא סוחר בכיוון השני, אין באמת "מקור הפסדים" להשוות -
 * זו סתם עובדה טריוויאלית ("100% מ-Long" כי אין Short בכלל), לא תובנה. */
const MIN_LOSING_TRADES_PER_DIRECTION = 3
/** נתח מינימלי (%) מסך ה-$ שהופסד כדי לקרוא לכיוון אחד "דומיננטי" - מתחת לזה זה "אין דפוס ברור". */
const DOMINANT_LOSS_SHARE_THRESHOLD = 60

export type LossSourceBreakdown =
  | { sufficientData: false }
  | {
      sufficientData: true
      /** סה"כ $ שהופסד בטריידים סגורים מפסידים בכיוון long (מספר חיובי - כמות ה-$, לא ה-pnl השלילי) */
      longLossAmount: number
      /** אותו דבר לכיוון short */
      shortLossAmount: number
      /** longLossAmount + shortLossAmount */
      totalLossAmount: number
      longSharePercent: number
      shortSharePercent: number
      /** הכיוון שאחראי ל-≥`DOMINANT_LOSS_SHARE_THRESHOLD`% מסך ההפסד, אם יש כזה - null אם מאוזן. */
      dominantDirection: 'long' | 'short' | null
    }

/**
 * "מאיפה ההפסדים מגיעים" - מתוך טריידים סגורים ומפסידים בלבד (pnl < 0), איזה נתח מסך ה-$
 * שהופסד הגיע מטריידים long מול short. דורש לפחות `MIN_LOSING_TRADES_PER_DIRECTION` טריידים
 * מפסידים *בכל אחד* מהכיוונים (לא רק מספיק הפסדים בסה"כ) לפני שנאמרת טענה כיוונית כלשהי -
 * מתחת לזה `sufficientData: false`, כדי לא להציג "השוואה" מול כיוון שכמעט ולא נסחר בו
 * בכלל (אותו עיקרון כמו שאר האפליקציה - ר' איך `TradeOfTheMonthCard` מטפל ב"אין עדיין
 * טרייד מנצח" בכנות במקום לכפות אחד).
 */
export function lossSourceBreakdown(trades: Trade[]): LossSourceBreakdown {
  const losses = closedTrades(trades).filter((t) => (t.pnl ?? 0) < 0)
  const longLosses = losses.filter((t) => t.direction === 'long')
  const shortLosses = losses.filter((t) => t.direction === 'short')
  if (longLosses.length < MIN_LOSING_TRADES_PER_DIRECTION || shortLosses.length < MIN_LOSING_TRADES_PER_DIRECTION) {
    return { sufficientData: false }
  }

  const longLossAmount = Math.abs(losses.filter((t) => t.direction === 'long').reduce((s, t) => s + (t.pnl ?? 0), 0))
  const shortLossAmount = Math.abs(losses.filter((t) => t.direction === 'short').reduce((s, t) => s + (t.pnl ?? 0), 0))
  const totalLossAmount = longLossAmount + shortLossAmount

  const longSharePercent = totalLossAmount > 0 ? (longLossAmount / totalLossAmount) * 100 : 0
  const shortSharePercent = totalLossAmount > 0 ? (shortLossAmount / totalLossAmount) * 100 : 0

  let dominantDirection: 'long' | 'short' | null = null
  if (longSharePercent >= DOMINANT_LOSS_SHARE_THRESHOLD) dominantDirection = 'long'
  else if (shortSharePercent >= DOMINANT_LOSS_SHARE_THRESHOLD) dominantDirection = 'short'

  return { sufficientData: true, longLossAmount, shortLossAmount, totalLossAmount, longSharePercent, shortSharePercent, dominantDirection }
}

/** מינימום טריידים סגורים בתוך setup בודד כדי להיכלל בדירוג "Setup Performance" - פחות מזה זה רעש. */
const MIN_TRADES_PER_RANKED_SETUP = 3
/** מינימום מספר setups אמיתיים (שאינם "No setup") שעומדים בסף לעיל, לפני שדירוג בכלל נחשב
 * בעל משמעות - setup אמיתי בודד (או אפס, כשהכל נופל תחת "No setup") הוא לא "דירוג", זו סתם
 * חזרה על סטטיסטיקת כל החשבון תחת שם אחד. */
const MIN_REAL_SETUPS_FOR_RANKING = 2

/**
 * דירוג setups לפי ביצועים, לשימוש ב"Setup Performance" (Pro) - קורא ל-`statsBySetup` הקיים
 * (לא משכפל את חישוב ה-win-rate/P&L שלו), מסנן החוצה את דלי "No setup" (לא setup אמיתי -
 * לא ניתן לדרג "לא תייגתי") ו-setups עם פחות מ-`MIN_TRADES_PER_RANKED_SETUP` טריידים סגורים,
 * כדי לא לדרג setup עם טרייד בודד כאילו הוא ממצא משמעותי. אם פחות מ-`MIN_REAL_SETUPS_FOR_RANKING`
 * setups עומדים בקריטריונים - מחזיר מערך ריק (הכרטיס כולו מוסתר ב-`SetupPerformanceCard`,
 * אין טעם "לדרג" setup בודד מול עצמו). נשאר ממוין לפי P&L מצטבר יורד (אותו סדר כמו `statsBySetup`).
 */
export function rankedSetupPerformance(trades: Trade[]): GroupStats[] {
  const realSetups = statsBySetup(trades).filter((s) => s.key !== 'No setup' && s.trades >= MIN_TRADES_PER_RANKED_SETUP)
  if (realSetups.length < MIN_REAL_SETUPS_FOR_RANKING) return []
  return realSetups
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

export interface SlTpDirectionCounts {
  /** התרחק ממחיר הכניסה לעומת הערך המקורי (יותר סיכון ב-SL, יעד רחוק יותר ב-TP) */
  widened: number
  /** התקרב למחיר הכניסה לעומת הערך המקורי (פחות סיכון ב-SL, יעד קרוב יותר ב-TP) */
  tightened: number
  /** אותו מרחק ממחיר הכניסה כמו הערך המקורי (הוזז אבל לא שינה מרחק, למשל 95→105 עם כניסה ב-100) */
  unchanged: number
}

export interface SlTpAdjustmentStats {
  /** מספר טריידים סגורים ייחודיים שעברו לפחות עדכון אחד ל-SL או TP (union, לא סכום) */
  adjustedTradesCount: number
  stopLoss: SlTpDirectionCounts
  takeProfit: SlTpDirectionCounts
}

/**
 * סטטיסטיקת התאמות SL/TP (רמה בסיסית - ללא win-rate analysis, לפי החלטה מראש). לוקחת
 * רק טריידים **סגורים** (`exitPrice` לא null - ראה `isTradeOpen`) עם היסטוריית שינוי
 * SL/TP (`trade_sl_tp_history`, ראה `slTpHistoryApi.ts`).
 *
 * "ערך מקורי" (baseline) לכל trade_id+field = ה-`oldValue` של רשומת ההיסטוריה עם ה-
 * `changedAt` **הכי מוקדם** - לא הערך שהיה רגע לפני העריכה האחרונה. כך גם אחרי כמה
 * עריכות רצופות, ההשוואה היא תמיד מול הערך הראשון-אי-פעם.
 *
 * הכיוון (widened/tightened) נקבע לפי מרחק אבסולוטי ממחיר הכניסה - המרחק הנוכחי
 * (`trade.stopLoss`/`trade.takeProfit` החי) מול מרחק ה-baseline. אותה נוסחת מרחק לשני
 * השדות (מתאימה את עצמה אוטומטית לכיוון long/short בלי לוגיקה נפרדת) - "התרחק
 * ממחיר הכניסה" תמיד widened, "התקרב" תמיד tightened, בין אם זה SL (יותר/פחות סיכון)
 * או TP (יעד רחוק/קרוב יותר).
 *
 * טרייד/שדה עם baseline null (השדה לא היה מוגדר מלכתחילה) או ערך נוכחי null (השדה
 * נמחק) לא נספר בכיוון - אין מרחק תקף להשוואה - אבל עדיין נספר ב-`adjustedTradesCount`
 * כי בכל זאת הייתה היסטוריית שינוי.
 */
export function slTpAdjustmentStats(trades: Trade[], history: SlTpHistoryEntry[]): SlTpAdjustmentStats {
  const closed = closedTrades(trades)
  const closedById = new Map(closed.map((t) => [t.id, t]))

  const byTradeField = new Map<string, SlTpHistoryEntry[]>()
  for (const entry of history) {
    if (!closedById.has(entry.tradeId)) continue
    const key = `${entry.tradeId}|${entry.field}`
    const arr = byTradeField.get(key) ?? []
    arr.push(entry)
    byTradeField.set(key, arr)
  }

  const adjustedTradeIds = new Set<string>()
  const stopLoss: SlTpDirectionCounts = { widened: 0, tightened: 0, unchanged: 0 }
  const takeProfit: SlTpDirectionCounts = { widened: 0, tightened: 0, unchanged: 0 }

  for (const [key, entries] of byTradeField) {
    const separatorIndex = key.lastIndexOf('|')
    const tradeId = key.slice(0, separatorIndex)
    const field = key.slice(separatorIndex + 1) as SlTpField
    const trade = closedById.get(tradeId)
    if (!trade) continue
    adjustedTradeIds.add(tradeId)

    const oldest = entries.reduce((earliest, e) => (new Date(e.changedAt).getTime() < new Date(earliest.changedAt).getTime() ? e : earliest))
    const baseline = oldest.oldValue
    const current = field === 'stop_loss' ? trade.stopLoss : trade.takeProfit
    if (baseline === null || current === null) continue

    const baselineDistance = Math.abs(baseline - trade.entryPrice)
    const currentDistance = Math.abs(current - trade.entryPrice)
    const bucket = field === 'stop_loss' ? stopLoss : takeProfit
    if (currentDistance > baselineDistance) bucket.widened += 1
    else if (currentDistance < baselineDistance) bucket.tightened += 1
    else bucket.unchanged += 1
  }

  return { adjustedTradesCount: adjustedTradeIds.size, stopLoss, takeProfit }
}

export interface DailyRiskBudgetUsage {
  /** P&L נטו של טריידים שנסגרו היום (`exitAt` בתאריך המקומי של הריצה). 0 אם אין טריידים שנסגרו היום. */
  netPnlToday: number
  /** 0-100: כמה מהתקציב "נוצל" ע"י הפסד היום - 0 אם אין תקציב מוגדר או שהיום ברווח/מאוזן. */
  budgetUsedPercent: number
}

/**
 * שימוש בתקציב הסיכון היומי (Day Trading בלבד, `DailyRiskBudgetCard`) - משווה את ה-P&L
 * הנטו של טריידים שנסגרו **היום** (זמן מקומי) מול `budget` שהמשתמש הגדיר ב-workspace.
 * "נוצל" נמדד רק מול הפסד (`netPnlToday < 0`) - יום רווחי תמיד 0% נוצל, לא אחוז שלילי.
 */
export function dailyRiskBudgetUsage(trades: Trade[], budget: number | null): DailyRiskBudgetUsage {
  const todayKey = new Date().toDateString()
  const netPnlToday = closedTrades(trades)
    .filter((t) => new Date(t.exitAt as string).toDateString() === todayKey)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0)

  if (budget === null || budget <= 0 || netPnlToday >= 0) {
    return { netPnlToday, budgetUsedPercent: 0 }
  }

  return { netPnlToday, budgetUsedPercent: Math.min(100, (Math.abs(netPnlToday) / budget) * 100) }
}

const R_MULTIPLE_BUCKETS = ['<-2R', '-2..-1R', '-1..0R', '0..1R', '1..2R', '2..3R', '>3R'] as const

export interface RMultipleBucket {
  bucket: (typeof R_MULTIPLE_BUCKETS)[number]
  count: number
}

function rMultipleBucket(r: number): RMultipleBucket['bucket'] {
  if (r < -2) return '<-2R'
  if (r < -1) return '-2..-1R'
  if (r < 0) return '-1..0R'
  if (r < 1) return '0..1R'
  if (r < 2) return '1..2R'
  if (r < 3) return '2..3R'
  return '>3R'
}

/**
 * התפלגות R-multiple לטריידים סגורים עם Stop Loss מוגדר - אותה נוסחת risk בדיוק כמו
 * `avgRiskReward`/`liveRMultiple` (`risk = |entry - stop| * quantity`), `rMultiple = pnl / risk`.
 * טריידים בלי stopLoss, או עם risk=0 (entry===stop, דגנרטיבי), מדולגים. כל 7 הדליים תמיד
 * מופיעים בסדר קבוע - גם עם count=0 - כדי שההיסטוגרמה תמיד תציג את הטווח המלא, לא רק
 * דליים שיש בהם דאטה.
 */
export function rMultipleDistribution(trades: Trade[]): RMultipleBucket[] {
  const counts = new Map<RMultipleBucket['bucket'], number>(R_MULTIPLE_BUCKETS.map((b) => [b, 0]))

  for (const t of trades) {
    if (t.exitPrice === null || t.stopLoss === null) continue
    const risk = Math.abs(t.entryPrice - t.stopLoss) * t.quantity
    if (risk === 0) continue
    const rMultiple = (t.pnl ?? 0) / risk
    const bucket = rMultipleBucket(rMultiple)
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }

  return R_MULTIPLE_BUCKETS.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }))
}

/**
 * פילוח טריידים סגורים לפי שעת כניסה (`entryAt`, זמן מקומי, 0-23) - אותה צורה בדיוק כמו
 * `statsByDayOfWeek` (`GroupStats`), רק מפתח-קיבוץ שונה. `key` הוא מספר השעה כמחרוזת
 * ("9"/"14") - פורמט תצוגה (למשל "9:00 AM") הוא אחריות ה-UI, לא הפונקציה הזו.
 */
export function performanceByHourOfDay(trades: Trade[]): GroupStats[] {
  return groupClosedBy(trades, (t) => String(new Date(t.entryAt).getHours()))
}
