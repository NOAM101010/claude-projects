/**
 * מחירי קריפטו חיים מ-CoinGecko הציבורי - בלי מפתח API, בלי הרשמה. משמש רק ב-Home.tsx
 * ל-workspace עם style='Crypto'. Cache/רענון (setInterval כל דקה) הם באחריות הקורא -
 * הפונקציה כאן טהורה מבחינת state, רק מבצעת קריאת רשת אחת ומחזירה/זורקת.
 *
 * מדדי מניות (SPY/QQQ/VIX) שונים: המקור (Finnhub) דורש מפתח API, אז הקריאה עוברת דרך
 * Edge Function (`market-indices`) שמחזיקה את המפתח בצד שרת בלבד - ראה fetchStockIndices.
 */
import { getSupabase } from './supabase'

// 5 מטבעות (BTC/ETH/SOL/XRP/BNB) - עדיין קריאה ציבורית אחת, בלי מפתח.
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin&vs_currencies=usd&include_24hr_change=true'

export interface CryptoPrice {
  usd: number
  usd24hChange: number
}

export interface CryptoPrices {
  bitcoin: CryptoPrice
  ethereum: CryptoPrice
  solana: CryptoPrice
  ripple: CryptoPrice
  binancecoin: CryptoPrice
}

interface CoinGeckoCoin {
  usd?: number
  usd_24h_change?: number
}

interface CoinGeckoResponse {
  bitcoin?: CoinGeckoCoin
  ethereum?: CoinGeckoCoin
  solana?: CoinGeckoCoin
  ripple?: CoinGeckoCoin
  binancecoin?: CoinGeckoCoin
}

const CRYPTO_IDS = ['bitcoin', 'ethereum', 'solana', 'ripple', 'binancecoin'] as const

/** ממפה תגובת CoinGecko גולמית לטיפוס שלנו. טהורה - מכוסה ב-Vitest בלי רשת אמיתית. */
export function mapCoinGeckoResponse(data: CoinGeckoResponse): CryptoPrices {
  for (const id of CRYPTO_IDS) {
    if (typeof data[id]?.usd !== 'number') throw new Error('Unexpected CoinGecko response shape')
  }
  const toPrice = (id: (typeof CRYPTO_IDS)[number]): CryptoPrice => ({
    usd: data[id]!.usd as number,
    usd24hChange: data[id]!.usd_24h_change ?? 0,
  })
  return {
    bitcoin: toPrice('bitcoin'),
    ethereum: toPrice('ethereum'),
    solana: toPrice('solana'),
    ripple: toPrice('ripple'),
    binancecoin: toPrice('binancecoin'),
  }
}

/**
 * שולף מחירי BTC/ETH חיים. זורק אם הבקשה נכשלה (רשת/rate-limit) או שהתגובה לא
 * בפורמט הצפוי - הקורא (Home.tsx) אחראי לתפוס ולהציג מצב "לא זמין" בעדינות.
 */
