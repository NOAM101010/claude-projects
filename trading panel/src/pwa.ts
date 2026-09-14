import { registerSW } from 'virtual:pwa-register'

/**
 * רישום Service Worker בסיסי (קאשינג app-shell, ראה vite.config.ts).
 * registerType='autoUpdate' - גרסה חדשה מתעדכנת ומרעננת אוטומטית, בלי לבקש
 * אישור. היה 'prompt' (דיאלוג confirm() דפדפני) אבל משתמש לא-טכני לא הבין
 * שהדיאלוג הזה ניתן ללחיצה, ונשאר תקוע על גרסה ישנה בלי דרך לצאת מזה חוץ
 * מ-unregister ידני ב-devtools - לא סביר לצפות מלקוח לעשות. ראה vite.config.ts
 * להסבר המלא ולפשרה (reload אוטומטי תיאורטית יכול לקרות בזמן שטופס טרייד פתוח
 * עם דאטה לא שמורה - נדיר, כדאי להיזכר בזה לפני שהמוצר יוצא ללקוחות משלמים).
 */
export function initPwa(): void {
  registerSW({ immediate: true })
}
