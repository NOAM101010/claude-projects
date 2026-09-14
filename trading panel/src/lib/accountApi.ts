import { getSupabase } from './supabase'
import { deleteAllTradesInWorkspace } from './tradesApi'
import { deleteAllWatchlistAlerts } from './watchlistApi'

export type AccountTier = 'demo' | 'basic' | 'pro'

export interface Account {
  id: string
  tier: AccountTier
  /** מונה טריידי-דמו אמין, מנוהל אך ורק ע"י טריגר DB (`008_demo_trades_created.sql`) -
   * עולה על כל insert ל-trades, לעולם לא יורד גם אם הטרייד נמחק. לא ניתן לתמרון
   * מהקליינט, בניגוד ל-`trades.length` שנספר מה-state הטעון בזיכרון. */
  demoTradesCreated: number
}

interface AccountRow {
  id: string
  tier: AccountTier
  demo_trades_created: number
}

/** טוען את דרגת החשבון (demo/basic/pro) + מונה טריידי-הדמו, נדרש לאכיפת מגבלת ה-5 workspaces של Pro ומגבלת הדמו. */
export async function getAccount(accountId: string): Promise<Account> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('accounts')
    .select('id, tier, demo_trades_created')
    .eq('id', accountId)
    .single()
  if (error || !data) throw error ?? new Error('Failed to load account')
  const row = data as AccountRow
  return { id: row.id, tier: row.tier, demoTradesCreated: row.demo_trades_created }
}

/** מגבלת הדמו - עד 5 טריידים חינם לפני שנדרש קוד גישה (trading-journal-plan.md סעיף 5). */
export const DEMO_TRADE_LIMIT = 5

/**
 * לוגיקה טהורה: האם מותר ליצור עוד טרייד. דרגות בתשלום (basic/pro) - תמיד מותר;
 * דמו - רק מתחת למגבלה, לפי מונה שרת אמין (`demoTradesCreated`) ולא ספירת state
 * בצד קליינט (`trades.length`, שאפשר לעקוף במחיקה+יצירה מחדש). חל רק על יצירה, לא
 * על עריכה/מחיקה של טריידים קיימים.
 */
export function canCreateTrade(tier: AccountTier, demoTradesCreated: number): boolean {
  if (tier !== 'demo') return true
  return demoTradesCreated < DEMO_TRADE_LIMIT
}

/**
 * מנקה את כל הדאטה המסחרית של החשבון - טריידים (+ תמונות גרפים ב-Storage) בכל
 * ה-workspaces שלו, ואת כל שורות ה-watchlist. **לא** נוגעת ב-accounts/access_codes/
 * workspaces עצמם (name/baseCurrency/field_settings נשארים כפי שהוגדרו) - זה החליף
 * את `deleteAccount` הקודם, כי מחיקת חשבון שאי-פעם מימש קוד גישה נכשלת היום
 * (FK RESTRICT על access_codes.redeemed_by, לא תוקן) וגם הייתה הורסת דרגת-מנוי/זהות
 * שהמשתמש לא רוצה לחשוף כפעולה בכלל. `push_subscriptions` נשארת בכוונה - רישום
 * push של מכשיר הוא לא "דאטה מסחרית" ומחיקתה הייתה שוברת התראות בלי תועלת.
 */
export async function clearAccountTradingData(accountId: string, workspaceIds: string[]): Promise<void> {
  for (const workspaceId of workspaceIds) {
    await deleteAllTradesInWorkspace(workspaceId)
  }
  await deleteAllWatchlistAlerts(accountId)
}
