import { getSupabase } from './supabase'

export type SlTpField = 'stop_loss' | 'take_profit'

export interface SlTpHistoryEntry {
  id: string
  tradeId: string
  field: SlTpField
  oldValue: number | null
  newValue: number | null
  changedAt: string
}

interface SlTpHistoryRow {
  id: string
  trade_id: string
  field: SlTpField
  old_value: number | null
  new_value: number | null
  changed_at: string
}

function fromRow(row: SlTpHistoryRow): SlTpHistoryEntry {
  return {
    id: row.id,
    tradeId: row.trade_id,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedAt: row.changed_at,
  }
}

export interface SlTpSnapshot {
  stopLoss: number | null
  takeProfit: number | null
}

export interface SlTpChange {
  field: SlTpField
  oldValue: number | null
  newValue: number | null
}

/**
 * לוגיקה טהורה: אילו שדות (stop_loss/take_profit) השתנו בין הערך הקודם לחדש - כולל
 * null→value ו-value→null, לא רק value→ערך-אחר. מופרדת מ-`recordSlTpChanges` (למטה)
 * כדי שאפשר לבדוק אותה ביחידה בלי Supabase.
 */
export function detectSlTpChanges(previous: SlTpSnapshot, next: SlTpSnapshot): SlTpChange[] {
  const changes: SlTpChange[] = []
  if (previous.stopLoss !== next.stopLoss) {
    changes.push({ field: 'stop_loss', oldValue: previous.stopLoss, newValue: next.stopLoss })
  }
  if (previous.takeProfit !== next.takeProfit) {
    changes.push({ field: 'take_profit', oldValue: previous.takeProfit, newValue: next.takeProfit })
  }
  return changes
}

/** מוסיפה רשומת היסטוריה יחידה (append-only - לעולם לא עורכים/מוחקים רשומות קיימות). */
export async function insertSlTpHistoryEntry(tradeId: string, change: SlTpChange): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('trade_sl_tp_history')
    .insert({ trade_id: tradeId, field: change.field, old_value: change.oldValue, new_value: change.newValue })
  if (error) throw error
}

/**
 * שומרת רשומות היסטוריה לכל שדה SL/TP שהשתנה בעריכת טרייד קיים (ראה `detectSlTpChanges`).
 * best-effort בכוונה - כשל בשמירת ההיסטוריה (טבלת bookkeeping משנית) לא אמור לחסום את
 * שמירת הטרייד עצמו, שכבר הצליחה ב-DB עד שהפונקציה הזו נקראת (ראה `tradesApi.updateTrade`).
 */
export async function recordSlTpChanges(tradeId: string, previous: SlTpSnapshot, next: SlTpSnapshot): Promise<void> {
  const changes = detectSlTpChanges(previous, next)
  try {
    await Promise.all(changes.map((change) => insertSlTpHistoryEntry(tradeId, change)))
  } catch (err) {
    console.error('[slTpHistoryApi] failed to record SL/TP history:', err)
  }
}

/**
 * כל רשומות ההיסטוריה של קבוצת טריידים (workspace שלם), מהישנה לחדשה - נדרש לחישוב
 * ה"ערך המקורי" הנכון בסטטיסטיקה (baseline = הרשומה הכי ישנה, ראה `stats.ts`).
 *
 * best-effort בכוונה - נקראת מ-`App.tsx` בתוך זרימת הטעינה הראשית/מעבר workspace, יחד
 * עם `listTrades` (קריטי). אם השאילתה נכשלת (הכי סביר: `trade_sl_tp_history` עדיין
 * לא קיימת אצל משתמש שטרם הריץ את `024_sl_tp_history.sql`, אבל גם כל כשל רשת/DB חולף
 * אחר) - מחזירה `[]` במקום לזרוק, כדי שהיסטוריה חסרה/זמנית-לא-זמינה תמיד תתנהג כמו
 * "אין עוד היסטוריה" (הכרטיס ב-Dashboard פשוט לא מוצג) ולעולם לא תפיל את טעינת
 * הטריידים/כל שאר האפליקציה איתה - אותו עיקרון בדיוק כמו `recordSlTpChanges` למעלה.
 */
export async function listSlTpHistoryForTrades(tradeIds: string[]): Promise<SlTpHistoryEntry[]> {
  if (tradeIds.length === 0) return []
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('trade_sl_tp_history')
      .select('*')
      .in('trade_id', tradeIds)
      .order('changed_at', { ascending: true })
    if (error) throw error
    return (data as SlTpHistoryRow[]).map(fromRow)
  } catch (err) {
    console.error('[slTpHistoryApi] failed to load SL/TP history (treating as none):', err)
    return []
  }
}
