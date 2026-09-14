import { getSupabase } from './supabase'

export type WatchlistDirection = 'above' | 'below'

export interface WatchlistAlert {
  id: string
  accountId: string
  symbol: string
  targetPrice: number
  direction: WatchlistDirection
  active: boolean
  triggeredAt: string | null
  createdAt: string
}

interface WatchlistRow {
  id: string
  account_id: string
  symbol: string
  target_price: number
  direction: WatchlistDirection
  active: boolean
  triggered_at: string | null
  created_at: string
}

/** מגבלת 15 סימבולים פעילים לחשבון - נאכפת גם בשרת (טריגר ב-010_watchlist.sql), זו
 * רק בדיקה בצד קליינט לפידבק מיידי בלי לחכות לתשובת שרת עם שגיאה. */
export const MAX_WATCHLIST_ALERTS = 15

function fromRow(row: WatchlistRow): WatchlistAlert {
  return {
    id: row.id,
    accountId: row.account_id,
    symbol: row.symbol,
    targetPrice: row.target_price,
    direction: row.direction,
    active: row.active,
    triggeredAt: row.triggered_at,
    createdAt: row.created_at,
  }
}

/** כל שורות ה-watchlist (פעילות+לא-פעילות) של החשבון הנוכחי, החדש ביותר קודם. */
export async function listWatchlistAlerts(accountId: string): Promise<WatchlistAlert[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as WatchlistRow[]).map(fromRow)
}

/** לוגיקה טהורה לאכיפת המגבלה בצד קליינט - סופרת רק שורות פעילות, תואם לטריגר בשרת. */
export function canAddWatchlistAlert(currentActiveCount: number): boolean {
  return currentActiveCount < MAX_WATCHLIST_ALERTS
}

/** מוסיף סימבול+יעד מחיר+כיוון למעקב. זורק אם הוגעה המגבלה (גם השרת יזרוק - זו רק
 * בדיקה מקדימה לפידבק ברור ומיידי, בלי תלות בפורמט שגיאת ה-DB). */
export async function createWatchlistAlert(
  accountId: string,
  symbol: string,
  targetPrice: number,
  direction: WatchlistDirection,
  currentActiveCount: number,
): Promise<WatchlistAlert> {
  if (!canAddWatchlistAlert(currentActiveCount)) {
    throw new Error(`Watchlist limit of ${MAX_WATCHLIST_ALERTS} active symbols reached`)
  }
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      account_id: accountId,
      symbol: symbol.trim().toUpperCase(),
      target_price: targetPrice,
      direction,
    })
    .select('*')
    .single()
  if (error || !data) throw error ?? new Error('Adding watchlist alert failed')
  return fromRow(data as WatchlistRow)
}

/** מוחקת את כל שורות ה-watchlist של החשבון (התראות פעילות ולא-פעילות כאחד) - שימוש
 * יחיד: "Clear Trading Data" ב-`accountApi.clearAccountTradingData`. */
export async function deleteAllWatchlistAlerts(accountId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('watchlist').delete().eq('account_id', accountId)
  if (error) throw error
}

/** מוחקת שורת watchlist. `check-price-alerts` עצמה לעולם לא מוחקת (רק מסמנת active=false
 * כשהתראה נורתה, לשמירת היסטוריה) - זו רק פעולת המשתמש להסיר סימבול שהוא כבר לא עוקב אחריו. */
export async function deleteWatchlistAlert(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('watchlist').delete().eq('id', id)
  if (error) throw error
}
