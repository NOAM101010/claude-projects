// Cache per-symbol (module-level, TTL 2 דקות) לשימוש משותף ע"י watchlist-prices +
// check-price-alerts (Phase F): אם כמה משתמשים עוקבים אחרי אותו טיקר, זה מבטיח קריאת
// Finnhub אחת בלבד לחלון הזמן לכל סימבול, לא אחת לכל משתמש - שומר על מכסת 60/דקה
// של התוכנית החינמית לצד ה-22 קריאות שכבר צורכת market-indices. שונה במכוון מ-
// market-indices/mapping.ts's IndicesCache (זו מטמון per-response קבוע-סימבולים,
// זו כאן dynamic per-symbol כי סימבולי ה-watchlist נקבעים ע"י המשתמשים).
const TTL_MS = 120_000

export interface CachedQuote {
  price: number
  changePercent: number
}

interface CacheEntry {
  quote: CachedQuote | null
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<CachedQuote | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { c?: number; dp?: number }
    if (typeof data.c !== 'number' || data.c === 0) return null
    return { price: data.c, changePercent: typeof data.dp === 'number' ? data.dp : 0 }
  } catch {
    return null
  }
}

/** מחיר לסימבול בודד - `now` ניתן להזרקה לצורך בדיקה דטרמיניסטית, ברירת מחדל Date.now האמיתי. */
export async function getQuoteForSymbol(symbol: string, apiKey: string, now: number = Date.now()): Promise<CachedQuote | null> {
  const upper = symbol.toUpperCase()
  const cached = cache.get(upper)
  if (cached && cached.expiresAt > now) return cached.quote
  const quote = await fetchFinnhubQuote(upper, apiKey)
  cache.set(upper, { quote, expiresAt: now + TTL_MS })
  return quote
}

/** מחירים לקבוצת סימבולים (מסננת כפילויות פנימית - קריאה אחת לכל סימבול ייחודי). */
export async function getQuotesForSymbols(
  symbols: string[],
  apiKey: string,
  now: number = Date.now(),
): Promise<Record<string, CachedQuote | null>> {
  const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
  const entries = await Promise.all(uniqueSymbols.map(async (s): Promise<[string, CachedQuote | null]> => [s, await getQuoteForSymbol(s, apiKey, now)]))
  return Object.fromEntries(entries)
}
