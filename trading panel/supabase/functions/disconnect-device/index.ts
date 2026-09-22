// disconnect-device: מסיר מכשיר ספציפי (לפי אינדקס בתוך redeemed_devices, לא UUID גולמי -
// ראה device-status) מקוד הגישה של ה-account המזוהה, ומפנה סלוט במגבלת המכשירים
// (MAX_DEVICES_PER_CODE, ראה supabase/functions/redeem/index.ts). כפוף ל-cooldown של 7 ימים
// בין ניתוקים לאותו קוד (023_device_disconnect.sql) - בלי זה אפשר היה לנתק+לחבר שוב שוב
// כדי לעקוף את המגבלה. verify_jwt=true, כמו send-test-push/device-status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { decodeJwtSub } from '../_shared/jwt.ts'
import { cooldownRemainingDays } from '../_shared/deviceCooldown.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

interface DisconnectBody {
  deviceIndex?: number
}

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

    const body = (await req.json().catch(() => ({}))) as DisconnectBody
    const deviceIndex = body.deviceIndex
    if (typeof deviceIndex !== 'number' || !Number.isInteger(deviceIndex) || deviceIndex < 0) {
      return jsonResponse({ error: 'deviceIndex חובה (מספר שלם >= 0)' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // ראה device-status - אותה הנחה שגויה של "שורה אחת לחשבון" (maybeSingle זורק כשיש כמה,
    // למשל אחרי שדרוג basic->pro). מנתקים מהקוד התואם ל-tier הנוכחי, לא מכל קוד ישן.
    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('tier')
      .eq('id', accountId)
      .maybeSingle()
    if (accountError) throw accountError

    const { data: codeRows, error: codeError } = await admin
      .from('access_codes')
      .select('code, redeemed_devices, last_device_disconnect_at, tier, redeemed_at')
      .eq('redeemed_by', accountId)
    if (codeError) throw codeError

    const codeRow =
      (codeRows ?? []).find((row) => row.tier === account?.tier) ??
      (codeRows ?? []).slice().sort((a, b) => (b.redeemed_at ?? '').localeCompare(a.redeemed_at ?? ''))[0] ??
      null
    if (!codeRow) return jsonResponse({ error: 'לא נמצא קוד גישה ממומש עבור החשבון הזה' }, 404)

    const remainingCooldownDays = cooldownRemainingDays(codeRow.last_device_disconnect_at as string | null)
    if (remainingCooldownDays > 0) {
      return jsonResponse(
        { error: `Device disconnect is on cooldown - try again in ${remainingCooldownDays} day(s).`, cooldownRemainingDays: remainingCooldownDays },
        429,
      )
    }

    const redeemedDevices = (codeRow.redeemed_devices as string[] | null) ?? []
    if (deviceIndex >= redeemedDevices.length) {
      return jsonResponse({ error: 'deviceIndex לא קיים ברשימת המכשירים המחוברים' }, 400)
    }

    const nextDevices = redeemedDevices.filter((_, i) => i !== deviceIndex)
    const { error: updateError } = await admin
      .from('access_codes')
      .update({ redeemed_devices: nextDevices, last_device_disconnect_at: new Date().toISOString() })
      .eq('code', codeRow.code)
    if (updateError) throw updateError

    return jsonResponse({ ok: true, deviceCount: nextDevices.length })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
