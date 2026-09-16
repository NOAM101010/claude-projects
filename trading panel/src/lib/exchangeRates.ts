import { getSupabase } from './supabase'

interface ExchangeRateResponse {
  rate?: number
}

/** ממיר ISO datetime (או תאריך בלבד) לפורמט YYYY-MM-DD ש-Frankfurter מצפה לו. */
export function toApiDate(isoOrDate: string): string {
  return isoOrDate.slice(0, 10)
}

/**
 * שער חליפין היסטורי ליום נתון, דרך ה-Edge Function `exchange-rate` (לא קריאה/כתיבה
 * ישירה ל-exchange_rate_cache מהלקוח - הטבלה משותפת בין כל החשבונות, אז כתיבה
 * client-side פתוחה הייתה מאפשרת לכל משתמש מאומת להשחית שערים שכל שאר המשתמשים
 * רואים, ראה supabase/020_exchange_rate_cache_lockdown.sql). הפונקציה קוראת/כותבת
 * לקאש בצד שרת (service role) ונופלת ל-Frankfurter API בcache-miss - אותה לוגיקה
 * שהייתה כאן קודם, רק בצד שרת. `from === to` מוחזר כ-1 מיידית גם בפונקציה עצמה.
 * לא זורקת: כשל (רשת/הרשאה/API) זורק הלאה כדי שהקורא (useMarketData) יטפל ב"לא זמין".
 */
export async function getHistoricalRate(date: string, from: string, to: string): Promise<number> {
  if (from === to) return 1

  const { data, error } = await getSupabase().functions.invoke<ExchangeRateResponse>('exchange-rate', {
    body: { date, from, to },
  })
  if (error) throw error
  const rate = data?.rate
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`No valid exchange rate found from ${from} to ${to} on ${date}`)
  }
  return rate
}
