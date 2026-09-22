// עוזר משותף (redeem/device-status/disconnect-device): לוגיקת ה-cooldown של 7 ימים בין
// ניתוקי מכשיר לאותו קוד גישה (ראה 023_device_disconnect.sql). פונקציה טהורה, בלי I/O.
//
// יש עותק מקביל (זהה בכוונה, לא import חוצה-runtime בין Deno ל-Node) ב-
// src/lib/deviceApi.ts, מכוסה ב-Vitest שם - אם משנים את הלוגיקה כאן, לעדכן גם שם.
export const DEVICE_DISCONNECT_COOLDOWN_DAYS = 7

/**
 * כמה ימים נותרו עד שמותר לנתק מכשיר נוסף מאותו קוד - 0 אם אין cooldown פעיל (אף פעם לא
 * נותק, `lastDisconnectAt` הוא null, או שכבר עברו 7 ימים מלאים). מעוגל כלפי מעלה כדי
 * שהמשתמש תמיד יראה את מספר הימים המלא שנותר, לא שבר.
 */
export function cooldownRemainingDays(lastDisconnectAt: string | null, now: Date = new Date()): number {
  if (!lastDisconnectAt) return 0
  const elapsedMs = now.getTime() - new Date(lastDisconnectAt).getTime()
  const cooldownMs = DEVICE_DISCONNECT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  const remainingMs = cooldownMs - elapsedMs
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
}
