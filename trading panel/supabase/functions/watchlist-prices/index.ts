// watchlist-prices: מחזירה מחירים חיים לסימבולים של ה-account המחובר **בלבד**.
// בכוונה לא מקבלת רשימת סימבולים מהקליינט - שולפת אותה בעצמה מטבלת watchlist לפי
// ה-account_id שב-JWT, כדי לא לפתוח וקטור עומס (לקוח לא יכול לבקש מחירים לסימבולים
// שרירותיים בכמות בלתי מוגבלת). verify_jwt נשאר true (כמו send-test-push/market-indices).
//
// Cache per-symbol (TTL 2 דקות) משותף עם check-price-alerts דרך _shared/finnhubCache.ts -
// אם כמה משתמשים עוקבים אחרי אותו טיקר, רק קריאת Finnhub אחת ל-2 דקות לכל סימבול.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { decodeJwtSub } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'
import { getQuotesForSymbols } from '../_shared/finnhubCache.ts'

interface WatchlistRow {
  symbol: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST' && req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('FINNHUB_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      throw new Error('חסרים secrets: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/FINNHUB_API_KEY')
    }

    const accountId = decodeJwtSub(req.headers.get('Authorization'))
    if (!accountId) {
      return jsonResponse({ error: 'לא מזוהה - נדרש Authorization: Bearer <access token>' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: rows, error } = await admin
      .from('watchlist')
      .select('symbol')
      .eq('account_id', accountId)
      .eq('active', true)
    if (error) throw error

    const symbols = ((rows ?? []) as WatchlistRow[]).map((r) => r.symbol)
    const quotes = symbols.length > 0 ? await getQuotesForSymbols(symbols, apiKey) : {}

    return jsonResponse({ quotes, fetchedAt: new Date().toISOString() })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
