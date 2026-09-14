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

export function formatCurrency(value: number, currency: CurrencyCode, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

/** ממיר ISO string לערך תואם input[type=datetime-local] בזמן המקומי (לא UTC). */
export function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ממיר ערך מ-input[type=datetime-local] (זמן מקומי) ל-ISO string (UTC). */
export function localInputValueToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
