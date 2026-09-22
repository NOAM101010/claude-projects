// switch-template: מממש קוד גישה חד-פעמי מסוג 'template_switch' (access_codes.kind, ראה
// 026_template_switch_codes.sql) ו**כותב בעצמו** את התבנית החדשה ל-workspace, תחת
// service_role, באותה בקשה שבה הקוד נתפס - Basic client לעולם לא יכול לכתוב
// workspaces.template ישירות ברגע שכבר נבחרה תבנית (027_protect_workspace_template.sql,
// BEFORE UPDATE trigger שחוסם client רגיל, מזהה service_role בדיוק כמו
// protect_account_privileged_columns הקיים ל-accounts.tier). **לא** מספיק "לפתוח" ולתת
// לקליינט לקרוא בנפרד ל-setWorkspaceTemplate - הטריגר יחסום את זה, ובצדק (זה בדיוק מה
// שמנע client-side bypass של הנעילה - ר' תיקון ביקורת סבב B).
//
// **לא** נוגע ב-accounts.tier/redeemed_devices - זו לא זרימת שדרוג (ר' redeem/index.ts,
// שדוחה בפירוש קודים מהסוג הזה).
//
// verify_jwt=true (כמו disconnect-device/device-status) - ה-Gateway כבר מאמת את החתימה,
// אנחנו רק מפענחים sub ומוודאים שה-workspace שייך לחשבון הזה.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { decodeJwtSub } from '../_shared/jwt.ts'
import { errorMessage, jsonResponse, preflightResponse } from '../_shared/http.ts'

type WorkspaceTemplate = 'day' | 'swing' | 'longterm' | 'crypto'

interface FieldSettings {
  stopLoss: boolean
  takeProfit: boolean
  fee: boolean
  notes: boolean
  setup: boolean
  requireExactTime: boolean
}

// עותק מקביל (זהה בכוונה) ל-TEMPLATE_FIELD_DEFAULTS ב-src/lib/workspacesApi.ts - Deno
// לא יכול לייבא קובץ TS שרץ ב-Vite/Node (אותו עיקרון כמו _shared/deviceCooldown.ts מול
// accountApi.ts). אם משנים את הטבלה שם, לעדכן גם כאן.
const TEMPLATE_FIELD_DEFAULTS: Record<WorkspaceTemplate, FieldSettings> = {
  day: { requireExactTime: true, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
  swing: { requireExactTime: false, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
  longterm: { requireExactTime: false, stopLoss: false, takeProfit: false, fee: true, setup: false, notes: true },
  crypto: { requireExactTime: true, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
}

interface SwitchTemplateBody {
  code?: string
  workspaceId?: string
  template?: string
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

    const body = (await req.json().catch(() => ({}))) as SwitchTemplateBody
    const code = body.code?.trim()
    const workspaceId = body.workspaceId?.trim()
    const template = body.template as WorkspaceTemplate | undefined
    if (!code || !workspaceId) {
      return jsonResponse({ error: 'code ו-workspaceId חובה' }, 400)
    }
    if (!template || !(template in TEMPLATE_FIELD_DEFAULTS)) {
      return jsonResponse({ error: 'template חובה ותקין (day/swing/longterm/crypto)' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // ודא שה-workspace שייך לחשבון המזוהה - בלי זה חשבון אחד יכול לצרוך קוד של אחר כדי
    // לכתוב תבנית ל-workspace שלא שלו.
    const { data: workspace, error: workspaceError } = await admin
      .from('workspaces')
      .select('id, account_id')
      .eq('id', workspaceId)
      .maybeSingle()
    if (workspaceError) throw workspaceError
    if (!workspace || workspace.account_id !== accountId) {
      return jsonResponse({ error: 'workspace לא נמצא או לא שייך לחשבון הזה' }, 403)
    }

    const { data: codeRow, error: codeError } = await admin
      .from('access_codes')
      .select('code, kind, redeemed_by')
      .eq('code', code)
      .maybeSingle()
    if (codeError) throw codeError
    if (!codeRow) return jsonResponse({ error: 'קוד גישה לא נמצא' }, 404)
    if (codeRow.kind !== 'template_switch') {
      return jsonResponse({ error: 'קוד זה אינו קוד להחלפת תבנית' }, 400)
    }
    if (codeRow.redeemed_by) {
      return jsonResponse({ error: 'קוד זה כבר מומש' }, 409)
    }

    // תפיסה אטומית - כמו redeem/index.ts: `.is('redeemed_by', null)` בתנאי ה-UPDATE מונע
    // משני requests בו-זמנית לתפוס את אותו קוד פעמיים (הפסד במרוץ -> 409, לא כתיבה כפולה).
    const { data: claimed, error: claimError } = await admin
      .from('access_codes')
      .update({ redeemed_by: accountId, redeemed_at: new Date().toISOString() })
      .eq('code', code)
      .is('redeemed_by', null)
      .select('code')
      .maybeSingle()
    if (claimError) throw claimError
    if (!claimed) {
      return jsonResponse({ error: 'קוד זה כבר מומש' }, 409)
    }

    // הכתיבה בפועל - רק כאן, תחת service_role (עוקף את 027_protect_workspace_template.sql
    // כי auth.role() נכנס כ-'service_role' בבקשה הזו, בדיוק כמו redeem/index.ts מול
    // accounts.tier). אם הקוד כבר נתפס למעלה אבל הכתיבה כאן נכשלת, הקוד נשאר "נצרך" בלי
    // תבנית חדשה בפועל - אותו trade-off מקובל כמו קוד tier-upgrade שנתפס אבל ה-mint נכשל.
    const { error: updateError } = await admin
      .from('workspaces')
      .update({ template, field_settings: TEMPLATE_FIELD_DEFAULTS[template] })
      .eq('id', workspaceId)
    if (updateError) throw updateError

    return jsonResponse({ ok: true, template })
  } catch (err) {
    return jsonResponse({ error: errorMessage(err) }, 500)
  }
})
