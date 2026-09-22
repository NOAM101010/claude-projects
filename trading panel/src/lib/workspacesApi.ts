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

/** תבניות סגנון מסחר (ראה robust-munching-puffin.md) - קובעות ברירות מחדל ל-fieldSettings
 * ואילו כלים מוצגים ב-Tools. `null` = עדיין לא נבחרה תבנית (לא שקול ל"הכל פתוח"). */
export type WorkspaceTemplate = 'day' | 'swing' | 'longterm' | 'crypto'

/** טאבים הקיימים במסך Tools - מקור האמת היחיד (Tools.tsx מייבא מכאן, לא מגדיר בעצמו). */
export type ToolsTab = 'positionSize' | 'pnl' | 'watchlist' | 'scaleIn' | 'scaleOut' | 'cagr' | 'liquidation'

/** ברירות מחדל ל-fieldSettings לפי תבנית (הטבלה המאושרת ב-robust-munching-puffin.md).
 * המשתמש עדיין יכול לשנות כל שדה ידנית אחר כך בהגדרות - זו רק ברירת המחדל בבחירה. */
export const TEMPLATE_FIELD_DEFAULTS: Record<WorkspaceTemplate, FieldSettings> = {
  day: { requireExactTime: true, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
  swing: { requireExactTime: false, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
  longterm: { requireExactTime: false, stopLoss: false, takeProfit: false, fee: true, setup: false, notes: true },
  crypto: { requireExactTime: true, stopLoss: true, takeProfit: true, fee: true, setup: true, notes: true },
}

/** אילו טאבים ב-Tools מוצגים לכל תבנית - Long-term ללא Position Size (ראה התוכנית). כלי
 * ייחודיים לתבנית (סבב C1, robust-munching-puffin.md): swing מקבל Scale-in/out, longterm
 * מקבל CAGR, crypto מקבל Liquidation Price. */
export const TEMPLATE_TOOLS: Record<WorkspaceTemplate, ToolsTab[]> = {
  day: ['positionSize', 'pnl', 'watchlist'],
  swing: ['positionSize', 'pnl', 'watchlist', 'scaleIn', 'scaleOut'],
  longterm: ['pnl', 'watchlist', 'cagr'],
  crypto: ['positionSize', 'pnl', 'watchlist', 'liquidation'],
}

export interface Workspace {
  id: string
  accountId: string
  name: string
  fieldSettings: FieldSettings
  baseCurrency: CurrencyCode
  template: WorkspaceTemplate | null
  /** תקציב סיכון יומי (Day Trading בלבד, robust-munching-puffin.md סבב C2) - null = לא
   * הוגדר. משמש רק ל-`DailyRiskBudgetCard`/`dailyRiskBudgetUsage`, לא נאכף על שמירת טריידים. */
  dailyRiskBudget: number | null
  /** מגבלת מספר טריידים ביום (Day Trading בלבד, special-design round) - null = לא הוגדרה.
   * משמש רק ל-`DayTradeLimitCard`/`dayTradeLimitUsage`, לא נאכף על שמירת טריידים. */
  maxTradesPerDay: number | null
  /** שווי תיק כולל (Long-term בלבד, special-design round) - null = לא הוגדר. משמש רק
   * ל-`PortfolioWeightCard`/`portfolioWeights`, לא נאכף על שמירת טריידים. */
  totalPortfolioValue: number | null
}

interface WorkspaceRow {
  id: string
  account_id: string
  name: string
  field_settings: Partial<FieldSettings> | null
  base_currency: CurrencyCode
  template: WorkspaceTemplate | null
  daily_risk_budget: number | null
  max_trades_per_day: number | null
  total_portfolio_value: number | null
}

function fromRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    fieldSettings: { ...DEFAULT_FIELD_SETTINGS, ...(row.field_settings ?? {}) },
    baseCurrency: row.base_currency,
    // ?? null (לא row.template ישירות) - מכסה גם את המצב שלפני שהמיגרציה 025 רצה, שבו
    // `select('*')` פשוט לא מחזיר את העמודה בכלל (row.template === undefined).
    template: row.template ?? null,
    // אותו עיקרון בדיוק - מכסה מצב שלפני מיגרציה 028 (row.daily_risk_budget === undefined).
    dailyRiskBudget: row.daily_risk_budget ?? null,
    // אותו עיקרון - מכסה מצב שלפני מיגרציה 031 (row.max_trades_per_day/total_portfolio_value === undefined).
    maxTradesPerDay: row.max_trades_per_day ?? null,
    totalPortfolioValue: row.total_portfolio_value ?? null,
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

/**
 * לוגיקה טהורה לאכיפת ההרשאות על בחירת/שינוי תבנית (robust-munching-puffin.md סבב B):
 * Demo/Pro תמיד חופשיים לבחור/להחליף. Basic חופשי רק בבחירה הראשונה (template===null) -
 * שינוי אחרי שכבר נבחרה תבנית דורש קוד גישה מסוג template-switch (ר' switch-template
 * Edge Function + redeemTemplateSwitchCode).
 */
export function canSelectTemplateDirectly(tier: AccountTier, currentTemplate: WorkspaceTemplate | null): boolean {
  return !(tier === 'basic' && currentTemplate !== null)
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
 * `template` אופציונלי - Pro תמיד חופשי לבחור תבנית כבר ביצירה (ר' canSelectTemplateDirectly);
 * כשמושמט, ה-workspace נוצר עם template=null בדיוק כמו קודם (בחירה מאוחרת יותר דרך
 * TemplatePicker). אין עדיין UI חשוף שמעביר template בפועל (HIDE_NEW_WORKSPACE_BUTTON) -
 * זו הכנה לעתיד, ר' robust-munching-puffin.md סבב B סעיף 4.
 */
export async function createWorkspace(accountId: string, tier: AccountTier, name: string, template?: WorkspaceTemplate): Promise<Workspace> {
  const supabase = getSupabase()
  const existing = await listWorkspaces(accountId)
  if (!canCreateWorkspace(tier, existing.length)) {
    throw new Error('Creating another workspace requires a Pro upgrade, or you already reached the 5-workspace limit')
  }

  const row: { account_id: string; name: string; field_settings: FieldSettings; template?: WorkspaceTemplate } = {
    account_id: accountId,
    name,
    field_settings: template ? TEMPLATE_FIELD_DEFAULTS[template] : DEFAULT_FIELD_SETTINGS,
  }
  if (template) row.template = template

  const { data, error } = await supabase.from('workspaces').insert(row).select('*').single()
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
  dailyRiskBudget?: number | null
  maxTradesPerDay?: number | null
  totalPortfolioValue?: number | null
}

/** עדכון גנרי של שם/מטבע בסיס/תקציב סיכון יומי/מגבלת טריידים יומית/שווי תיק כולל. לא נוגע ב-field_settings (ראה `updateFieldSettings`). */
export async function updateWorkspaceSettings(workspaceId: string, patch: WorkspaceSettingsPatch): Promise<void> {
  const supabase = getSupabase()
  const row: {
    name?: string
    base_currency?: CurrencyCode
    daily_risk_budget?: number | null
    max_trades_per_day?: number | null
    total_portfolio_value?: number | null
  } = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.baseCurrency !== undefined) row.base_currency = patch.baseCurrency
  if (patch.dailyRiskBudget !== undefined) row.daily_risk_budget = patch.dailyRiskBudget
  if (patch.maxTradesPerDay !== undefined) row.max_trades_per_day = patch.maxTradesPerDay
  if (patch.totalPortfolioValue !== undefined) row.total_portfolio_value = patch.totalPortfolioValue

  const { error } = await supabase.from('workspaces').update(row).eq('id', workspaceId)
  if (error) throw error
}

/**
 * קובעת תבנית ל-workspace + ממלאת את fieldSettings בברירות המחדל התואמות, באותה קריאה -
 * כדי שבחירת תבנית תמיד תגדיר ברירות מחדל עקביות, לא רק את השדה template.
 *
 * זו רק הפעולה הטכנית - **לא** אוכפת הרשאות (Demo/Pro חופשי, Basic-בחירה-ראשונה חופשי,
 * Basic-שינוי דורש קוד גישה). אכיפת ההרשאות מגיעה בסבב B יחד עם מנגנון קוד ה-template-switch
 * (ראה robust-munching-puffin.md) - בסבב הזה הפונקציה נקראת רק מ-TemplatePicker בזרימת
 * הבחירה הראשונה (שתמיד חינם לכולם), אין עדיין נקודת UI לשינוי תבנית קיימת.
 */
export async function setWorkspaceTemplate(workspaceId: string, template: WorkspaceTemplate): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('workspaces')
    .update({ template, field_settings: TEMPLATE_FIELD_DEFAULTS[template] })
    .eq('id', workspaceId)
  if (error) throw error
}
