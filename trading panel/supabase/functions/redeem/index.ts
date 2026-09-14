// redeem: ממש קוד גישה עבור account קיים.
// - קוד לא קיים → 404.
// - קוד לא מומש עדיין → משדרג את currentAccountId ל-tier של הקוד (הדאטה נשארת תחתיו),
//   וקובע redeemed_devices=[deviceId].
// - קוד כבר מומש ע"י account אחר → מנפיק JWT עם sub=redeemed_by (החשבון המקורי),
//   בלי ליצור/לשנות דבר - כך שמכשיר חדש "מקבל בחזרה" את הדאטה המקורית - **אלא אם**
//   deviceId חדש ומגבלת 3 המכשירים לקוד כבר מוצתה (ראה MAX_DEVICES_PER_CODE), אז 403.
//   קודי unlimited_devices=true (פיתוח/בדיקה אישי בלבד) פטורים ממגבלת המכשירים.
// לא נוגע ב-mintAccessToken/APP_JWT_SECRET עצמם - רק מוסיף בדיקה לפני הקריאה להם.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { mintAccessToken } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

const MAX_DEVICES_PER_CODE = 3

interface RedeemBody {
  code?: string
  currentAccountId?: string
  deviceId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse()
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    // See demo-start/index.ts for why APP_JWT_SECRET (not SUPABASE_JWT_SECRET) is used.
    const jwtSecret = Deno.env.get('APP_JWT_SECRET')
    if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
      throw new Error('חסרים secrets בסביבת ה-Edge Function (SUPABASE_URL/SERVICE_ROLE_KEY/APP_JWT_SECRET)')
    }

    const body = (await req.json().catch(() => ({}))) as RedeemBody
    const code = body.code?.trim()
    const currentAccountId = body.currentAccountId
    const deviceId = body.deviceId?.trim()

    if (!code || !currentAccountId || !deviceId) {
      return jsonResponse({ error: 'code, currentAccountId ו-deviceId חובה' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: codeRow, error: codeError } = await admin
      .from('access_codes')
      .select('code, tier, redeemed_by, redeemed_devices, unlimited_devices')
      .eq('code', code)
      .maybeSingle()
    if (codeError) throw codeError
    if (!codeRow) return jsonResponse({ error: 'קוד גישה לא נמצא' }, 404)

    let targetAccountId = currentAccountId

    if (codeRow.redeemed_by) {
      // כבר מומש בעבר - מחזירים את החשבון המקורי, לא נוגעים בכלום (בברירת מחדל).
      targetAccountId = codeRow.redeemed_by

      const redeemedDevices = (codeRow.redeemed_devices as string[] | null) ?? []
      if (!redeemedDevices.includes(deviceId)) {
        // מכשיר חדש עבור קוד שכבר מומש - נבדוק את מגבלת 3 המכשירים, אלא אם זהו
        // קוד unlimited_devices (קוד פיתוח/בדיקה אישי - ראה 009_unlimited_devices_codes.sql).
        if (!codeRow.unlimited_devices && redeemedDevices.length >= MAX_DEVICES_PER_CODE) {
          return jsonResponse(
            {
              error:
                'This access code is already active on the maximum number of devices (3). Contact support if you need help.',
            },
            403,
          )
        }
        const { error: appendError } = await admin
          .from('access_codes')
          .update({ redeemed_devices: [...redeemedDevices, deviceId] })
          .eq('code', code)
        if (appendError) throw appendError
      }
    } else {
      // .select('id') כדי לדעת אם ה-UPDATE בפועל פגע בשורה - `.is('redeemed_by', null)`
      // גם מונע דריסה של תפיסה קודמת, אבל update() בלי select() תמיד מחזיר error=null גם
      // כשהתנאי לא תאם אף שורה (0 rows matched). בלי הבדיקה הזו, בקשה מפסידה במרוץ (שני
      // requests שניסו לתפוס בו-זמנית את אותו קוד) הייתה ממשיכה בשקט ומשדרגת גם את
      // currentAccountId שלה - כלומר קוד חד-פעמי אחד משדרג שני חשבונות שונים.
      const { data: claimedRow, error: claimError } = await admin
        .from('access_codes')
        .update({
          redeemed_by: currentAccountId,
          redeemed_at: new Date().toISOString(),
          redeemed_devices: [deviceId],
        })
        .eq('code', code)
        .is('redeemed_by', null)
        .select('id')
        .maybeSingle()
      if (claimError) throw claimError

      if (!claimedRow) {
        // הפסדנו במרוץ - request אחר תפס את הקוד בין ה-select לעיל לבין ה-update הזה.
        // מתנהגים בדיוק כמו הענף "כבר מומש" למעלה: מחזירים את החשבון שבאמת תפס את
        // הקוד, בלי לשדרג את currentAccountId ובלי ליצור/לשנות דבר.
        const { data: refetched, error: refetchError } = await admin
          .from('access_codes')
          .select('redeemed_by, redeemed_devices, unlimited_devices')
          .eq('code', code)
          .single()
        if (refetchError || !refetched?.redeemed_by) throw refetchError ?? new Error('קוד גישה לא נמצא')

        targetAccountId = refetched.redeemed_by

        const redeemedDevices = (refetched.redeemed_devices as string[] | null) ?? []
        if (!redeemedDevices.includes(deviceId)) {
          if (!refetched.unlimited_devices && redeemedDevices.length >= MAX_DEVICES_PER_CODE) {
            return jsonResponse(
              {
                error:
                  'This access code is already active on the maximum number of devices (3). Contact support if you need help.',
              },
              403,
            )
          }
          const { error: appendError } = await admin
            .from('access_codes')
            .update({ redeemed_devices: [...redeemedDevices, deviceId] })
            .eq('code', code)
          if (appendError) throw appendError
        }
      } else {
        const { error: upgradeError } = await admin
          .from('accounts')
          .update({ tier: codeRow.tier })
          .eq('id', currentAccountId)
        if (upgradeError) throw upgradeError
      }
    }

    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('id, tier')
      .eq('id', targetAccountId)
      .single()
    if (accountError || !account) throw accountError ?? new Error('חשבון לא נמצא')

    const accessToken = await mintAccessToken(account.id, jwtSecret)

    return jsonResponse({ accountId: account.id, accessToken, tier: account.tier })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
