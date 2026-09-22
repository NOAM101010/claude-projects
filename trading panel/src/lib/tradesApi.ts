import { deleteChartImage } from './chartImagesApi'
import { recordSlTpChanges } from './slTpHistoryApi'
import { getSupabase } from './supabase'
import type { CurrencyCode, Direction, Setup, Trade, TradeInput } from '../types/trade'

/** שורת trades כפי שהיא ב-DB (snake_case, תואמת ל-supabase/001_init_schema.sql + 002). */
export interface TradeRow {
  id: string
  workspace_id: string
  account_id: string
  symbol: string
  direction: Direction
  entry_at: string
  entry_price: number
  quantity: number
  stop_loss: number | null
  take_profit: number | null
  exit_at: string | null
  exit_price: number | null
  currency: CurrencyCode
  fee: number | null
  pnl: number | null
  notes: string | null
  setup: string | null
  chart_image_url: string | null
}

/** ממפה שורת DB לטיפוס ה-Trade שהרכיבים בקליינט כבר יודעים להציג. */
export function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    entryAt: row.entry_at,
    entryPrice: row.entry_price,
    quantity: row.quantity,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    exitAt: row.exit_at,
    exitPrice: row.exit_price,
    pnl: row.pnl,
    currency: row.currency,
    fee: row.fee,
    notes: row.notes ?? '',
    setup: (row.setup as Setup | null) ?? undefined,
    chartImageUrl: row.chart_image_url ?? undefined,
  }
}

/** ממפה TradeInput (מה שהטופס שומר) לשורת insert/update. אחראי הקורא לצרף workspace_id/account_id/id. */
export function tradeInputToRow(input: TradeInput): Omit<TradeRow, 'id' | 'workspace_id' | 'account_id'> {
  return {
    symbol: input.symbol,
    direction: input.direction,
    entry_at: input.entryAt,
    entry_price: input.entryPrice,
    quantity: input.quantity,
    stop_loss: input.stopLoss,
    take_profit: input.takeProfit,
    exit_at: input.exitAt,
    exit_price: input.exitPrice,
    currency: input.currency,
    fee: input.fee,
    pnl: input.pnl,
    notes: input.notes,
    setup: input.setup ?? null,
    chart_image_url: input.chartImageUrl ?? null,
  }
}

/** גודל כל עמוד ב-pagination הפנימית של `listTrades` - נמוך מכל מגבלת שורות בפרויקטי
 * Supabase/PostgREST מתארחים סטנדרטיים (בד"כ 1000), כדי שאף פעם לא נפגע במגבלה ההיא
 * בתוך עמוד בודד. */
const LIST_TRADES_PAGE_SIZE = 1000

/**
 * שולף את **כל** הטריידים של workspace, גם כשיש יותר מ-`LIST_TRADES_PAGE_SIZE`.
 * Supabase/PostgREST hosted מגביל כל query בודד (בד"כ ~1000 שורות) בלי שגיאה - מעבר
 * לזה חוזר set חתוך בשקט, מה שהיה מצמצם בלי אזהרה את כל הסטטיסטיקות בחשבון גדול.
 * ממשיכה לדפדף (`.range`) עד שעמוד חוזר קטן מהגודל המלא, ומצרפת הכל - חוזה ה-API
 * הציבורי (מחזירה את כל הטריידים במערך אחד) נשאר זהה למי שקורא לפונקציה.
 */
export async function listTrades(workspaceId: string): Promise<Trade[]> {
  const supabase = getSupabase()
  const allRows: TradeRow[] = []
  let from = 0

  for (;;) {
    const to = from + LIST_TRADES_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('entry_at', { ascending: false })
      .range(from, to)
    if (error) throw error

    const rows = data as TradeRow[]
    allRows.push(...rows)
    if (rows.length < LIST_TRADES_PAGE_SIZE) break
    from += LIST_TRADES_PAGE_SIZE
  }

  return allRows.map(rowToTrade)
}

