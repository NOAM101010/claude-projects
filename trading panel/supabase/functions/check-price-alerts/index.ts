// check-price-alerts: מופעלת ע"י pg_cron כל ~2 דקות (ראה supabase/functions/README.md
// להוראות הגדרה מדויקות בדשבורד - לא רץ אוטומטית, המשתמש חייב להגדיר ידנית).
//
// טוענת את כל שורות watchlist הפעילות, שולפת מחירים עדכניים (cache per-symbol משותף
// עם watchlist-prices דרך _shared/finnhubCache.ts - אותו חלון TTL, אז אם משתמש כבר
// פתח את מסך ה-Watchlist לאחרונה הקריאה הזו לרוב "בחינם"), ומשווה direction/target_price.
// כל alert שנחצה: שולחת push דרך _shared/push.ts, יוצרת גם התראה בתוך האפליקציה
// בטבלת notifications (013_notifications.sql - נפרד מה-push, ראה message.ts), ומסמנת
// active=false+triggered_at (לא מוחקת - נשמר להיסטוריה, כמו שאר האפליקציה לא מוחקת
// רשומות בשקט).
//
// **אימות שונה משאר הפונקציות:** net.http_post של pg_cron לא נושא JWT משתמש, אז
// verify_jwt חייב להיות false עבור הפונקציה הזו (להגדיר ידנית בדשבורד - Edge Functions
// → check-price-alerts → כבות "Verify JWT", בדיוק כמו demo-start/redeem). האימות היחיד
// כאן הוא header ייעודי מול secret נפרד (CRON_SECRET) - לא APP_JWT_SECRET/VAPID.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'
import { getQuotesForSymbols } from '../_shared/finnhubCache.ts'
import { sendPushToAccount } from '../_shared/push.ts'
import { buildAlertMessage } from './message.ts'

interface WatchlistRow {
  id: string
  account_id: string
  symbol: string
  target_price: number
  direction: 'above' | 'below'
  // מגיע דרך ה-join המשוקע ל-accounts (ראה השאילתה למטה) - נדרש כדי לבנות את טקסט
  // ההתראה בשפת החשבון (021_account_language.sql, message.ts). Supabase JS מחזיר
  // relationship עם foreign key יחיד כאובייקט בודד (לא מערך) כברירת מחדל.
  accounts: { language: string } | null
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
    // .not('target_price', 'is', null): שורות "מעקב בלבד" (בלי יעד/כיוון, ראה
    // 014_watchlist_optional_alert.sql) אין להן מה להשוות - מסוננות כבר בשאילתה
    // במקום להיבדק/להידלג בלולאה למטה.
    const { data: rows, error } = await admin
      .from('watchlist')
      .select('id, account_id, symbol, target_price, direction, accounts(language)')
      .eq('active', true)
      .not('target_price', 'is', null)
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

      const message = buildAlertMessage(
        alert.symbol,
        alert.direction,
        alert.target_price,
        quote.price,
        alert.accounts?.language ?? 'en',
      )
      await sendPushToAccount(admin, alert.account_id, {
        title: `${alert.symbol} price alert`,
        body: message,
      })

      // התראה בתוך האפליקציה (notifications, ראה 013_notifications.sql) - נפרדת
      // לגמרי מה-push לעיל. best-effort בכוונה: כשל כאן לא אמור להפיל את שאר הלולאה
      // (הפעלה כבר נשלחה, watchlist עדיין חייב להתעדכן) - אותה גישה בדיוק כמו ניקוי
      // ה-stale endpoints ב-_shared/push.ts.
      try {
        await admin.from('notifications').insert({
          account_id: alert.account_id,
          symbol: alert.symbol,
          message,
        })
      } catch {
        // best-effort - ראה הערה למעלה.
      }

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
