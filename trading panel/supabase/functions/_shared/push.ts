// מודול Push משותף - חולץ מ-send-test-push (שהוא **מאושר עובד בפועל**, ראה progress.md)
// כך ש-check-price-alerts (Phase F) יוכל לשלוח התראות אמיתיות בלי לכפול את לוגיקת
// ה-VAPID/webpush. send-test-push הפך ל-wrapper דק סביב sendPushToAccount - התנהגות
// זהה בדיוק, זה שינוי מבני בלבד.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import webpush from 'npm:web-push@3.6.7'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export interface PushResult {
  sent: number
  failed: number
}

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

let vapidConfigured = false

function ensureVapidConfigured(): void {
  if (vapidConfigured) return
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('חסרים secrets: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY')
  }
  webpush.setVapidDetails('mailto:support@tradepanel.app', vapidPublicKey, vapidPrivateKey)
  vapidConfigured = true
}

/**
 * שולחת push לכל מנויי ה-Push של account נתון. מוחקת אוטומטית מנויים שהשרת דוחה עם
 * 404/410 (endpoint לא תקף יותר - המשתמש ביטל/הסיר את הדפדפן) כדי שהטבלה לא תצטבר
 * זבל שגורם לכשלים חוזרים בכל cron cycle. מחזירה {sent,failed} - לא זורקת על כשל
 * שליחה בודד, רק על תקלת תשתית (secrets חסרים/שאילתת DB נכשלה).
 */
export async function sendPushToAccount(
  admin: SupabaseClient,
  accountId: string,
  payload: PushPayload,
): Promise<PushResult> {
  ensureVapidConfigured()

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('account_id', accountId)
  if (error) throw error
  const rows = (subs ?? []) as PushSubscriptionRow[]
  if (rows.length === 0) return { sent: 0, failed: 0 }

  const body = JSON.stringify(payload)
  const staleEndpoints: string[] = []

  const results = await Promise.allSettled(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode
        if (statusCode === 404 || statusCode === 410) staleEndpoints.push(sub.endpoint)
        throw err
      }
    }),
  )
  const failed = results.filter((r) => r.status === 'rejected').length

  if (staleEndpoints.length > 0) {
    try {
      await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
    } catch {
      // ניקוי best-effort - כשל מחיקה לא אמור להפיל את השליחה עצמה.
    }
  }

  return { sent: rows.length - failed, failed }
}
