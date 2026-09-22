import type { CurrencyCode } from '../types/trade'

/**
 * תאריך+שעה קריאים, לפי אזור הזמן המקומי של הדפדפן (לא UTC גולמי).
 * `locale` אופציונלי - כשלא מועבר נופל ל-locale של הדפדפן (undefined ל-Intl).
 */
export function formatDateTime(iso: string | null, locale?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/** תאריך בלבד (בלי שעה), לפי אזור הזמן המקומי של הדפדפן - לעמודת Date בטבלת הדסקטופ. */
export function formatDate(iso: string | null, locale?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

/**
 * משך זמן קריא בין `startIso` לעכשיו ("2h 14m" / "3d 5h" / "45m") - ל-Time in Trade
 * בפוזיציות פתוחות. שונה במתכוון מ-`avgHoldDays` ב-stats.ts (שם מספיקה גרנולריות של
 * ימים לממוצע) - כאן פוזיציה שנפתחה לפני 20 דקות צריכה להיראות "20m", לא "0.01 days".
 * `now` אופציונלי (ברירת מחדל `new Date()`) כדי שהפונקציה תישאר טהורה/נבדקת.
 */
export function formatDuration(startIso: string, now: Date = new Date()): string {
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - new Date(startIso).getTime()) / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatCurrency(value: number, currency: CurrencyCode, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * כמו `formatCurrency` אבל בלי סימן/קוד המטבע - למקומות צרים מאוד (תא לוח-שנה במובייל,
 * ר' `MonthlyCalendar.module.css` `.dayPnl`) שבהם אין מקום גם לסימן וגם לסכום המלא.
 * שומר את הסימן (+/-), הפרדות אלפים והעשרוניות המדויקות של המטבע - אף ספרה לא נחתכת,
 * רק הסמל מוסר (המטבע כבר מוצג בכותרת/בסטטיסטיקות שמעל הלוח).
 */
export function formatCurrencyCompact(value: number, currency: CurrencyCode, locale?: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).formatToParts(value)
  return parts
    .filter((p) => p.type !== 'currency' && p.type !== 'literal')
    .map((p) => p.value)
    .join('')
}

/**
 * ממיר ISO string לערך תואם input[type=datetime-local] בזמן המקומי (לא UTC).
 * `dateOnly=true` מחזיר רק את חלק התאריך (YYYY-MM-DD), תואם input[type=date] - למקרה
 * שה-workspace כיבה `requireExactTime` (ראה workspacesApi.ts/TradeForm.tsx). זורק את
 * חלק השעה בשקט אם היה קיים - זה בכוונה, ראה תיעוד הטוגל.
 */
export function isoToLocalInputValue(iso: string | null, dateOnly = false): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (dateOnly) return datePart
  return `${datePart}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * ממיר ערך מ-input[type=datetime-local] (זמן מקומי) ל-ISO string (UTC).
 * `dateOnly=true` מקבל ערך מ-input[type=date] (YYYY-MM-DD בלבד, בלי שעה) ומשלים 12:00
 * בצהריים **בזמן המקומי** של הדפדפן לפני ההמרה ל-UTC - נבחר צהריים במקום חצות כדי
 * שההמרה ל-UTC לעולם לא "תגלוש" ליום הקודם/הבא באזורי זמן קיצוניים (ראה תיעוד ה-Excel
 * import timezone bug ב-progress.md - אותה מלכודת בדיוק, נמנעת כאן במפורש).
 */
export function localInputValueToIso(value: string, dateOnly = false): string | null {
  if (!value) return null
  const raw = dateOnly ? `${value}T12:00` : value
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
