import { getSupabase } from './supabase'

export type WatchlistDirection = 'above' | 'below'

export interface WatchlistAlert {
  id: string
  accountId: string
  symbol: string
  targetPrice: number | null
  direction: WatchlistDirection | null
  active: boolean
  triggeredAt: string | null
  createdAt: string
}

interface WatchlistRow {
  id: string
  account_id: string
  symbol: string
  target_price: number | null
  direction: WatchlistDirection | null
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

/** מוסיף סימבול למעקב, עם יעד מחיר+כיוון אופציונליים (אם לא הועברו - שורת "מעקב
 * בלבד" בלי התראה, ראה 014_watchlist_optional_alert.sql). זורק אם הוגעה המגבלה
 * (גם השרת יזרוק - זו רק בדיקה מקדימה לפידבק ברור ומיידי, בלי תלות בפורמט שגיאת ה-DB). */
export async function createWatchlistAlert(
  accountId: string,
  symbol: string,
  targetPrice: number | undefined,
  direction: WatchlistDirection | undefined,
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
      target_price: targetPrice ?? null,
      direction: direction ?? null,
    })
    .select('*')
    .single()
  if (error || !data) throw error ?? new Error('Adding watchlist alert failed')
  return fromRow(data as WatchlistRow)
}

/** מוסיפה/מעדכנת יעד מחיר+כיוון על שורת watchlist קיימת - הזרימה "הוסף התראה
 * לסימבול שכבר במעקב", בנפרד מיצירת השורה עצמה (createWatchlistAlert). */
export async function setWatchlistAlert(id: string, targetPrice: number, direction: WatchlistDirection): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('watchlist').update({ target_price: targetPrice, direction }).eq('id', id)
  if (error) throw error
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

/** "היסטוריית התראות" - שורות watchlist שכבר נורו (active=false), החדשות ביותר קודם.
 * אין טבלה נפרדת: התראה שנורתה היא פשוט שורת watchlist קיימת עם active=false
 * (ראה check-price-alerts) - זו רק שאילתה ממוקדת על אותה טבלה. */
export async function listAlertHistory(accountId: string): Promise<WatchlistAlert[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('account_id', accountId)
    .eq('active', false)
    .order('triggered_at', { ascending: false })
  if (error) throw error
  return (data as WatchlistRow[]).map(fromRow)
}

/** מוחקת פריט יחיד מהיסטוריית ההתראות - אותה פעולה בדיוק כמו מחיקת התראה פעילה
 * (שורת watchlist אחת), רק שם שונה כדי שכוונת הקריאה תהיה ברורה במקום הקריאה. */
export const deleteAlertHistoryItem = deleteWatchlistAlert

/** מנקה רק את ההיסטוריה (active=false) של החשבון - בשונה מ-`deleteAllWatchlistAlerts`
 * (שמוחקת הכל, כולל התראות פעילות, ומשמשת רק את "Clear Trading Data"), זו לעולם לא
 * נוגעת בהתראות שעדיין פעילות. */
export async function clearAlertHistory(accountId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('watchlist').delete().eq('account_id', accountId).eq('active', false)
  if (error) throw error
}
