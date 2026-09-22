// device-status: מחזיר כמה מכשירים מחוברים לקוד הגישה של ה-account המזוהה (דרך
// Authorization header, כמו send-test-push) + מצב ה-cooldown לניתוק מכשיר נוסף
// (023_device_disconnect.sql). **לא** חושף UUID גולמי של אף מכשיר - רק ספירה + אינדקסים
// (0..count-1) ש-`disconnect-device` מקבל בחזרה כדי לזהות איזה מכשיר לנתק.
//
// verify_jwt=true (כמו send-test-push) - ה-Gateway כבר מאמת את החתימה, אנחנו רק מפענחים sub.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { decodeJwtSub } from '../_shared/jwt.ts'
import { cooldownRemainingDays } from '../_shared/deviceCooldown.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

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

    // חשבון יכול להחזיק כמה שורות redeemed (למשל שדרוג basic->pro דרך "יש לי כבר קוד Pro"
    // ב-WorkspaceSwitcher) - הקוד הרלוונטי הוא זה שתואם ל-tier הנוכחי של החשבון, לא סתם
    // "השורה היחידה" (maybeSingle זורק שגיאה/500 כשיש יותר משורה אחת).
    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('tier')
      .eq('id', accountId)
      .maybeSingle()
    if (accountError) throw accountError

    const { data: codeRows, error: codeError } = await admin
      .from('access_codes')
      .select('redeemed_devices, last_device_disconnect_at, unlimited_devices, tier, redeemed_at')
      .eq('redeemed_by', accountId)
    if (codeError) throw codeError

    const codeRow =
      (codeRows ?? []).find((row) => row.tier === account?.tier) ??
      (codeRows ?? []).slice().sort((a, b) => (b.redeemed_at ?? '').localeCompare(a.redeemed_at ?? ''))[0] ??
      null

    if (!codeRow) {
      // החשבון עדיין לא מימש שום קוד (למשל demo) - אין מה להציג, לא שגיאה.
      return jsonResponse({ hasCode: false, deviceCount: 0, deviceIndexes: [], cooldownRemainingDays: 0, unlimitedDevices: false })
    }

    const redeemedDevices = (codeRow.redeemed_devices as string[] | null) ?? []
    return jsonResponse({
      hasCode: true,
      deviceCount: redeemedDevices.length,
      deviceIndexes: redeemedDevices.map((_, i) => i),
      cooldownRemainingDays: cooldownRemainingDays(codeRow.last_device_disconnect_at as string | null),
      unlimitedDevices: Boolean(codeRow.unlimited_devices),
    })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
