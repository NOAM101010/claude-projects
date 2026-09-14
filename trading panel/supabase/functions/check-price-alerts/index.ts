// check-price-alerts: מופעלת ע"י pg_cron כל ~2 דקות (ראה supabase/functions/README.md
// להוראות הגדרה מדויקות בדשבורד - לא רץ אוטומטית, המשתמש חייב להגדיר ידנית).
//
// טוענת את כל שורות watchlist הפעילות, שולפת מחירים עדכניים (cache per-symbol משותף
// עם watchlist-prices דרך _shared/finnhubCache.ts - אותו חלון TTL, אז אם משתמש כבר
// פתח את מסך ה-Watchlist לאחרונה הקריאה הזו לרוב "בחינם"), ומשווה direction/target_price.
// כל alert שנחצה: שולחת push דרך _shared/push.ts ומסמנת active=false+triggered_at
// (לא מוחקת - נשמר להיסטוריה, כמו שאר האפליקציה לא מוחקת רשומות בשקט).
//
// **אימות שונה משאר הפונקציות:** net.http_post של pg_cron לא נושא JWT משתמש, אז
// verify_jwt חייב להיות false עבור הפונקציה הזו (להגדיר ידנית בדשבורד - Edge Functions
// → check-price-alerts → כבות "Verify JWT", בדיוק כמו demo-start/redeem). האימות היחיד
// כאן הוא header ייעודי מול secret נפרד (CRON_SECRET) - לא APP_JWT_SECRET/VAPID.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'
import { getQuotesForSymbols } from '../_shared/finnhubCache.ts'
import { sendPushToAccount } from '../_shared/push.ts'

interface WatchlistRow {
  id: string
  account_id: string
  symbol: string
  target_price: number
  direction: 'above' | 'below'
}

function isCrossed(direction: 'above' | 'below', target: number, current: number): boolean {
  return direction === 'above' ? current >= target : current <= target
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('FINNHUB_API_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!supabaseUrl || !serviceRoleKey || !apiKey || !cronSecret) {
      throw new Error('חסרים secrets: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/FINNHUB_API_KEY/CRON_SECRET')
    }

    if (req.headers.get('X-Cron-Secret') !== cronSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: rows, error } = await admin
      .from('watchlist')
      .select('id, account_id, symbol, target_price, direction')
      .eq('active', true)
    if (error) throw error

    const alerts = (rows ?? []) as WatchlistRow[]
    if (alerts.length === 0) return jsonResponse({ checked: 0, triggered: 0 })

    const quotes = await getQuotesForSymbols(
      alerts.map((a) => a.symbol),
      apiKey,
    )

    let triggered = 0
    const now = new Date().toISOString()

    for (const alert of alerts) {
      const quote = quotes[alert.symbol.toUpperCase()]
      if (!quote) continue
      if (!isCrossed(alert.direction, alert.target_price, quote.price)) continue

      const directionLabel = alert.direction === 'above' ? 'above' : 'below'
      await sendPushToAccount(admin, alert.account_id, {
        title: `${alert.symbol} price alert`,
        body: `${alert.symbol} is now $${quote.price.toFixed(2)} (${directionLabel} your target of $${alert.target_price.toFixed(2)})`,
      })

      const { error: updateError } = await admin
        .from('watchlist')
        .update({ active: false, triggered_at: now })
        .eq('id', alert.id)
      if (updateError) throw updateError

      triggered += 1
    }

    return jsonResponse({ checked: alerts.length, triggered })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