export async function fetchCryptoPrices(): Promise<CryptoPrices> {
  const res = await fetch(COINGECKO_URL)
  if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status}`)
  const data = (await res.json()) as CoinGeckoResponse
  return mapCoinGeckoResponse(data)
}

export interface IndexQuote {
  price: number
  changePercent: number
}

/** 11 ETF סקטוריאליים (SPDR select sector) למפת החום - ראה supabase/functions/market-indices/mapping.ts. */
export const SECTOR_ETFS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'] as const
export type SectorEtf = (typeof SECTOR_ETFS)[number]

export interface SectorQuote {
  etf: SectorEtf
  changePercent: number | null
}

export interface StockIndices {
  spy: IndexQuote | null
  qqq: IndexQuote | null
  vix: IndexQuote | null
  dia: IndexQuote | null
  iwm: IndexQuote | null
  // ETF proxy - ראה הערה מקבילה ב-supabase/functions/market-indices/mapping.ts.
  dxy: IndexQuote | null
  oil: IndexQuote | null
  gold: IndexQuote | null
  silver: IndexQuote | null
  bondLong: IndexQuote | null
  bondMid: IndexQuote | null
  sectors: SectorQuote[]
}

const EMPTY_STOCK_INDICES: StockIndices = {
  spy: null,
  qqq: null,
  vix: null,
  dia: null,
  iwm: null,
  dxy: null,
  oil: null,
  gold: null,
  silver: null,
  bondLong: null,
  bondMid: null,
  sectors: [],
}

/**
 * שולף מדדים+ETF-proxy חיים דרך ה-Edge Function `market-indices` (לא קריאה ישירה
 * ל-Finnhub - המפתח נשאר בצד שרת). לא זורקת: אם ה-invoke נכשל (רשת/הרשאה) או שהתגובה
 * לא תקינה, מחזירה את כל השדות כ-null כדי שהקורא יציג "לא זמין" בעדינות לכל מדד
 * בנפרד (Finnhub לפעמים מחזיר null רק לחלק מהסימבולים בתוכנית החינמית).
 */
export async function fetchStockIndices(): Promise<StockIndices> {
  try {
    const { data, error } = await getSupabase().functions.invoke<StockIndices>('market-indices')
    if (error || !data) return EMPTY_STOCK_INDICES
    return {
      spy: data.spy ?? null,
      qqq: data.qqq ?? null,
      vix: data.vix ?? null,
      dia: data.dia ?? null,
      iwm: data.iwm ?? null,
      dxy: data.dxy ?? null,
      oil: data.oil ?? null,
      gold: data.gold ?? null,
      silver: data.silver ?? null,
      bondLong: data.bondLong ?? null,
      bondMid: data.bondMid ?? null,
      sectors: data.sectors ?? [],
    }
  } catch {
    return EMPTY_STOCK_INDICES
  }
}

const FEAR_GREED_URL = 'https://api.alternative.me/fng/?limit=1'

export type FearGreedClassification = 'extremeFear' | 'fear' | 'neutral' | 'greed' | 'extremeGreed'

export interface FearGreedIndex {
  value: number
  classification: FearGreedClassification
}

interface FearGreedApiResponse {
  data?: Array<{ value?: string }>
}

/** מדרג ערך 0-100 לסיווג סנטימנט - טווחים מקובלים של מדד Fear & Greed הקריפטו. */
export function classifyFearGreedValue(value: number): FearGreedClassification {
  if (value <= 24) return 'extremeFear'
  if (value <= 44) return 'fear'
  if (value <= 55) return 'neutral'
  if (value <= 75) return 'greed'
  return 'extremeGreed'
}

/** ממפה תגובת alternative.me גולמית לטיפוס שלנו. מחזירה null אם הצורה לא תקינה. */
export function mapFearGreedResponse(data: FearGreedApiResponse | null | undefined): FearGreedIndex | null {
  const raw = data?.data?.[0]?.value
  const value = typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(value)) return null
  return { value, classification: classifyFearGreedValue(value) }
}

/**
 * שולף את מדד ה-Fear & Greed הקריפטו (סנטימנט ציבורי, לא סיגנל מסחר) מ-API הציבורי
 * החינמי של alternative.me - בלי מפתח. לא זורקת: כל כשל (רשת/פורמט) מחזיר null כדי
 * שהקורא יציג "לא זמין" בעדינות, בדיוק כמו fetchStockIndices/fetchCryptoPrices.
 */
export async function fetchFearGreedIndex(): Promise<FearGreedIndex | null> {
  try {
    const res = await fetch(FEAR_GREED_URL)
    if (!res.ok) return null
    const data = (await res.json()) as FearGreedApiResponse
    return mapFearGreedResponse(data)
  } catch {
    return null
  }
}

export interface WatchlistQuote {
  price: number
  changePercent: number
}

interface WatchlistPricesResponse {
  quotes: Record<string, WatchlistQuote | null>
}

/**
 * שולפת מחירים חיים לסימבולי ה-watchlist של החשבון המחובר, דרך `watchlist-prices`
 * (הפונקציה שולפת את רשימת הסימבולים בעצמה מה-DB - לא נשלחת מכאן, ראה index.ts שם).
 * לא זורקת: כשל מחזיר מפה ריקה כדי שהקורא יציג "לא זמין" בעדינות לכל סימבול בנפרד.
 */
export async function fetchWatchlistPrices(): Promise<Record<string, WatchlistQuote | null>> {
  try {
    const { data, error } = await getSupabase().functions.invoke<WatchlistPricesResponse>('watchlist-prices')
    if (error || !data) return {}
    return data.quotes ?? {}
  } catch {
    return {}
  }
}
