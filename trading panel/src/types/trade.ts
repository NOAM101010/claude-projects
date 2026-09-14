export type Direction = 'long' | 'short'

/** רשימה ממוקדת לקהל דובר אנגלית, לפי trading-journal-plan.md סעיף 3/5 */
export const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'NZD', 'ILS'] as const

export type CurrencyCode = (typeof CURRENCIES)[number]

/**
 * ה-setup של הטרייד (תבנית הכניסה), לפילוח בדשבורד. אופציונלי - טריידים ישנים יכולים
 * להישאר בלעדיו. רשימה קבועה של ~25 setups מוכרים - `SetupPicker.tsx` מציג אותה עם
 * חיפוש, אבל `Setup` הוא `string` חופשי כדי שערכים ישנים שלא ברשימה (למשל 'Forex'/'אחר'
 * מהגרסה הקודמת של השדה) ימשיכו להישמר ולהיות מוצגים כטקסט חופשי בלי מיגרציה.
 */
export const SETUPS = [
  'Breakout',
  'Pullback',
  'Gap and Go',
  'Cup and Handle',
  'Bull Flag',
  'Bear Flag',
  'VWAP Bounce',
  'Opening Range Breakout',
  'Support/Resistance Bounce',
  'Trendline Break',
  'Double Top',
  'Double Bottom',
  'Head and Shoulders',
  'Fibonacci Retracement',
  'Moving Average Crossover',
  'Earnings Play',
  'News Momentum',
  'Short Squeeze',
  'Reversal',
  'Range Trade',
  'Wedge',
  'Triangle',
  'Channel',
  'First Pullback',
  'ABCD Pattern',
  'Inside Bar',
] as const

export type Setup = string

/**
 * טרייד בודד. exitAt/exitPrice/pnl הם null כל עוד הפוזיציה פתוחה.
 * pnl מחושב ונשמר בזמן שמירת הטופס (לא נגזר מחדש אוטומטית אחר כך) -
 * כך ששינויים עתידיים בשער המרה/מטבע בסיס בדשבורד לא "יזיזו" אותו רטרואקטיבית.
 */
export interface Trade {
  id: string
  symbol: string
  direction: Direction
  entryAt: string // ISO 8601
  entryPrice: number
  quantity: number
  stopLoss: number | null
  takeProfit: number | null
  exitAt: string | null // ISO 8601
  exitPrice: number | null
  pnl: number | null
  currency: CurrencyCode
  fee: number | null
  notes: string
  setup?: Setup
  /** נתיב הקובץ ב-Supabase Storage (bucket `chart-images`, לא ה-URL הציבורי - ה-bucket פרטי, גישה רק דרך signed URL). undefined/null = אין תמונה. */
  chartImageUrl?: string | null
}

/** שדות שהטופס עורך; ה-id מנוהל בנפרד (חדש מקבל UUID, עריכה שומרת את הקיים). */
export type TradeInput = Omit<Trade, 'id'>
