/**
 * לוגיקה טהורה לבחירת אילו סימבולי מדדים מוצגים במסך "בית", מקובצים לפי סוג נכס.
 * מופרד מ-Home.tsx כדי שאפשר לבדוק ב-Vitest בלי לרנדר קומפוננטה. מאז שלב A בתוכנית
 * ה-redesign - קבוע לכולם (הוסרה התלות בסגנון ה-workspace, שנמחק לגמרי מהזרימה).
 */
export type StockIndexSymbol = 'SPY' | 'QQQ' | 'DIA' | 'IWM'
export type CommoditySymbol = 'UUP' | 'USO' | 'GLD' | 'SLV'
export type BondSymbol = 'TLT' | 'IEF'

const INDEX_SYMBOLS: readonly StockIndexSymbol[] = ['SPY', 'QQQ', 'DIA', 'IWM']
const COMMODITY_SYMBOLS: readonly CommoditySymbol[] = ['UUP', 'USO', 'GLD', 'SLV']
const BOND_SYMBOLS: readonly BondSymbol[] = ['TLT', 'IEF']

/** אילו מדדי מניות להציג בקבוצת "Indices" - הסט המלא, זהה לכל המשתמשים. */
export function getStockIndexSymbols(): readonly StockIndexSymbol[] {
  return INDEX_SYMBOLS
}

/** אילו ETF-י סחורות/דולר להציג בקבוצת "Commodities & Dollar". */
export function getCommoditySymbols(): readonly CommoditySymbol[] {
  return COMMODITY_SYMBOLS
}

/** אילו ETF-י אג"ח להציג בקבוצת "Bonds". */
export function getBondSymbols(): readonly BondSymbol[] {
  return BOND_SYMBOLS
}
