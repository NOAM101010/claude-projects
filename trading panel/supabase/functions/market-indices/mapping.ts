// לוגיקה טהורה של market-indices (מיפוי תגובת Finnhub + cache עם TTL) - מופרדת מ-index.ts
// כדי שאפשר לבדוק אותה ב-Vitest בלי להריץ Deno.serve (index.ts קורא לו ב-top level, מה
// שדורש את ה-Deno global שלא קיים בזמן ריצת הטסטים).

// DIA (Dow Jones ETF) ו-IWM (Russell 2000, מניות קטנות) נוספו כדי לתת לסוחר תמונה רחבה
// יותר מ-SPY/QQQ בלבד - עדיין קריאה אחת ל-Finnhub עם cache משותף, ראה index.ts.
export const SYMBOLS = ['SPY', 'QQQ', 'VIX', 'DIA', 'IWM', 'UUP', 'USO', 'GLD', 'SLV', 'TLT', 'IEF'] as const
export type Symbol = (typeof SYMBOLS)[number]

// VIX לרוב לא נגיש כ-'VIX' רגיל בתוכנית החינמית של Finnhub - מנסים גם '^VIX'.
// UUP/USO/GLD/SLV/TLT/IEF הם ETF-י proxy (ל-Finnhub החינמי אין commodities/FX/bond-yield
// ישירים) - הסימבול ב-Finnhub זהה לטיקר עצמו, בלי צורך במיפוי מיוחד כמו VIX.
export const FINNHUB_SYMBOL: Record<Symbol, string> = {
  SPY: 'SPY',
  QQQ: 'QQQ',
  VIX: '^VIX',
  DIA: 'DIA',
  IWM: 'IWM',
  UUP: 'UUP',
  USO: 'USO',
  GLD: 'GLD',
  SLV: 'SLV',
  TLT: 'TLT',
  IEF: 'IEF',
}

// 11 ETF סקטוריאליים (SPDR select sector) למפת החום - הסימבול ב-Finnhub זהה לטיקר עצמו,
// בלי צורך במיפוי כמו VIX.
export const SECTOR_ETFS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'] as const
export type SectorEtf = (typeof SECTOR_ETFS)[number]

export interface IndexQuote {
  price: number
  changePercent: number
}

export interface SectorQuote {
  etf: SectorEtf
  changePercent: number | null
}

export interface MarketIndicesResponse {
  spy: IndexQuote | null
  qqq: IndexQuote | null
  vix: IndexQuote | null
  dia: IndexQuote | null
  iwm: IndexQuote | null
  // כל השדות הבאים הם ETF proxy, לא המחיר/מדד ה"אמיתי" - ראה השם באנגלית ב-Home.tsx
  // שתמיד מציג גם את קוד ה-ETF (למשל "Gold (GLD)") כדי לא ליצור רושם מטעה של דיוק/סמכות.
  dxy: IndexQuote | null // UUP - proxy למדד הדולר
  oil: IndexQuote | null // USO - proxy לנפט גולמי
  gold: IndexQuote | null // GLD - proxy לזהב
  silver: IndexQuote | null // SLV - proxy לכסף
  bondLong: IndexQuote | null // TLT - אג"ח ארוך טווח (20+ שנה)
  bondMid: IndexQuote | null // IEF - אג"ח בינוני טווח (7-10 שנה)
  sectors: SectorQuote[]
  fetchedAt: string
  /** true אם זו לא תשובה חיה מ-Finnhub אלא ה-snapshot האחרון שהצליח, נשלף מ-market_data_cache
   * כי הקריאה החיה נכשלה/rate-limited. fetchedAt נשאר הזמן המקורי של אותו snapshot. */
  stale?: boolean
}

export interface FinnhubQuote {
  c?: number // current price
  dp?: number // percent change
}

/** ממפה תגובת quote גולמית של Finnhub למבנה הפנימי. מחזירה null אם השדות החיוניים חסרים/0. */
export function mapFinnhubQuote(data: FinnhubQuote | null | undefined): IndexQuote | null {
  if (!data || typeof data.c !== 'number' || data.c === 0) return null
  return { price: data.c, changePercent: typeof data.dp === 'number' ? data.dp : 0 }
}

/** כמו mapFinnhubQuote אבל למפת החום - צריכים רק את אחוז השינוי, null אם הסימבול לא זמין. */
export function mapSectorQuote(etf: SectorEtf, data: FinnhubQuote | null | undefined): SectorQuote {
  const quote = mapFinnhubQuote(data)
  return { etf, changePercent: quote ? quote.changePercent : null }
}

/** true אם כל שדה המדד המרכזי חזר null - כשל מלא (רשת/rate-limit), לא רק כמה סימבולים
 * לא זמינים בתוכנית החינמית. תואם ל-isIndicesFullyFailed ב-src/hooks/useMarketData.ts
 * בצד הלקוח - אותו קריטריון בדיוק, כאן משמש כדי להחליט מתי ליפול חזרה ל-DB snapshot. */
export function isIndicesResponseFailed(body: MarketIndicesResponse): boolean {
  return (
    !body.spy &&
    !body.qqq &&
    !body.vix &&
    !body.dia &&
    !body.iwm &&
    !body.dxy &&
    !body.oil &&
    !body.gold &&
    !body.silver &&
    !body.bondLong &&
    !body.bondMid
  )
}

/**
 * Cache בזיכרון עם TTL קבוע, שעון ניתן להזרקה (`now`) לצורך בדיקה דטרמיניסטית -
 * ב-index.ts נקרא עם `Date.now` האמיתי.
 */
export class IndicesCache {
  private entry: { body: MarketIndicesResponse; expiresAt: number } | null = null

  constructor(private readonly ttlMs: number) {}

  get(now: number): MarketIndicesResponse | null {
    if (!this.entry || this.entry.expiresAt < now) return null
    return this.entry.body
  }

  set(body: MarketIndicesResponse, now: number): void {
    this.entry = { body, expiresAt: now + this.ttlMs }
  }
}
