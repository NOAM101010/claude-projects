import { supabaseUrl } from './supabase'

/** עותק מקביל (זהה בכוונה) ל-supabase/functions/_shared/deviceCooldown.ts - הקבצים חיים
 * בשני runtime-ים שונים (Deno/Node) ולא ניתן לייבא ביניהם. אם משנים את הלוגיקה כאן, לעדכן
 * גם שם. השרת הוא מקור האמת האמיתי (אוכף את ה-cooldown בפועל) - העותק כאן משמש רק
 * להצגה אופטימית ב-UI ולבדיקות יחידה (ר' deviceApi.test.ts). */
export const DEVICE_DISCONNECT_COOLDOWN_DAYS = 7

/** ימים שנותרו עד שמותר לנתק מכשיר נוסף - 0 אם אין cooldown פעיל. ר' התיעוד המלא ב-_shared. */
export function cooldownRemainingDays(lastDisconnectAt: string | null, now: Date = new Date()): number {
  if (!lastDisconnectAt) return 0
  const elapsedMs = now.getTime() - new Date(lastDisconnectAt).getTime()
  const cooldownMs = DEVICE_DISCONNECT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  const remainingMs = cooldownMs - elapsedMs
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
}

export interface DeviceStatus {
  hasCode: boolean
  deviceCount: number
  deviceIndexes: number[]
  cooldownRemainingDays: number
  unlimitedDevices: boolean
}

/** קורא ל-Edge Function `device-status` - כמה מכשירים מחוברים לקוד הגישה של ה-account הנוכחי + מצב cooldown. */
export async function getDeviceStatus(accessToken: string): Promise<DeviceStatus> {
  const res = await fetch(`${supabaseUrl}/functions/v1/device-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  })
  const data = (await res.json()) as DeviceStatus & { error?: string }
  if (!res.ok) throw new Error(data.error ?? `Failed to load device status (${res.status})`)
  return data
}

/** קורא ל-Edge Function `disconnect-device` - מנתק מכשיר לפי אינדקס (0-based, מ-`getDeviceStatus`), לא UUID גולמי. */
export async function disconnectDevice(accessToken: string, deviceIndex: number): Promise<{ deviceCount: number }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/disconnect-device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ deviceIndex }),
  })
  const data = (await res.json()) as { ok?: boolean; deviceCount?: number; error?: string; cooldownRemainingDays?: number }
  if (!res.ok) throw new Error(data.error ?? `Failed to disconnect device (${res.status})`)
  return { deviceCount: data.deviceCount ?? 0 }
}
