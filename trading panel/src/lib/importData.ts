import { createTrade } from './tradesApi'
import { CURRENCIES } from '../types/trade'
import type { CurrencyCode, Direction, Trade } from '../types/trade'

const REQUIRED_STRING_FIELDS: Array<keyof Trade> = ['id', 'symbol', 'entryAt', 'notes']

function isDirection(value: unknown): value is Direction {
  return value === 'long' || value === 'short'
}

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

/** מוודא שערך בודד תואם למבנה Trade (כפי ש-`buildTradesJson` מייצא). זורק שגיאה מפורטת עם אינדקס+שדה שגוי. */
function validateTrade(raw: unknown, index: number): Trade {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Trade at index ${index} is not an object`)
  }
  const t = raw as Record<string, unknown>

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof t[field] !== 'string') {
      throw new Error(`Trade at index ${index} is missing required text field "${field}"`)
    }
  }
  if (typeof t.entryPrice !== 'number' || typeof t.quantity !== 'number') {
    throw new Error(`Trade at index ${index} must have numeric entryPrice and quantity`)
  }
  if (!isDirection(t.direction)) {
    throw new Error(`Trade at index ${index} has an invalid direction (must be "long" or "short")`)
  }
  if (!isCurrency(t.currency)) {
    throw new Error(`Trade at index ${index} has an invalid or unsupported currency`)
  }
  if (
    !isNullableNumber(t.stopLoss ?? null) ||
    !isNullableNumber(t.takeProfit ?? null) ||
    !isNullableNumber(t.exitPrice ?? null) ||
    !isNullableNumber(t.pnl ?? null) ||
    !isNullableNumber(t.fee ?? null)
  ) {
    throw new Error(`Trade at index ${index} has an invalid numeric field (expected a number or null)`)
  }
  if (t.exitAt !== null && t.exitAt !== undefined && typeof t.exitAt !== 'string') {
    throw new Error(`Trade at index ${index} has an invalid exitAt`)
  }

  return {
    id: t.id as string,
    symbol: t.symbol as string,
    direction: t.direction,
    entryAt: t.entryAt as string,
    entryPrice: t.entryPrice,
    quantity: t.quantity,
    stopLoss: (t.stopLoss as number | null) ?? null,
    takeProfit: (t.takeProfit as number | null) ?? null,
    exitAt: (t.exitAt as string | null) ?? null,
    exitPrice: (t.exitPrice as number | null) ?? null,
    // כלל ברזל: ה-pnl נכנס בדיוק כפי שהיה בקובץ - לעולם לא מחושב מחדש (P&L immutability, ראה CLAUDE.md).
    pnl: (t.pnl as number | null) ?? null,
    currency: t.currency,
    fee: (t.fee as number | null) ?? null,
    notes: t.notes as string,
    setup: typeof t.setup === 'string' ? t.setup : undefined,
    chartImageUrl: typeof t.chartImageUrl === 'string' ? t.chartImageUrl : undefined,
  }
}

/**
 * מפענח תוכן קובץ JSON מיוצא (ראה `exportData.ts`'s `buildTradesJson`) חזרה למערך טריידים.
 * פונקציה טהורה - לא נוגעת ברשת/דפדפן, זורקת שגיאה ברורה אם המבנה לא תקין.
 */
export function parseTradesJson(fileContent: string): Trade[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(fileContent)
  } catch {
    throw new Error('File is not valid JSON')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of trades')
  }
  return parsed.map((raw, index) => validateTrade(raw, index))
}

/** מפתח טבעי לזיהוי כפילות - לא כולל id, כי כל טרייד מיובא מקבל UUID חדש (ראה `importTrades`). */
function naturalKey(trade: Trade): string {
  return `${trade.symbol}|${trade.entryAt}|${trade.entryPrice}|${trade.quantity}`
}

export interface ImportResult {
  imported: number
  skipped: number
  /** הטריידים שנוצרו בפועל (עם ה-id/שרת שהוקצו) - להוספה ל-state הקיים ב-App.tsx בלי query נוסף. */
  importedTrades: Trade[]
}

/**
 * מייבא טריידים ל-workspace נתון, מדלג על כפילויות מול `existingTrades` (כבר טעונים בזיכרון -
 * בלי query נוסף) לפי המפתח הטבעי symbol+entryAt+entryPrice+quantity. ה-id המקורי מהקובץ
 * לא נשמר - כל טרייד מיובא מקבל UUID חדש, כדי למנוע התנגשות מול ה-id הגלובלי המקורי
 * (למשל ייבוא אותו קובץ שוב, או ייבוא ל-workspace/חשבון אחר שבו ה-id כבר תפוס).
 */
export async function importTrades(
  workspaceId: string,
  accountId: string,
  tradesToImport: Trade[],
  existingTrades: Trade[],
): Promise<ImportResult> {
  const existingKeys = new Set(existingTrades.map(naturalKey))
  const importedTrades: Trade[] = []
  let skipped = 0

  for (const trade of tradesToImport) {
    const key = naturalKey(trade)
    if (existingKeys.has(key)) {
      skipped += 1
      continue
    }
    const created = await createTrade(workspaceId, accountId, { ...trade, id: crypto.randomUUID() })
    importedTrades.push(created)
    existingKeys.add(key)
  }

  return { imported: importedTrades.length, skipped, importedTrades }
}
