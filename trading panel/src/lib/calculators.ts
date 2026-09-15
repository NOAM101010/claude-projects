/**
 * מחשבונים טהורים לשימוש במסך Tools (`src/components/Tools.tsx`) - בלי קריאות רשת,
 * חישוב חי תוך כדי הקלדה. שני המחשבונים עצמאיים לגמרי מהדאטה של האפליקציה (לא נוגעים
 * בטריידים שמורים) - כלי תכנון בלבד.
 */

export interface PositionSizeInput {
  accountSize: number
  entryPrice: number
  stopLossPrice: number
  /** סכום סיכון קבוע בדולרים. יש לספק בדיוק אחד מ-riskAmount/riskPercent. */
  riskAmount?: number
  /** סיכון כאחוז מהחשבון (למשל 1 = 1%). יש לספק בדיוק אחד מ-riskAmount/riskPercent. */
  riskPercent?: number
}

export interface PositionSizeResult {
  /** כמות מניות מומלצת לקנייה (מעוגל למטה, לא ניתן לקנות מניה חלקית) */
  shares: number
  /** סיכון בדולרים בפועל אם הסטופ נפגע, לפי כמות המניות המעוגלת */
  dollarRisk: number
  /** אחוז החשבון שנחשף בפועל בסיכון, לפי כמות המניות המעוגלת */
  percentOfAccountRisked: number
}

/**
 * גודל פוזיציה: כמות מניות כך שההפסד במקרה פגיעה בסטופ לא יעלה על הסיכון שנקבע.
 * shares = riskBudget / |entryPrice - stopLossPrice|, מעוגל למטה למניה שלמה.
 * מחזיר אפסים אם הקלט לא תקין (accountSize<=0, entry===stop, מחירים שליליים/NaN).
 */
export function calculatePositionSize({
  accountSize,
  entryPrice,
  stopLossPrice,
  riskAmount,
  riskPercent,
}: PositionSizeInput): PositionSizeResult {
  const riskBudget = riskAmount ?? (riskPercent !== undefined ? (riskPercent / 100) * accountSize : undefined)

  const perShareRisk = Math.abs(entryPrice - stopLossPrice)

  if (
    riskBudget === undefined ||
    !Number.isFinite(riskBudget) ||
    riskBudget <= 0 ||
    !Number.isFinite(accountSize) ||
    accountSize <= 0 ||
    !Number.isFinite(perShareRisk) ||
    perShareRisk <= 0
  ) {
    return { shares: 0, dollarRisk: 0, percentOfAccountRisked: 0 }
  }

  const shares = Math.floor(riskBudget / perShareRisk)
  const dollarRisk = shares * perShareRisk
  const percentOfAccountRisked = (dollarRisk / accountSize) * 100

  return { shares, dollarRisk, percentOfAccountRisked }
}

export interface PnlCalculatorInput {
  entryPrice: number
  quantity: number
  direction: 'long' | 'short'
  /** מחיר יעד מוחלט. יש לספק בדיוק אחד מ-targetPrice/targetPercent. */
  targetPrice?: number
  /** תזוזה יעד באחוזים ממחיר הכניסה (למשל 5 = +5%). יש לספק בדיוק אחד מ-targetPrice/targetPercent. */
  targetPercent?: number
}

export interface PnlCalculatorResult {
  profitLoss: number
  profitLossPercent: number
}

/**
 * P&L צפוי במחיר יעד נתון (מוחלט או כאחוז מהכניסה), לפי אותה נוסחה כמו `stats.ts`'s
 * `computePnl` (Long: (target-entry)*qty | Short: (entry-target)*qty) - בלי עמלה, כלי תכנון בלבד.
 */
export function calculatePnl({
  entryPrice,
  quantity,
  direction,
  targetPrice,
  targetPercent,
}: PnlCalculatorInput): PnlCalculatorResult {
  const resolvedTarget =
    targetPrice ?? (targetPercent !== undefined ? entryPrice * (1 + targetPercent / 100) : undefined)

  if (
    resolvedTarget === undefined ||
    !Number.isFinite(resolvedTarget) ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(quantity) ||
    entryPrice <= 0 ||
    quantity <= 0
  ) {
    return { profitLoss: 0, profitLossPercent: 0 }
  }

  const profitLoss = direction === 'long' ? (resolvedTarget - entryPrice) * quantity : (entryPrice - resolvedTarget) * quantity
  const investedCapital = entryPrice * quantity
  const rawPercent = ((resolvedTarget - entryPrice) / entryPrice) * 100
  const profitLossPercent = direction === 'long' ? rawPercent : -rawPercent

  return { profitLoss, profitLossPercent: investedCapital > 0 ? profitLossPercent : 0 }
}

/**
 * מספר טריידים סגורים מינימלי כדי ש-Kelly ייחשב משמעותי סטטיסטית (Pro-only, ר' Tools.tsx
 * "Risk Analysis"). מתחת לזה - win rate/avgWin/avgLoss מבוססים על מדגם קטן מדי, ומספר
 * מדויק (שנראה מדעי) יטעה יותר משיעזור. סף שרירותי-אבל-סביר, לא "אמת" מתמטית.
 */
