// redeem: ממש קוד גישה עבור account קיים.
// - קוד לא קיים → 404.
// - קוד לא מומש עדיין → משדרג את currentAccountId ל-tier של הקוד (הדאטה נשארת תחתיו),
//   וקובע redeemed_devices=[deviceId].
// - קוד כבר מומש ע"י account אחר → מנפיק JWT עם sub=redeemed_by (החשבון המקורי),
//   בלי ליצור/לשנות דבר - כך שמכשיר חדש "מקבל בחזרה" את הדאטה המקורית - **אלא אם**
//   deviceId חדש ומגבלת המכשירים לקוד (ראה MAX_DEVICES_PER_CODE) כבר מוצתה, אז 403.
//   קודי unlimited_devices=true (פיתוח/בדיקה אישי בלבד) פטורים ממגבלת המכשירים.
// לא נוגע ב-mintAccessToken/APP_JWT_SECRET עצמם - רק מוסיף בדיקה לפני הקריאה להם.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { mintAccessToken } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

const MAX_DEVICES_PER_CODE = 2
/** מספר ניסיונות מקסימלי ל-appendDeviceWithRetry לפני שמוותרים - ראה שם. */
const MAX_APPEND_ATTEMPTS = 5

interface RedeemBody {
  code?: string
  currentAccountId?: string
  deviceId?: string
}

interface AppendDeviceResult {
  ok: boolean
  /** true אם נכשל כי המגבלה כבר מוצתה (להבדיל מכישלון טכני/תקלת רשת). */
  limitReached?: boolean
  devices: string[]
}

/**
 * מוסיף deviceId ל-`redeemed_devices` (jsonb, לא Postgres array - `.eq()` הרגיל על מערך JS
 * לא עובד ישירות כי `${value}` עושה `.toString()` שמפיק "a,b" ולא JSON תקין; משתמשים
 * ב-`.filter(col, 'eq', JSON.stringify(...))` שמייצר JSON תקין) עם concurrency אופטימית:
 * ה-UPDATE מותנה בכך שהעמודה עדיין שווה בדיוק ל-snapshot שנקרא (`currentDevices`) - אם
 * request אחר כבר שינה אותה בינתיים (שני מכשירים שמתחברים כמעט בו-זמנית, קריטי כעת
 * ש-MAX_DEVICES_PER_CODE=2), ה-UPDATE לא פוגע באף שורה ומנסים שוב עם המצב העדכני, עד
 * MAX_APPEND_ATTEMPTS פעמים - אותו עיקרון כמו ה-`.select('code').maybeSingle()` שכבר קיים
 * למטה ב"תביעת קוד לא-ממומש", רק שכאן צריך ללולאה כי יכולות להיות כמה התנגשויות ברצף.
 */
async function appendDeviceWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  code: string,
  initialDevices: string[],
  deviceId: string,
  initialUnlimitedDevices: boolean,
): Promise<AppendDeviceResult> {
  let currentDevices = initialDevices
  let unlimitedDevices = initialUnlimitedDevices

  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    if (currentDevices.includes(deviceId)) {
      return { ok: true, devices: currentDevices }
    }
    if (!unlimitedDevices && currentDevices.length >= MAX_DEVICES_PER_CODE) {
      return { ok: false, limitReached: true, devices: currentDevices }
    }

    const nextDevices = [...currentDevices, deviceId]
    const { data: updated, error: appendError } = await admin
      .from('access_codes')
      .update({ redeemed_devices: nextDevices })
      .eq('code', code)
      .filter('redeemed_devices', 'eq', JSON.stringify(currentDevices))
      .select('redeemed_devices')
      .maybeSingle()
    if (appendError) throw appendError

    if (updated) {
      return { ok: true, devices: (updated.redeemed_devices as string[] | null) ?? nextDevices }
    }

    // הפסדנו במרוץ - request אחר כבר שינה את redeemed_devices בין הקריאה לכתיבה שלנו.
    // קוראים את המצב העדכני (כולל unlimited_devices, למקרה שגם הוא השתנה) וננסה שוב.
    const { data: refreshed, error: refreshError } = await admin
      .from('access_codes')
      .select('redeemed_devices, unlimited_devices')
      .eq('code', code)
      .single()
    if (refreshError) throw refreshError
    currentDevices = (refreshed.redeemed_devices as string[] | null) ?? []
    unlimitedDevices = Boolean(refreshed.unlimited_devices)
  }

  throw new Error('לא הצלחנו לעדכן את רשימת המכשירים אחרי כמה ניסיונות - נסה שוב')
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
      .select('code, tier, kind, redeemed_by, redeemed_devices, unlimited_devices')
      .eq('code', code)
      .maybeSingle()
    if (codeError) throw codeError
    if (!codeRow) return jsonResponse({ error: 'קוד גישה לא נמצא' }, 404)
    // קודי 'template_switch' (026_template_switch_codes.sql) לא שדרוג דרגה כלל - נדחים כאן
    // בלי לגעת בכלום, לפני כל בדיקת redeemed_by/מכשירים. יש להם זרימה נפרדת לגמרי
    // (switch-template Edge Function). ברירת המחדל 'tier' על כל קוד קיים שומרת על ההתנהגות
    // המקורית ללא שינוי לאף קוד שכבר נמכר.
    if (codeRow.kind !== 'tier') {
      return jsonResponse({ error: 'קוד זה אינו קוד שדרוג דרגה - נדרשת זרימה אחרת' }, 400)
    }

    let targetAccountId = currentAccountId

    if (codeRow.redeemed_by) {
      // כבר מומש בעבר - מחזירים את החשבון המקורי, לא נוגעים בכלום (בברירת מחדל).
      targetAccountId = codeRow.redeemed_by

      // מכשיר חדש עבור קוד שכבר מומש - appendDeviceWithRetry בודק את מגבלת המכשירים (אלא
      // אם זהו קוד unlimited_devices - קוד פיתוח/בדיקה אישי, ראה 009_unlimited_devices_codes.sql)
      // ומתמודד עם race מול request מקביל אחר שמוסיף מכשיר אחר לאותו קוד בו-זמנית.
      const redeemedDevices = (codeRow.redeemed_devices as string[] | null) ?? []
      const appendResult = await appendDeviceWithRetry(admin, code, redeemedDevices, deviceId, Boolean(codeRow.unlimited_devices))
      if (!appendResult.ok) {
        return jsonResponse(
          {
            error: `This access code is already active on the maximum number of devices (${MAX_DEVICES_PER_CODE}). Contact support if you need help.`,
          },
          403,
        )
      }
    } else {
      // .select('code') כדי לדעת אם ה-UPDATE בפועל פגע בשורה - `.is('redeemed_by', null)`
      // (access_codes אין לה עמודת id בכלל - code הוא ה-primary key, ראה 001_init_schema.sql)
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
        .select('code')
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
        const appendResult = await appendDeviceWithRetry(admin, code, redeemedDevices, deviceId, Boolean(refetched.unlimited_devices))
        if (!appendResult.ok) {
          return jsonResponse(
            {
              error: `This access code is already active on the maximum number of devices (${MAX_DEVICES_PER_CODE}). Contact support if you need help.`,
            },
            403,
          )
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
