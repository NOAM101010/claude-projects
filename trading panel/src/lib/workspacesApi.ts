import { getSupabase } from './supabase'
import type { AccountTier } from './accountApi'
import type { CurrencyCode } from '../types/trade'

export interface FieldSettings {
  stopLoss: boolean
  takeProfit: boolean
  fee: boolean
  notes: boolean
  setup: boolean
  /** true = טופס הטרייד דורש שעה מדויקת (datetime-local) לכניסה/יציאה, כמו שהיה תמיד.
   * false = תאריך בלבד (type=date), עם 12:00 בצהריים כזמן ברירת מחדל בשמירה - ראה TradeForm.tsx. */
  requireExactTime: boolean
}

/** ברירת מחדל: כל השדות האופציונליים דלוקים (סימבול/כיוון/כניסה/יציאה/כמות/מטבע תמיד חובה, לא ב-toggle).
 * requireExactTime=true שומר על ההתנהגות הקיימת (שעה מדויקת חובה) לכל המשתמשים הקיימים. */
export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  stopLoss: true,
  takeProfit: true,
  fee: true,
  notes: true,
  setup: true,
  requireExactTime: true,
}

export interface Workspace {
  id: string
  accountId: string
  name: string
  fieldSettings: FieldSettings
  baseCurrency: CurrencyCode
}

interface WorkspaceRow {
  id: string
  account_id: string
  name: string
  field_settings: Partial<FieldSettings> | null
  base_currency: CurrencyCode
}

function fromRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    fieldSettings: { ...DEFAULT_FIELD_SETTINGS, ...(row.field_settings ?? {}) },
    baseCurrency: row.base_currency,
  }
}

/**
 * מחזיר את ה-workspace הראשון (הישן ביותר) של החשבון הנוכחי, ויוצר workspace
 * ברירת מחדל ("הראשי", כל השדות דלוקים) אם עדיין אין לו אף אחד.
 */
export async function ensureWorkspace(accountId: string): Promise<Workspace> {
  const supabase = getSupabase()

  const { data: existing, error: selectError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return fromRow(existing as WorkspaceRow)

  const { data: created, error: insertError } = await supabase
    .from('workspaces')
    .insert({ account_id: accountId, name: 'Main', field_settings: DEFAULT_FIELD_SETTINGS })
    .select('*')
    .single()
  if (insertError || !created) throw insertError ?? new Error('Failed to create workspace')
  return fromRow(created as WorkspaceRow)
}

/** מעדכן את הגדרות ה-toggle לשדות בטופס. לעולם לא נוגע בדאטה של טריידים קיימים. */
export async function updateFieldSettings(workspaceId: string, fieldSettings: FieldSettings): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('workspaces').update({ field_settings: fieldSettings }).eq('id', workspaceId)
  if (error) throw error
}

/** מגבלת מרחבי העבודה לחשבון Pro (trading-journal-plan.md סעיף 2). */
export const MAX_PRO_WORKSPACES = 5

/**
 * לוגיקה טהורה לאכיפת המגבלה: דרגות שאינן Pro תמיד נעולות ל-workspace יחיד (זה שכבר
 * נוצר ע"י `ensureWorkspace`, אין להן כפתור יצירה בכלל) - Pro מוגבל ל-`MAX_PRO_WORKSPACES`.
 */
export function canCreateWorkspace(tier: AccountTier, currentCount: number): boolean {
  if (tier !== 'pro') return false
  return currentCount < MAX_PRO_WORKSPACES
}

/** כל מרחבי העבודה של החשבון, מהישן לחדש. */
export async function listWorkspaces(accountId: string): Promise<Workspace[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as WorkspaceRow[]).map(fromRow)
}

/**
 * יוצר מרחב עבודה נוסף לחשבון Pro. זורק אם החשבון לא Pro או שכבר הגיע למגבלה.
 */
export async function createWorkspace(accountId: string, tier: AccountTier, name: string): Promise<Workspace> {
  const supabase = getSupabase()
  const existing = await listWorkspaces(accountId)
  if (!canCreateWorkspace(tier, existing.length)) {
    throw new Error('Creating another workspace requires a Pro upgrade, or you already reached the 5-workspace limit')
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ account_id: accountId, name, field_settings: DEFAULT_FIELD_SETTINGS })
    .select('*')
    .single()
  if (error || !data) throw error ?? new Error('Failed to create workspace')
  return fromRow(data as WorkspaceRow)
}

/** משנה את שם ה-workspace בלבד. */
export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('workspaces').update({ name }).eq('id', workspaceId)
  if (error) throw error
}

export interface WorkspaceSettingsPatch {
  name?: string
  baseCurrency?: CurrencyCode
}

/** עדכון גנרי של שם/מטבע בסיס. לא נוגע ב-field_settings (ראה `updateFieldSettings`). */
export async function updateWorkspaceSettings(workspaceId: string, patch: WorkspaceSettingsPatch): Promise<void> {
  const supabase = getSupabase()
  const row: { name?: string; base_currency?: CurrencyCode } = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.baseCurrency !== undefined) row.base_currency = patch.baseCurrency

  const { error } = await supabase.from('workspaces').update(row).eq('id', workspaceId)
  if (error) throw error
}