export const MIN_CLOSED_TRADES_FOR_KELLY = 10

export interface KellyResult {
  /** f* = W - (1-W)/R, שבר עשרוני (0.25 = 25% מההון לטרייד) - יכול לצאת שלילי (edge שלילי, לא לסחור בכלל). */
  fullKelly: number
  /** fullKelly/2 - "Half Kelly", הגרסה השמרנית שמומלצת הלכה למעשה (Kelly המלא רגיש מדי
   * לאי-דיוק במדגם ולתנודתיות קיצונית בפועל - קונבנציה סטנדרטית בספרות המסחר/הימורים, לא המצאה שלנו). */
  halfKelly: number
}

export type KellyOutcome =
  | { kelly: KellyResult; reason: null }
  /** 'notEnoughTrades' = פחות מ-`MIN_CLOSED_TRADES_FOR_KELLY` טריידים סגורים. 'noLosingTrades' =
   * אין אף טרייד מפסיד (R = avgWin/|avgLoss| לא מוגדר/אינסופי) - עדיין לא הפסיד אף פעם, אין על מה לבסס R. */
  | { kelly: null; reason: 'notEnoughTrades' | 'noLosingTrades' }

/**
 * Kelly Criterion, מבוסס על סטטיסטיקת ההיסטוריה האמיתית של החשבון (לא מקבל טריידים ישירות -
 * הקורא מזין `winRate()`/`avgWinLoss()` מ-stats.ts, כמו ששאר המחשבונים בקובץ הזה מקבלים
 * מספרים גולמיים ולא Trade[]). f* = W - (1-W)/R, W = win rate כשבר עשרוני (0-1), R = avgWin/|avgLoss|.
 * מחזיר `{ kelly: null, reason }` במקום מספר מזויף-מדויק כשהנתונים לא מספיקים/לא מוגדרים -
 * עקבי עם עקרון "בלי דאטה מזויף" שכבר קיים באפליקציה (ר' TradeOfTheMonthCard).
 */
export function calculateKelly(winRate: number, avgWin: number, avgLoss: number, closedTradeCount: number): KellyOutcome {
  if (closedTradeCount < MIN_CLOSED_TRADES_FOR_KELLY) {
    return { kelly: null, reason: 'notEnoughTrades' }
  }
  if (avgLoss === 0) {
    return { kelly: null, reason: 'noLosingTrades' }
  }

  const r = avgWin / Math.abs(avgLoss)
  if (!Number.isFinite(r) || r <= 0) {
    return { kelly: null, reason: 'noLosingTrades' }
  }

  const fullKelly = winRate - (1 - winRate) / r
  return { kelly: { fullKelly, halfKelly: fullKelly / 2 }, reason: null }
}

export interface RiskOfRuinInput {
  /** אחוז טריידים מרוויחים כשבר עשרוני (0-1). */
  winRate: number
  /** אחוז טריידים מפסידים כשבר עשרוני (0-1) - לא בהכרח 1-winRate, כי יכולים להיות טריידים
   * "שווים" (pnl בדיוק 0) שלא נספרים לא כניצחון ולא כהפסד. */
  lossRate: number
  accountSize: number
  riskPerTrade: number
}

/**
 * Risk of Ruin - נוסחת "חינוך מסחר" מפושטת (לא מודל סטטיסטי מדויק, ר' דיסקליימר ב-Tools.tsx):
 * RoR = ((1-edge)/(1+edge))^units, edge = winRate-lossRate, units = accountSize/riskPerTrade
 * (כמה טריידי הפסד-מקסימלי רצופים לוקח לאפס את החשבון). מניחה טריידים בלתי-תלויים וסיכון
 * קבוע בכל טרייד - הנחות שלא תמיד מתקיימות במסחר אמיתי. מחזיר שבר עשרוני 0-1 (לא אחוז),
 * תמיד בטווח [0,1] - קלאמפ במקום NaN/Infinity/מספר גדול-מ-100% במקרי קצה (edge<=-1 הרס
 * ודאי; קלט לא תקין ל-accountSize/riskPerTrade גם מוחזר כ-1, "לא ניתן לחשב בבטחון").
 */
export function calculateRiskOfRuin({ winRate, lossRate, accountSize, riskPerTrade }: RiskOfRuinInput): number {
  if (!Number.isFinite(accountSize) || accountSize <= 0 || !Number.isFinite(riskPerTrade) || riskPerTrade <= 0) {
    return 1
  }

  const edge = winRate - lossRate
  if (edge <= -1) return 1

  const units = accountSize / riskPerTrade
  const base = (1 - edge) / (1 + edge)
  if (base <= 0) return 0

  const ror = Math.pow(base, units)
  if (!Number.isFinite(ror)) return 1
  return Math.min(1, Math.max(0, ror))
}
