import { getSupabase } from './supabase'

/** שורת exchange_rate_cache כפי שהיא ב-DB (ראה supabase/003_exchange_rate_cache.sql). */
interface ExchangeRateCacheRow {
  date: string
  from_currency: string
  to_currency: string
  rate: number
}

/** תלות ניתנת-להזרקה לקאש, כדי שהלוגיקה הטהורה (`resolveHistoricalRate`) תיבדק בלי Supabase/רשת אמיתיים. */
export interface RateCacheStore {
  read(date: string, from: string, to: string): Promise<number | null>
  write(date: string, from: string, to: string, rate: number): Promise<void>
}

async function readCachedRate(date: string, from: string, to: string): Promise<number | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('exchange_rate_cache')
    .select('rate')
    .eq('date', date)
    .eq('from_currency', from)
    .eq('to_currency', to)
    .maybeSingle()
  if (error) throw error
  return data ? (data as { rate: number }).rate : null
}

async function writeCachedRate(date: string, from: string, to: string, rate: number): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('exchange_rate_cache')
    .upsert({ date, from_currency: from, to_currency: to, rate, fetched_at: new Date().toISOString() } satisfies ExchangeRateCacheRow & {
      fetched_at: string
    })
  if (error) throw error
}

const supabaseRateCache: RateCacheStore = { read: readCachedRate, write: writeCachedRate }

/** שולף שער חליפין היסטורי מ-Frankfurter (API חינמי, בלי מפתח). `date` בפורמט YYYY-MM-DD. */
export async function fetchRateFromApi(date: string, from: string, to: string): Promise<number> {
  const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`)
  if (!res.ok) throw new Error(`Failed to fetch exchange rate (${res.status})`)
  const data = (await res.json()) as { rates?: Record<string, number> }
  const rate = data.rates?.[to]
  if (typeof rate !== 'number') throw new Error(`No exchange rate found from ${from} to ${to} on ${date}`)
  return rate
}

/**
 * ליבת הלוגיקה: מחזיר שער חליפין היסטורי, קודם מהקאש (`store`) ורק אם חסר - מ-API
 * חיצוני (`fetchRate`), ואז שומר לקאש. `from === to` תמיד מחזיר 1 בלי קריאה כלשהי.
 * מופרד מ-`getHistoricalRate` כדי לאפשר בדיקות יחידה בלי Supabase/רשת אמיתיים.
 */
export async function resolveHistoricalRate(
  date: string,
  from: string,
  to: string,
  store: RateCacheStore,
  fetchRate: (date: string, from: string, to: string) => Promise<number> = fetchRateFromApi,
): Promise<number> {
  if (from === to) return 1

  const cached = await store.read(date, from, to)
  if (cached !== null) return cached

  const rate = await fetchRate(date, from, to)
  await store.write(date, from, to, rate)
  return rate
}

/** ממיר ISO datetime (או תאריך בלבד) לפורמט YYYY-MM-DD ש-Frankfurter מצפה לו. */
export function toApiDate(isoOrDate: string): string {
  return isoOrDate.slice(0, 10)
}

/**
 * שער חליפין היסטורי ליום נתון, עם קאש בסופרבייס (`exchange_rate_cache`) כדי לחסוך
 * קריאות API חוזרות לאותו תאריך+זוג מטבעות. ראה trading-journal-plan.md סעיף "מטבע בדשבורד".
 */
export function getHistoricalRate(date: string, from: string, to: string): Promise<number> {
  return resolveHistoricalRate(date, from, to, supabaseRateCache)
}
