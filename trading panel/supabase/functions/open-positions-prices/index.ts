// open-positions-prices: מחזירה מחירים חיים לסימבולים של הטריידים הפתוחים (exit_at IS NULL)
// של ה-account המחובר **בלבד**. אותו דפוס אבטחה בדיוק כמו watchlist-prices: לא מקבלת
// רשימת סימבולים מהקליינט - שולפת אותה בעצמה מטבלת trades לפי ה-account_id שב-JWT.
// verify_jwt נשאר true (כמו send-test-push/market-indices/watchlist-prices - רק
// check-price-alerts, שרץ מ-cron ולא מבקשת דפדפן, כבויה).
//
// למה פונקציה נפרדת ולא watchlist-prices עם פרמטר "מקור"? שתי הפונקציות נראות דומות
// (JWT -> שאילתת טבלה בבעלות ה-account -> getQuotesForSymbols) אבל שולפות מטבלאות
// שונות (watchlist מול trades) עם תנאי סינון שונה לגמרי - איחוד שלהן היה דורש פרמטר
// שקובע איזו טבלה/עמודות לשלוף, מה שהופך פונקציה אחת קטנה ופשוטה לבדיקה לשתי פונקציות
// עם ענפים פנימיים. הפרדה שומרת על כל פונקציה עם סיפור RLS/אבטחה עצמאי, קל לביקורת
// בנפרד - בדיוק כמו ש-market-indices לא מוזגה לתוך watchlist-prices בזמנו למרות
// ששתיהן "רק קוראות ל-Finnhub ומחזירות quotes".
//
// Cache per-symbol (TTL 2 דקות) משותף עם watchlist-prices/check-price-alerts דרך
// _shared/finnhubCache.ts - אם כמה משתמשים/תכונות עוקבים אחרי אותו טיקר, רק קריאת
// Finnhub אחת ל-2 דקות לכל סימבול.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { decodeJwtSub } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'
import { getQuotesForSymbols } from '../_shared/finnhubCache.ts'

interface OpenTradeRow {
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
    // exit_at IS NULL = פוזיציה פתוחה (ראה types/trade.ts + 001_init_schema.sql) -
    // אותו קריטריון בדיוק כמו `pnl === null` בצד קליינט (tradesApi.ts/stats.ts).
    const { data: rows, error } = await admin
      .from('trades')
      .select('symbol')
      .eq('account_id', accountId)
      .is('exit_at', null)
    if (error) throw error

    const symbols = Array.from(new Set(((rows ?? []) as OpenTradeRow[]).map((r) => r.symbol)))
    const quotes = symbols.length > 0 ? await getQuotesForSymbols(symbols, apiKey) : {}

    return jsonResponse({ quotes, fetchedAt: new Date().toISOString() })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
