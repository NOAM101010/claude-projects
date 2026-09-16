// exchange-rate: מחזירה שער חליפין היסטורי (date+from+to), עם קאש משותף בין כל
// החשבונות ב-exchange_rate_cache. verify_jwt נשאר true (ברירת המחדל) - רק לקוחות עם
// access token תקף (מ-demo-start/redeem) יכולים לקרוא, בדיוק כמו market-indices/
// watchlist-prices. זו הפונקציה היחידה שכותבת ל-exchange_rate_cache: ראה
// 020_exchange_rate_cache_lockdown.sql - ה-INSERT/UPDATE policies הפתוחות ללקוח הוסרו
// בגלל שכל authenticated (כולל דמו חינמי) יכול היה לכתוב rate שרירותי ולהציג P&L
// מומר שגוי לכל שאר המשתמשים. הכתיבה כאן עוברת עם service role (עוקף RLS) בלבד.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

interface RequestBody {
  date?: string
  from?: string
  to?: string
}

interface FrankfurterResponse {
  rates?: Record<string, number>
}

/** שולף שער חליפין היסטורי מ-Frankfurter (API חינמי, בלי מפתח) - אותה לוגיקת פענוח
 * בדיוק כמו ה-fetchRateFromApi הישן בצד לקוח (src/lib/exchangeRates.ts), רק שעכשיו
 * רץ בצד שרת. `date` בפורמט YYYY-MM-DD. */
async function fetchRateFromApi(date: string, from: string, to: string): Promise<number> {
  const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`)
  if (!res.ok) throw new Error(`Failed to fetch exchange rate (${res.status})`)
  const data = (await res.json()) as FrankfurterResponse
  const rate = data.rates?.[to]
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No valid exchange rate found from ${from} to ${to} on ${date}`)
  }
  return rate
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST' && req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('חסרים secrets: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY')

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const { date, from, to } = body
    if (!date || !from || !to) {
      return jsonResponse({ error: 'חסרים שדות: date/from/to' }, 400)
    }

    if (from === to) return jsonResponse({ rate: 1 })

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: cached, error: readError } = await admin
      .from('exchange_rate_cache')
      .select('rate')
      .eq('date', date)
      .eq('from_currency', from)
      .eq('to_currency', to)
      .maybeSingle()
    if (readError) throw readError
    if (cached) return jsonResponse({ rate: (cached as { rate: number }).rate })

    const rate = await fetchRateFromApi(date, from, to)

    // upsert בשקט - כשל בשמירה לקאש לא אמור לשבור את התשובה החיה שכבר יש לנו ללקוח.
    const { error: writeError } = await admin
      .from('exchange_rate_cache')
      .upsert({ date, from_currency: from, to_currency: to, rate, fetched_at: new Date().toISOString() })
    if (writeError) console.error('exchange-rate: failed to write cache', writeError)

    return jsonResponse({ rate })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
