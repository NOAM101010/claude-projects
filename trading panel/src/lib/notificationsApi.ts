import { getSupabase } from './supabase'

export interface AppNotification {
  id: string
  symbol: string
  message: string
  createdAt: string
  readAt: string | null
}

interface NotificationRow {
  id: string
  symbol: string
  message: string
  created_at: string
  read_at: string | null
}

/** מגבלת שליפה סבירה לפעמון ה-header - אין UI ל"טען עוד" בשלב הזה, 50 מספיק בהרבה
 * למקרה שימוש של כמה עשרות התראות מחיר לחשבון אחד. */
const NOTIFICATIONS_FETCH_LIMIT = 50

function fromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    symbol: row.symbol,
    message: row.message,
    createdAt: row.created_at,
    readAt: row.read_at,
  }
}

/** כל ההתראות של החשבון (נקראו+לא-נקראו), החדשות ביותר קודם. `countUnread` (למטה)
 * נגזרת מהתוצאה הזו בצד קליינט במקום שאילתת count נפרדת - אותם נתונים, פעם אחת. */
export async function listNotifications(accountId: string): Promise<AppNotification[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_FETCH_LIMIT)
  if (error) throw error
  return (data as NotificationRow[]).map(fromRow)
}

/** לוגיקה טהורה: כמה מתוך רשימת התראות שכבר בידינו הן לא-נקראות - כדי שלא נצטרך
 * שאילתת count נפרדת לכל בדיקת badge (ראה listNotifications). */
export function countUnread(notifications: AppNotification[]): number {
  return notifications.filter((n) => n.readAt === null).length
}

/** מסמנת התראה בודדת כנקראה (בלחיצה עליה בדרופדאון). */
export async function markNotificationRead(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

/** מסמנת את כל ההתראות הלא-נקראות של החשבון כנקראו בבת אחת ("mark all as read"). */
export async function markAllNotificationsRead(accountId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .is('read_at', null)
  if (error) throw error
}
