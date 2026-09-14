// market-indices: מחזירה מחירים חיים (SPY, QQQ, VIX, DIA, IWM + ETF proxy לזהב/כסף/נפט/דולר/אג"ח)
// מ-Finnhub עבור כרטיס "מדדים" ב-Home. verify_jwt נשאר true (ברירת המחדל) - רק לקוחות עם
// access token תקף (מ-demo-start/redeem) יכולים לקרוא, בדיוק כמו send-test-push. המפתח
// FINNHUB_API_KEY הוא secret בצד שרת בלבד - לעולם לא חוזר ללקוח, ולעולם לא נקרא ישירות מהדפדפן.
//
// Caching בזיכרון (module-level, לא DB, ראה mapping.ts): כל הבקשות בתוך TTL_MS מקבלות
// את אותה תשובה שמורה, בלי לקרוא שוב ל-Finnhub - הכרחי כי התוכנית החינמית מוגבלת ל-60
// קריאות/דקה ואנחנו לא רוצים לצרוך 22 קריאות (11 סימבולים ראשיים + 11 סקטורים) לכל
// משתמש שפותח את האתר בו-זמנית. ה-cache חי כל עוד ה-instance של הפונקציה חם - אם
// ה-instance מתחלף הוא פשוט מתאפס, זה תקין.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'
import {
  FINNHUB_SYMBOL,
  IndicesCache,
  SECTOR_ETFS,
  SYMBOLS,
  mapFinnhubQuote,
  mapSectorQuote,
  type FinnhubQuote,
  type MarketIndicesResponse,
} from './mapping.ts'

const INDEX_FIELDS = ['spy', 'qqq', 'vix', 'dia', 'iwm', 'dxy', 'oil', 'gold', 'silver', 'bondLong', 'bondMid'] as const

/**
 * ממזג שדה-שדה (לא הכל-או-כלום): כל שדה שחזר null מהקריאה החיה (סימבול בודד שנתקל
 * ב-rate-limit, לא בהכרח כל התשובה) מתמלא מה-snapshot האחרון שהצליח, במקום להראות
 * "N/A" בכרטיס בודד בזמן שכל שאר הכרטיסים מלאים. `stale` מסומן רק אם משהו באמת
 * הושלם מה-fallback - תשובה טרייה לגמרי לא מסומנת stale.
 */
function mergeWithLastGood(body: MarketIndicesResponse, lastGood: MarketIndicesResponse | null): MarketIndicesResponse {
  if (!lastGood) return body
  let usedFallback = false
  const merged = { ...body }
  for (const field of INDEX_FIELDS) {
    if (merged[field] === null && lastGood[field] !== null) {
      merged[field] = lastGood[field]
      usedFallback = true
    }
  }
  merged.sectors = body.sectors.map((sector, i) => {
    if (sector.changePercent !== null) return sector
    const fallbackSector = lastGood.sectors[i]
    if (fallbackSector && fallbackSector.etf === sector.etf && fallbackSector.changePercent !== null) {
      usedFallback = true
      return fallbackSector
    }
    return sector
  })
  return usedFallback ? { ...merged, stale: true } : merged
}

const TTL_MS = 45_000
const cache = new IndicesCache(TTL_MS)
const DB_CACHE_KEY = 'indices'

/** snapshot האחרון שהצליח, נשמר ב-market_data_cache (טבלה בלי RLS ציבורי, רק service role
 * נוגע בה) - עמיד להחלפת instance של הפונקציה בין קריאות, בניגוד ל-IndicesCache בזיכרון. */
async function loadLastGoodSnapshot(
  admin: ReturnType<typeof createClient>,
): Promise<MarketIndicesResponse | null> {
  const { data, error } = await admin
    .from('market_data_cache')
    .select('payload')
    .eq('key', DB_CACHE_KEY)
    .maybeSingle()
  if (error || !data) return null
  return data.payload as MarketIndicesResponse
}

async function saveGoodSnapshot(admin: ReturnType<typeof createClient>, body: MarketIndicesResponse): Promise<void> {
  // upsert בשקט - כשל בשמירת ה-snapshot לא אמור לשבור את התשובה החיה שכבר יש לנו ללקוח.
  const { error } = await admin
    .from('market_data_cache')
    .upsert({ key: DB_CACHE_KEY, payload: body, updated_at: new Date().toISOString() })
  if (error) console.error('market-indices: failed to save DB snapshot', error)
}

async function fetchQuote(symbol: string, apiKey: string): Promise<FinnhubQuote | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as FinnhubQuote
  } catch {
    return null
  }
}

async function buildResponse(apiKey: string): Promise<MarketIndicesResponse> {
  const [[spy, qqq, vix, dia, iwm, uup, uso, gld, slv, tlt, ief], sectorQuotes] = await Promise.all([
    Promise.all(SYMBOLS.map((s) => fetchQuote(FINNHUB_SYMBOL[s], apiKey))),
    Promise.all(SECTOR_ETFS.map((etf) => fetchQuote(etf, apiKey))),
  ])
  return {
    spy: mapFinnhubQuote(spy),
    qqq: mapFinnhubQuote(qqq),
    vix: mapFinnhubQuote(vix),
    dia: mapFinnhubQuote(dia),
    iwm: mapFinnhubQuote(iwm),
    dxy: mapFinnhubQuote(uup),
    oil: mapFinnhubQuote(uso),
    gold: mapFinnhubQuote(gld),
    silver: mapFinnhubQuote(slv),
    bondLong: mapFinnhubQuote(tlt),
    bondMid: mapFinnhubQuote(ief),
    sectors: SECTOR_ETFS.map((etf, i) => mapSectorQuote(etf, sectorQuotes[i])),
    fetchedAt: new Date().toISOString(),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST' && req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const apiKey = Deno.env.get('FINNHUB_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!apiKey) throw new Error('חסר secret: FINNHUB_API_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('חסרים secrets: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const now = Date.now()
    let body = cache.get(now)
    if (!body) {
      const fresh = await buildResponse(apiKey)
      const lastGood = await loadLastGoodSnapshot(admin)
      body = mergeWithLastGood(fresh, lastGood)
      cache.set(body, now)
      // שומרים תמיד את הגרסה הממוזגת (הכי-עדכני-לכל-שדה), לא רק ב"הצלחה מלאה" - כך
      // שדה שהצליח היום אבל נכשל אתמול עדיין מתעדכן ב-DB, וסימבול שנכשל היום שומר על
      // הערך הקודם שלו בלי לדרוס אותו ב-null.
      await saveGoodSnapshot(admin, body)
    }

    return jsonResponse(body)
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
