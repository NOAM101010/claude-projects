// send-test-push: שולחת התראת בדיקה אחת לכל מנויי ה-Push של ה-account המזוהה
// דרך ה-Authorization header (access token שהונפק ע"י demo-start/redeem).
// תשתית בדיקה בלבד - אין כאן תזמון/תזכורות אוטומטיות, ראה supabase/functions/README.md.
//
// verify_jwt של הפונקציה הזו נשאר true (ברירת המחדל, לא הוגדר config.toml override):
// ה-JWT-ים שאנחנו מנפיקים ב-demo-start/redeem חתומים עם אותו SUPABASE_JWT_SECRET, אז
// שכבת האימות של Supabase Gateway כבר מוודאת חתימה/תוקף לפני שהבקשה מגיעה לכאן -
// אנחנו רק מפענחים את ה-payload (לא מאמתים חתימה שוב) כדי לשלוף את ה-sub (account_id).
//
// **wrapper דק** סביב sendPushToAccount (Phase F - ראה _shared/push.ts) - התנהגות
// זהה בדיוק לגרסה הקודמת, זה שינוי מבני בלבד (הלוגיקה חולצה כדי ש-check-price-alerts
// יוכל להשתמש בה גם כן, בלי לכפול קוד VAPID/webpush).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { decodeJwtSub } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'
import { sendPushToAccount } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('חסרים secrets: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY')
    }

    const accountId = decodeJwtSub(req.headers.get('Authorization'))
    if (!accountId) {
      return jsonResponse({ error: 'לא מזוהה - נדרש Authorization: Bearer <access token>' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const result = await sendPushToAccount(admin, accountId, {
      title: 'TradePanel',
      body: 'זו התראת בדיקה - אם קיבלת אותה, Push עובד!',
    })

    if (result.sent === 0 && result.failed === 0) {
      return jsonResponse({ error: 'אין מנוי Push רשום למכשיר הזה - יש להפעיל התראות בהגדרות קודם' }, 404)
    }

    return jsonResponse(result)
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
