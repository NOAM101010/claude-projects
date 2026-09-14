import { createTrade, updateTrade } from './tradesApi'
import type { Trade } from '../types/trade'
import type { ParsedExcelRow } from './importExcel'

/** רק תאריך (YYYY-MM-DD), לא זמן מדויק - קובץ Excel חיצוני כנראה לא נושא שעה מדויקת
 * כמו טרייד שנוצר באפליקציה, אז ההשוואה למציאת התאמה קיימת מתעלמת מהשעה. */
function dayOnly(iso: string): string {
  return iso.slice(0, 10)
}

/** שימוש ב-dayOnly ולא בשעה המלאה כמו ב-naturalKey של importData.ts - הבדל מכוון, לא חוסר עקביות:
 * ל-JSON (importData.ts) זה round-trip מדויק מהאפליקציה עצמה, אז יש שעת entryAt מדויקת להשוואה.
 * ל-Excel (כאן) זה קובץ חיצוני שכנראה לא נושא שעה מדויקת של הכניסה, רק תאריך - לכן ההשוואה מסתפקת ביום. */
function naturalKey(row: Pick<Trade, 'symbol' | 'entryAt' | 'entryPrice' | 'quantity'>): string {
  return `${row.symbol}|${dayOnly(row.entryAt)}|${row.entryPrice}|${row.quantity}`
}

/** true אם הערך "ריק" (המקום פנוי להשלמה) - null/undefined/מחרוזת ריקה בלבד. 0 הוא ערך אמיתי, לא ריק. */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

/** שדות שמותר להשלים (לא כולל id/symbol/direction/entryAt/entryPrice/quantity - אלה חלק מהמפתח הטבעי, לא "משלימים" אותם). */
const FILLABLE_FIELDS = ['stopLoss', 'takeProfit', 'exitAt', 'exitPrice', 'pnl', 'fee', 'notes', 'setup'] as const

export interface MergeImportResult {
  created: number
  updated: number
  unchanged: number
  /** שורות שדולגו כי נמצאו כמה טריידים קיימים עם אותו מפתח טבעי - לא ברור איזה מהם לעדכן, לא מנחשים. */
  ambiguous: number
  updatedTrades: Trade[]
  createdTrades: Trade[]
}

/**
 * מייבא שורות Excel חיצוניות: טרייד חדש (לא נמצא מפתח טבעי תואם) -> createTrade עם
 * UUID חדש (כמו importTrades הרגיל - אין id בקובץ חיצוני ממילא). טרייד קיים שתואם ->
 * משלים **רק** שדות שכרגע ריקים אצלו (P&L immutability: pnl קיים - כולל 0 - לעולם לא נדרס,
 * ראה CLAUDE.md). אם אין שום שדה להשלים, לא נשלחת קריאת API כלל (unchanged++).
 */
export async function importOrUpdateTrades(
  workspaceId: string,
  accountId: string,
  rows: ParsedExcelRow[],
  existingTrades: Trade[],
): Promise<MergeImportResult> {
  // מערך ולא טרייד בודד לכל מפתח - אין unique constraint ב-DB שמונע שני טריידים קיימים עם אותו
  // מפתח טבעי (אותו symbol/יום/מחיר כניסה/כמות, שעות כניסה שונות). ראה טיפול ב-ambiguous למטה.
  const byKey = new Map<string, Trade[]>()
  for (const trade of existingTrades) {
    const key = naturalKey(trade)
    const bucket = byKey.get(key)
    if (bucket) bucket.push(trade)
    else byKey.set(key, [trade])
  }

  let created = 0
  let updated = 0
  let unchanged = 0
  let ambiguous = 0
  const updatedTrades: Trade[] = []
  const createdTrades: Trade[] = []

  for (const row of rows) {
    const key = naturalKey(row)
    const matches = byKey.get(key)

    if (!matches || matches.length === 0) {
      const newTrade: Trade = {
        id: crypto.randomUUID(),
        symbol: row.symbol,
        direction: row.direction,
        entryAt: row.entryAt,
        entryPrice: row.entryPrice,
        quantity: row.quantity,
        stopLoss: row.stopLoss ?? null,
        takeProfit: row.takeProfit ?? null,
        exitAt: row.exitAt ?? null,
        exitPrice: row.exitPrice ?? null,
        pnl: row.pnl ?? null,
        currency: 'USD',
        fee: row.fee ?? null,
        notes: row.notes ?? '',
        setup: row.setup,
      }
      const result = await createTrade(workspaceId, accountId, newTrade)
      createdTrades.push(result)
      byKey.set(key, [result])
      created += 1
      continue
    }

    if (matches.length > 1) {
      // כמה טריידים קיימים תואמים לאותו מפתח - לא ברור איזה לעדכן, לא מנחשים. דלג ותסמן ambiguous.
      ambiguous += 1
      continue
    }

    const existing = matches[0]
    const patch: Partial<Trade> = {}
    for (const field of FILLABLE_FIELDS) {
      const existingValue = existing[field]
      const incomingValue = row[field]
      if (isEmpty(existingValue) && !isEmpty(incomingValue)) {
        ;(patch as Record<string, unknown>)[field] = incomingValue
      }
    }
    // notes בטרייד קיים תמיד string ('' אם ריק) - לא null/undefined, ה-isEmpty הכללי כבר מכסה '' .

    if (Object.keys(patch).length === 0) {
      unchanged += 1
      continue
    }

    const merged: Trade = { ...existing, ...patch }
    const result = await updateTrade(existing.id, merged)
    updatedTrades.push(result)
    byKey.set(key, [result])
    updated += 1
  }

  return { created, updated, unchanged, ambiguous, updatedTrades, createdTrades }
}
