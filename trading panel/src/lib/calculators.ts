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
