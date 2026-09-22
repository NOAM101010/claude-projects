import { computePnl } from './stats'
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

/** שדות שמותר להשלים (לא כולל id/symbol/direction/entryAt/entryPrice/quantity - אלה חלק מהמפתח הטבעי, לא "משלימים" אותם).
 * pnl **לא** ברשימה בכוונה - לעולם לא מולא/נדרס מה-`row` verbatim, ראה הטיפול הייעודי בו למטה. */
const FILLABLE_FIELDS = ['stopLoss', 'takeProfit', 'exitAt', 'exitPrice', 'fee', 'notes', 'setup'] as const

/** שדות "זהות" - עובדות קונקרטיות על איך הטרייד הספציפי הזה התנהל (איפה/מתי יצא, מה התוכנית/הערות
 * עליו) שהבדל בהן מוכיח חד-משמעית שמדובר בשני טריידים שונים. **לא** כולל pnl/fee בכוונה: אלה ערכים
 * מחושבים/משתנים (עיגולי עמלה, חישובי רווח שונים בין מקורות) שיכולים להשתנות בין ייבוא לייבוא
 * לאותו טרייד בדיוק - הבדל בהם לבד לא אומר שזה טרייד אחר, וממילא pnl קיים אף פעם לא נדרס (immutability). */
const DISTINGUISHING_FIELDS = ['stopLoss', 'takeProfit', 'exitAt', 'exitPrice', 'notes', 'setup'] as const

/** true אם לשני הצדדים יש ערך לא-ריק אבל שונה - סימן חד-משמעי ששתי השורות הן טריידים שונים,
 * לא אותו טרייד. (אם צד אחד ריק - אין סתירה, פשוט אין מידע להשוואה). */
function valuesConflict(a: unknown, b: unknown): boolean {
  if (isEmpty(a) || isEmpty(b)) return false
  return a !== b
}

/** true אם למועמד יש שדה מזהה (מחיר/תאריך יציאה, סטופ/יעד, הערות/סטאפ) שסותר את הערך המקביל
 * בשורה המיובאת - כלומר זה בוודאות טרייד אחר ולא אותו טרייד, למרות שיתוף המפתח הטבעי הגס
 * (symbol+יום+מחיר כניסה+כמות). זו ההגנה מפני שני טריידים אמיתיים ושונים (למשל שתי כניסות
 * AAPL עוקבות באותו יום באותו גודל פוזיציה) שהתאבכו בטעות בעבר לטרייד אחד. */