/** סכום P&L גולמי (בלי המרת שער - אותה פשטות בדיוק כמו DesktopStatBar's `totalPnl`,
 * ראה LOCK_CURRENCY_TO_USD) לכל workspace ב-`workspaceIds`, לתצוגת preview ב-
 * WorkspaceSwitcher.tsx (כרטיסי-preview, workspace-switcher-cards-directions.html כיוון 1).
 * שולפת רק את שתי העמודות שצריך (`workspace_id`,`pnl`) במקום `listTrades` המלא - זול
 * משמעותית לרשימה של עד 5 workspaces (מגבלת Pro). מסננת גם לפי `account_id` במפורש
 * (לא רק RLS) - בידוד לקוחות, אותה מוסכמה כמו שאר הפרויקט. טריידים פתוחים (pnl null)
 * לא נספרים, בדיוק כמו totalPnl. */
export async function getWorkspacePnlTotals(accountId: string, workspaceIds: string[]): Promise<Record<string, number>> {
  const totals: Record<string, number> = {}
  if (workspaceIds.length === 0) return totals
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('trades')
    .select('workspace_id, pnl')
    .eq('account_id', accountId)
    .in('workspace_id', workspaceIds)
    .not('pnl', 'is', null)
  if (error) throw error
  for (const row of data as { workspace_id: string; pnl: number | null }[]) {
    totals[row.workspace_id] = (totals[row.workspace_id] ?? 0) + (row.pnl ?? 0)
  }
  return totals
}

export async function createTrade(workspaceId: string, accountId: string, trade: Trade): Promise<Trade> {
  const supabase = getSupabase()
  const { id: _ignoredId, ...input } = trade
  const { data, error } = await supabase
    .from('trades')
    .insert({ id: trade.id, workspace_id: workspaceId, account_id: accountId, ...tradeInputToRow(input) })
    .select('*')
    .single()
  if (error || !data) throw error ?? new Error('Failed to create trade')
  return rowToTrade(data as TradeRow)
}

/**
 * מעדכנת טרייד קיים. לפני העדכון שולפת את ה-stop_loss/take_profit הישנים (שורה נפרדת,
 * זולה) כדי לזהות שינוי ב-SL/TP ולשמור רשומת היסטוריה עליו (`recordSlTpChanges`,
 * best-effort - ראה שם) - כך שגם `App.tsx` (עריכה ידנית) וגם `mergeImport.ts` (ייבוא/מיזוג)
 * מקבלים את אותה שמירת היסטוריה בלי לשכפל את הלוגיקה בכל קורא.
 */
export async function updateTrade(id: string, trade: Trade): Promise<Trade> {
  const supabase = getSupabase()
  const { data: previousRow, error: fetchError } = await supabase
    .from('trades')
    .select('stop_loss, take_profit')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const { id: _ignoredId, ...input } = trade
  const { data, error } = await supabase.from('trades').update(tradeInputToRow(input)).eq('id', id).select('*').single()
  if (error || !data) throw error ?? new Error('Failed to update trade')

  const previous = previousRow as { stop_loss: number | null; take_profit: number | null }
  await recordSlTpChanges(id, { stopLoss: previous.stop_loss, takeProfit: previous.take_profit }, { stopLoss: trade.stopLoss, takeProfit: trade.takeProfit })

  return rowToTrade(data as TradeRow)
}

export async function deleteTrade(id: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

/**
 * מוחקת את **כל** הטריידים של workspace, כולל תמונות הגרפים המשויכות ב-Storage.
 * שימוש יחיד ומכוון: שינוי `style` של workspace שכבר יש בו טריידים (ראה
 * `WorkspaceSettings.tsx`) - זו פעולה הרסנית בכוונה, שונה לגמרי מ-toggle של שדות
 * (`updateFieldSettings`) שלעולם לא נוגע בדאטה. מוחקת קודם את שורות ה-DB, ורק אז
 * מנקה קבצי Storage יתומים (best-effort - כשל מחיקת קובץ בודד לא עוצר את השאר).
 */
export async function deleteAllTradesInWorkspace(workspaceId: string): Promise<void> {
  const supabase = getSupabase()
  const { data, error: selectError } = await supabase
    .from('trades')
    .select('chart_image_url')
    .eq('workspace_id', workspaceId)
  if (selectError) throw selectError

  const imagePaths = (data as { chart_image_url: string | null }[])
    .map((row) => row.chart_image_url)
    .filter((path): path is string => Boolean(path))

  const { error: deleteError } = await supabase.from('trades').delete().eq('workspace_id', workspaceId)
  if (deleteError) throw deleteError

  await Promise.all(imagePaths.map((path) => deleteChartImage(path).catch(() => {})))
}
