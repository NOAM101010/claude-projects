import type { Trade } from '../types/trade'

/**
 * P&L "חי" (תצוגה בלבד) לפוזיציה פתוחה, לפי המחיר הנוכחי (Finnhub) - אף פעם לא נכתב
 * ל-DB, אף פעם לא מחליף/נוגע ב-`pnl` האמיתי של הטרייד (שנשאר null כל עוד היא פתוחה,
 * ראה types/trade.ts). הנוסחה זהה בכוונה ל-`computePnl` ב-stats.ts - `currentPrice`
 * פשוט משמש כאן במקום `exitPrice`, כדי שלא יהיה שום פער בין איך שהאפליקציה מחשבת
 * P&L "אמיתי" בסגירה לבין איך שהיא מציגה תצוגה מקדימה של אותו חישוב בזמן אמת.
 */
export interface LivePnl {
  /** רווח/הפסד $ חי - null רק אם אין עדיין מחיר נוכחי (ציטוט לא הגיע/סימבול לא זמין) */
  pnl: number | null
  /** רווח/הפסד % ביחס לעלות הכניסה (entryPrice * quantity) - null אם אין מחיר או שהכניסה 0 */
  pnlPercent: number | null
}

export function computeLivePnl(trade: Trade, currentPrice: number | null): LivePnl {
  if (currentPrice === null || Number.isNaN(currentPrice)) return { pnl: null, pnlPercent: null }
  if (Number.isNaN(trade.entryPrice) || Number.isNaN(trade.quantity)) return { pnl: null, pnlPercent: null }

  const raw =
    trade.direction === 'long'
      ? (currentPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - currentPrice) * trade.quantity
  const pnl = raw - (trade.fee ?? 0)

  const costBasis = trade.entryPrice * trade.quantity
  const pnlPercent = trade.entryPrice > 0 && costBasis !== 0 ? (pnl / Math.abs(costBasis)) * 100 : null

  return { pnl, pnlPercent }
}

export interface SlTpProgress {
  /** 0-100: כמה מהדרך מ-Entry ל-Stop Loss המחיר הנוכחי כבר עשה (כיוון "לסכנה") - null אם אין SL על הטרייד, או שה-SL מוגדר בצד הלא-הגיוני של הכניסה (למשל SL מעל הכניסה בלונג). */
  toStopPercent: number | null
  /** 0-100: כמה מהדרך מ-Entry ל-Take Profit המחיר הנוכחי כבר עשה (כיוון "ליעד"). אותם כללים כמו toStopPercent. */
  toTargetPercent: number | null
}

/**
 * מרחק המחיר הנוכחי מ-Entry לכיוון Stop Loss / Take Profit, כאחוז (0-100, קליפ בקצוות).
 * במתכוון "כיוון-מודע" ולא צירי מחיר גולמי: ב-`toStopPercent`/`toTargetPercent` "100" תמיד
 * אומר "הגיע ללבל", בלי קשר אם זה לונג או שורט - כדי שהעיצוב (בר ה-UI) יקרא אותו דבר
 * לשני הכיוונים במקום להתהפך. אם המחיר עבר את הרמה, קליפ ל-100 (לא שלילי/מעל 100).
 * אם המחיר זז בכיוון ההפוך (מתרחק מהרמה), קליפ ל-0 (לא שלילי).
 */
export function slTpProgress(trade: Trade, currentPrice: number | null): SlTpProgress {
  if (currentPrice === null || Number.isNaN(currentPrice)) return { toStopPercent: null, toTargetPercent: null }
  if (Number.isNaN(trade.entryPrice)) return { toStopPercent: null, toTargetPercent: null }

  const { direction, entryPrice, stopLoss, takeProfit } = trade

  const progressToward = (level: number | null, isStop: boolean): number | null => {
    if (level === null || Number.isNaN(level)) return null

    // "distance" = המרחק המלא מ-Entry עד הרמה, בכיוון הנכון (SL מתחת לכניסה בלונג/מעל בשורט, TP הפוך).
    const distance =
      direction === 'long' ? (isStop ? entryPrice - level : level - entryPrice) : isStop ? level - entryPrice : entryPrice - level
    // רמה מוגדרת בצד הלא-הגיוני של הכניסה (או שווה לה) - דגנרטיבי, בלי בר.
    if (distance <= 0) return null

    const traveled =
      direction === 'long'
        ? isStop
          ? entryPrice - currentPrice
          : currentPrice - entryPrice
        : isStop
          ? currentPrice - entryPrice
          : entryPrice - currentPrice

    return Math.max(0, Math.min(100, (traveled / distance) * 100))
  }

  return {
    toStopPercent: progressToward(stopLoss, true),
    toTargetPercent: progressToward(takeProfit, false),
  }
}

/**
 * R-Multiple חי: כמה פעמים הסיכון ההתחלתי (|entry - stop| * quantity) הרווח/הפסד ה-חי
 * הנוכחי מייצג. אותה הגדרת "risk" בדיוק כמו `avgRiskReward` ב-stats.ts, כדי שלא יהיה
 * פער בין המושג "R" בדוחות הסגורים לבין התצוגה החיה. null אם אין Stop Loss, אין מחיר
 * נוכחי, או שהסיכון 0 (entry == stop, דגנרטיבי - עדיף להשמיט מאשר להציג Infinity).
 */
export function liveRMultiple(trade: Trade, currentPrice: number | null): number | null {
  if (trade.stopLoss === null || Number.isNaN(trade.stopLoss)) return null

  const risk = Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity
  if (risk === 0) return null

  const { pnl } = computeLivePnl(trade, currentPrice)
  if (pnl === null) return null

  return pnl / risk
}
