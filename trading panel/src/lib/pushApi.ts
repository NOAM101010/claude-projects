import { getSupabase, supabaseUrl } from './supabase'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export interface PushSubscriptionJson {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface PushSubscriptionRow {
  account_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * ממיר את מפתח ה-VAPID הציבורי (base64url, כפי שמוחזר מ-`web-push generate-vapid-keys`)
 * ל-Uint8Array כפי ש-`PushManager.subscribe` דורש ב-`applicationServerKey`.
 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** ממפה subscription (מ-`PushSubscription.toJSON()`) לשורת insert - לוגיקה טהורה, מכוסה ב-Vitest. */
export function subscriptionToRow(accountId: string, subscription: PushSubscriptionJson): PushSubscriptionRow {
  return {
    account_id: accountId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }
}

/**
 * מבקש הרשאת התראות, נרשם ל-Push דרך ה-service worker הפעיל, ושומר את המנוי ב-DB.
 * זורק שגיאה ברורה אם ההרשאה נדחתה, אם אין VAPID public key מוגדר, או אם הדפדפן לא תומך.
 */
export async function subscribeToPush(accountId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser does not support push notifications')
  }
  if (!vapidPublicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied - allow notifications for this site in your browser settings and try again')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  const row = subscriptionToRow(accountId, subscription.toJSON() as PushSubscriptionJson)
  const supabase = getSupabase()
  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) throw error
}

/** קורא ל-Edge Function `send-test-push` ששולחת התראת בדיקה אחת לכל מנויי ה-account הנוכחי. */
export async function sendTestPush(accessToken: string): Promise<void> {
  const res = await fetch(`${supabaseUrl}/functions/v1/send-test-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `שליחת התראת בדיקה נכשלה (${res.status})`)
  }
}