function hasDistinguishingConflict(
  row: Partial<Pick<Trade, (typeof DISTINGUISHING_FIELDS)[number]>>,
  candidate: Trade,
): boolean {
  return DISTINGUISHING_FIELDS.some((field) => valuesConflict(candidate[field], row[field]))
}

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
 * ראה CLAUDE.md). יוצא מן הכלל היחיד: אם exitPrice עכשיו מתמלא לראשונה (הטרייד היה פתוח),
 * pnl מחושב מ-computePnl() באותו רגע - ראה הטיפול הייעודי למטה - כדי שטרייד שנסגר דרך
 * הייבוא לא יישאר עם pnl=null (מסווג בטעות כ"פתוח", ראה stats.ts isTradeOpen). אם אין שום
 * שדה להשלים, לא נשלחת קריאת API כלל (unchanged++).
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
    const bucket = byKey.get(key) ?? []
    // מבין כל הטריידים שחולקים את המפתח הגס (symbol+יום+מחיר כניסה+כמות), משאירים רק את אלה
    // שלא סותרים את השורה הנוכחית בשדה FILLABLE כלשהו (מחיר/תאריך יציאה, הערות וכו') - סתירה
    // בשדה כזה מוכיחה חד-משמעית שזה טרייד אחר, לא אותו טרייד. ראה hasDistinguishingConflict.
    const candidates = bucket.filter((candidate) => !hasDistinguishingConflict(row, candidate))

    if (candidates.length === 0) {
      // אין טרייד קיים (או שכל מי שחולק את המפתח הגס נסתר בפועל ע"י שדה מבדיל) - טרייד חדש.
      const rowExitPrice = row.exitPrice ?? null
      const rowFee = row.fee ?? null
      // pnl תמיד מחושב מ-computePnl() כש-exitPrice קיים, לא נלקח verbatim מהשורה - אותו
      // עיקרון כמו parseTradesJson ב-importData.ts (ראה שם), כדי ש-pnl/exitPrice לא ייצאו
      // מסונכרנים גם כשמקור הנתונים (Excel חיצוני) לא כולל pnl תקין.
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
        exitPrice: rowExitPrice,
        pnl:
          rowExitPrice !== null
            ? computePnl({ direction: row.direction, entryPrice: row.entryPrice, exitPrice: rowExitPrice, quantity: row.quantity, fee: rowFee })
            : null,
        currency: 'USD',
        fee: rowFee,
        notes: row.notes ?? '',
        setup: row.setup,
      }
      const result = await createTrade(workspaceId, accountId, newTrade)
      createdTrades.push(result)
      // מוסיפים לדלי הקיים (לא מחליפים אותו!) - כדי ששורה נוספת באותו ריצת ייבוא שחולקת את
      // אותו מפתח גס עדיין תראה גם את הטריידים הקודמים שחלקו אותו, ולא רק את זה שנוצר עכשיו.
      byKey.set(key, [...bucket, result])
      created += 1
      continue
    }

    if (candidates.length > 1) {
      // כמה טריידים קיימים תואמים לאותו מפתח בלי סתירה מבדילה - לא ברור איזה לעדכן, לא מנחשים.
      ambiguous += 1
      continue
    }

    const existing = candidates[0]
    const patch: Partial<Trade> = {}
    for (const field of FILLABLE_FIELDS) {
      const existingValue = existing[field]
      const incomingValue = row[field]
      if (isEmpty(existingValue) && !isEmpty(incomingValue)) {
        ;(patch as Record<string, unknown>)[field] = incomingValue
      }
    }
    // notes בטרייד קיים תמיד string ('' אם ריק) - לא null/undefined, ה-isEmpty הכללי כבר מכסה '' .

    // pnl: מטופל בנפרד מ-FILLABLE_FIELDS, ולא verbatim מה-row בשום מצב (P&L immutability -
    // ראה CLAUDE.md/tests). רק כש-exitPrice **עכשיו** מתמלא לראשונה (היה ריק אצל existing,
    // ה-patch למעלה מילא אותו) מחשבים pnl מ-computePnl() - זה בדיוק תרחיש הבאג המקורי
    // (טרייד פתוח שמקבל exitPrice בייבוא/מיזוג, שאמור להיסגר). אם exitPrice כבר היה קיים
    // אצל existing (טרייד שכבר סגור), pnl נשאר לגמרי בלתי-נגוע - גם אם fee/שדות אחרים משתנים.
    if (isEmpty(existing.exitPrice) && !isEmpty(patch.exitPrice)) {
      const mergedFee = (patch.fee as number | null | undefined) ?? existing.fee
      patch.pnl = computePnl({
        direction: existing.direction,
        entryPrice: existing.entryPrice,
        exitPrice: patch.exitPrice as number,
        quantity: existing.quantity,
        fee: mergedFee,
      })
    }

    if (Object.keys(patch).length === 0) {
      unchanged += 1
      continue
    }

    const merged: Trade = { ...existing, ...patch }
    const result = await updateTrade(existing.id, merged)
    updatedTrades.push(result)
    // מחליפים רק את הרשומה הספציפית שעודכנה בתוך הדלי - לא את כל הדלי - כדי לשמר טריידים
    // אחרים שחולקים את אותו מפתח גס (לצורך שורות נוספות באותה ריצת ייבוא).
    byKey.set(key, bucket.map((candidate) => (candidate === existing ? result : candidate)))
    updated += 1
  }

  return { created, updated, unchanged, ambiguous, updatedTrades, createdTrades }
}
