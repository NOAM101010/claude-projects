import type { AccountTier } from './accountApi'

/**
 * טבלת המגבלות המספריות לכל דרגה - המקור היחיד לאמת (single source of truth) לשלושת
 * המגבלות התלויות-דרגה: תמונות גרף, סימבולי watchlist פעילים, והתראות מחיר. מגבלת
 * ה-workspaces (MAX_PRO_WORKSPACES ב-workspacesApi.ts) **לא** כאן בכוונה - היא כבר
 * הייתה תלוית-דרגה לפני המשימה הזו ונשארת במקומה המקורי, לא הוזזה.
 *
 * המספרים כאן חייבים להיות זהים בדיוק למה שה-DB אוכף ב-supabase/018_tier_based_limits.sql -
 * אין נגזרת (drift) מותרת בין קליינט לשרת.
 */

/** מגבלת תמונות גרף לכל workspace, לפי דרגה (הייתה קבועה על 50 לכולם - CHART_IMAGE_LIMIT הישן ב-chartImagesApi.ts). */
export const CHART_IMAGE_LIMIT_BY_TIER: Record<AccountTier, number> = {
  demo: 1,
  basic: 50,
  pro: 150,
}

/** מגבלת סימבולים פעילים ב-watchlist (שורות עם/בלי התראה, ביחד), לפי דרגה - הייתה קבועה על 15 לכולם (MAX_WATCHLIST_ALERTS הישן ב-watchlistApi.ts). */
export const WATCHLIST_SYMBOL_LIMIT_BY_TIER: Record<AccountTier, number> = {
  demo: 2,
  basic: 20,
  pro: 50,
}

/** מגבלת שורות עם התראת מחיר פעילה (target_price לא null) מתוך סימבולי המעקב, לפי דרגה -
 * מגבלה חדשה, לא הייתה קיימת קודם. דמו=0: אפשר לעקוב אחרי סימבולים אבל בלי שום התראת מחיר. */
export const WATCHLIST_ALERT_LIMIT_BY_TIER: Record<AccountTier, number> = {
  demo: 0,
  basic: 10,
  pro: 30,
}

export function getChartImageLimit(tier: AccountTier): number {
  return CHART_IMAGE_LIMIT_BY_TIER[tier]
}

/**
 * לוגיקה טהורה: האם מותר להעלות תמונת גרף נוספת ל-workspace. אם לטרייד הנוכחי (עריכה)
 * כבר יש תמונה משלו - החלפתה לא נספרת כתמונה "נוספת", ולכן מותרת גם מעל המגבלה.
 */
export function canUploadChartImage(tier: AccountTier, currentImageCount: number, hasImageOnThisTradeAlready: boolean): boolean {
  if (hasImageOnThisTradeAlready) return true
  return currentImageCount < getChartImageLimit(tier)
}

export function getWatchlistSymbolLimit(tier: AccountTier): number {
  return WATCHLIST_SYMBOL_LIMIT_BY_TIER[tier]
}

/** לוגיקה טהורה - סופרת רק שורות watchlist פעילות (active=true), תואם לטריגר בשרת. */
export function canAddWatchlistSymbol(tier: AccountTier, currentActiveCount: number): boolean {
  return currentActiveCount < getWatchlistSymbolLimit(tier)
}

export function getWatchlistAlertLimit(tier: AccountTier): number {
  return WATCHLIST_ALERT_LIMIT_BY_TIER[tier]
}

/** לוגיקה טהורה - סופרת רק שורות watchlist פעילות עם target_price לא-null, לפני הוספת/הגדרת ההתראה הנוכחית. */
export function canSetWatchlistAlert(tier: AccountTier, currentAlertCount: number): boolean {
  return currentAlertCount < getWatchlistAlertLimit(tier)
}
