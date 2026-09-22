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

export interface ScaleInInput {
  existingEntryPrice: number
  existingQuantity: number
  addPrice: number
  addQuantity: number
}

export interface ScaleInResult {
  newAveragePrice: number
  newTotalQuantity: number
}

/**
 * ממוצע-משוקלל אחרי הוספה לפוזיציה קיימת (Scale-in): newAveragePrice = weighted average
 * של שני המחירים לפי הכמויות. מחזיר אפסים אם הקלט לא תקין (כמויות/מחירים לא חיוביים/NaN).
 */
export function calculateScaleIn({ existingEntryPrice, existingQuantity, addPrice, addQuantity }: ScaleInInput): ScaleInResult {
  if (
    !Number.isFinite(existingEntryPrice) ||
    !Number.isFinite(existingQuantity) ||
    !Number.isFinite(addPrice) ||
    !Number.isFinite(addQuantity) ||
    existingEntryPrice <= 0 ||
    existingQuantity <= 0 ||
    addPrice <= 0 ||
    addQuantity <= 0
  ) {
    return { newAveragePrice: 0, newTotalQuantity: 0 }
  }

  const newTotalQuantity = existingQuantity + addQuantity
  const newAveragePrice = (existingEntryPrice * existingQuantity + addPrice * addQuantity) / newTotalQuantity

  return { newAveragePrice, newTotalQuantity }
}

export interface ScaleOutInput {
  entryPrice: number
  direction: 'long' | 'short'
  totalQuantity: number
  sellPrice: number
  sellQuantity: number
}

export interface ScaleOutResult {
  realizedPnl: number
  realizedPnlPercent: number
  remainingQuantity: number
}

/**
 * P&L ממומש ביציאה חלקית מפוזיציה (Scale-out) - אותה נוסחה בדיוק כמו `calculatePnl`
 * (Long: (sellPrice-entryPrice)*sellQuantity | Short: הפוך), רק על `sellQuantity` ולא כל
 * הפוזיציה. `remainingQuantity` = מה שנשאר אחרי המכירה. מחזיר אפסים בקלט לא תקין, כולל
 * מכירת כמות גדולה מהפוזיציה כולה (sellQuantity > totalQuantity).
 */
export function calculateScaleOut({ entryPrice, direction, totalQuantity, sellPrice, sellQuantity }: ScaleOutInput): ScaleOutResult {
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(totalQuantity) ||
    !Number.isFinite(sellPrice) ||
    !Number.isFinite(sellQuantity) ||
    entryPrice <= 0 ||
    totalQuantity <= 0 ||
    sellPrice <= 0 ||
    sellQuantity <= 0 ||
    sellQuantity > totalQuantity
  ) {
    return { realizedPnl: 0, realizedPnlPercent: 0, remainingQuantity: 0 }
  }

  const realizedPnl = direction === 'long' ? (sellPrice - entryPrice) * sellQuantity : (entryPrice - sellPrice) * sellQuantity
  const rawPercent = ((sellPrice - entryPrice) / entryPrice) * 100
  const realizedPnlPercent = direction === 'long' ? rawPercent : -rawPercent
  const remainingQuantity = totalQuantity - sellQuantity

  return { realizedPnl, realizedPnlPercent, remainingQuantity }
}

export interface CagrInput {
  startValue: number
  endValue: number
  years: number
}

export interface CagrResult {
  cagrPercent: number
}

/**
 * קצב צמיחה שנתי מצטבר (CAGR) בין שני ערכים אמיתיים לאורך תקופה - מדד ריאלי, לא תחזית
 * עתידית. cagrPercent = ((endValue/startValue)^(1/years) - 1) * 100. מחזיר אפס בקלט לא תקין
 * (startValue/years לא חיוביים, endValue שלילי/NaN).
 */
export function calculateCagr({ startValue, endValue, years }: CagrInput): CagrResult {
  if (
    !Number.isFinite(startValue) ||
    !Number.isFinite(endValue) ||
    !Number.isFinite(years) ||
    startValue <= 0 ||
    endValue < 0 ||
    years <= 0
  ) {
    return { cagrPercent: 0 }
  }

  const cagrPercent = ((endValue / startValue) ** (1 / years) - 1) * 100

  return { cagrPercent }
}

export interface LiquidationPriceInput {
  entryPrice: number
  leverage: number
  direction: 'long' | 'short'
  /** אחוז מרג'ין תחזוקה נוסף (למשל 0.5 = 0.5%). ברירת מחדל 0 אם לא סופק. */
  maintenanceMarginPercent?: number
}

export interface LiquidationPriceResult {
  liquidationPrice: number
  /** כמה אחוז המחיר צריך לזוז מהכניסה כדי להגיע לחיסול - ערך חיובי תמיד. */
  distancePercent: number
}

/**
 * מחיר חיסול משוער לפוזיציה ממונפת - מודל פשוט להערכה בלבד (isolated margin, בלי עמלות/
 * ריבית מימון), לא מחליף את חישוב הבורסה/הברוקר בפועל. Long: entryPrice*(1-1/leverage+
 * maintenanceMarginPercent/100); Short: entryPrice*(1+1/leverage-maintenanceMarginPercent/100).
 * מחזיר אפסים בקלט לא תקין (entryPrice/leverage לא חיוביים).
 */
export function calculateLiquidationPrice({
  entryPrice,
  leverage,
  direction,
  maintenanceMarginPercent,
}: LiquidationPriceInput): LiquidationPriceResult {
  const mmp = maintenanceMarginPercent ?? 0

  if (!Number.isFinite(entryPrice) || !Number.isFinite(leverage) || !Number.isFinite(mmp) || entryPrice <= 0 || leverage <= 0) {
    return { liquidationPrice: 0, distancePercent: 0 }
  }

  const liquidationPrice =
    direction === 'long' ? entryPrice * (1 - 1 / leverage + mmp / 100) : entryPrice * (1 + 1 / leverage - mmp / 100)

  if (!Number.isFinite(liquidationPrice) || liquidationPrice < 0) {
    return { liquidationPrice: 0, distancePercent: 0 }
  }

  const distancePercent = (Math.abs(entryPrice - liquidationPrice) / entryPrice) * 100

  return { liquidationPrice, distancePercent }
}

