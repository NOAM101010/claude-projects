import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseTradesExcel } from './importExcel'

/** בונה ArrayBuffer של קובץ .xlsx מגיליון aoa (array-of-arrays) - שורה ראשונה כותרות. */
function buildXlsxBuffer(aoa: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return out as ArrayBuffer
}

describe('parseTradesExcel', () => {
  it('מפענח שורה תקינה עם כותרות אנגליות מלאות', () => {
    const buffer = buildXlsxBuffer([
      ['Symbol', 'Direction', 'Entry Date', 'Entry Price', 'Quantity', 'Exit Price', 'Fee', 'Notes'],
      ['AAPL', 'Buy', '2026-01-05', 150, 10, 160, 1, 'good trade'],
    ])
    const { rows, errors } = parseTradesExcel(buffer)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].symbol).toBe('AAPL')
    expect(rows[0].direction).toBe('long')
    expect(rows[0].entryPrice).toBe(150)
    expect(rows[0].quantity).toBe(10)
    expect(rows[0].exitPrice).toBe(160)
    expect(rows[0].fee).toBe(1)
    expect(rows[0].notes).toBe('good trade')
    expect(rows[0].entryAt).toMatch(/^2026-01-05/)
  })

  it('מפענח כותרות עבריות ומזהה כיוון בעברית', () => {
    const buffer = buildXlsxBuffer([
      ['סימבול', 'כיוון', 'תאריך כניסה', 'מחיר כניסה', 'כמות'],
      ['TEVA', 'שורט', '2026-02-01', 20, 100],
    ])
    const { rows, errors } = parseTradesExcel(buffer)
    expect(errors).toHaveLength(0)
    expect(rows[0].symbol).toBe('TEVA')
    expect(rows[0].direction).toBe('short')
  })

  it('כותרות case-insensitive עם רווחים מיותרים', () => {
    const buffer = buildXlsxBuffer([
      [' SYMBOL ', ' side ', 'date', 'entry', 'qty'],
      ['MSFT', 'long', '2026-03-01', 300, 5],
    ])
    const { rows, errors } = parseTradesExcel(buffer)
    expect(errors).toHaveLength(0)
    expect(rows[0].symbol).toBe('MSFT')
  })

  it('דוחה שורה חסרת שדה חובה ומדווחת ב-errors, וממשיכה לשורה הבאה', () => {
    const buffer = buildXlsxBuffer([
      ['Symbol', 'Direction', 'Entry Date', 'Entry Price', 'Quantity'],
      ['AAPL', '', '2026-01-05', 150, 10], // חסר direction
      ['MSFT', 'long', '2026-01-06', 300, 5], // תקין
    ])
    const { rows, errors } = parseTradesExcel(buffer)
    expect(rows).toHaveLength(1)
    expect(rows[0].symbol).toBe('MSFT')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2/)
    expect(errors[0]).toMatch(/direction/)
  })

  it('שורה עם שדות אופציונליים חסרים בלבד ממשיכה להיכלל (undefined/null)', () => {
    const buffer = buildXlsxBuffer([
      ['Symbol', 'Direction', 'Entry Date', 'Entry Price', 'Quantity'],
      ['AAPL', 'long', '2026-01-05', 150, 10],
    ])
    const { rows, errors } = parseTradesExcel(buffer)
    expect(errors).toHaveLength(0)
    expect(rows[0].exitPrice).toBeNull()
    expect(rows[0].pnl).toBeNull()
    expect(rows[0].notes).toBeUndefined()
    expect(rows[0].setup).toBeUndefined()
  })

  it('מדלג על שורות ריקות לגמרי בלי לדווח שגיאה', () => {
    const buffer = buildXlsxBuffer([
      ['Symbol', 'Direction', 'Entry Date', 'Entry Price', 'Quantity'],
      [null, null, null, null, null],
      ['AAPL', 'long', '2026-01-05', 150, 10],
    ])
    const { rows, errors } = parseTradesExcel(buffer)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('מחזירה את כותרות העמודות הגולמיות שזוהו בשורה הראשונה', () => {
    const buffer = buildXlsxBuffer([
      ['Symbol', 'Direction', 'Entry Date', 'Entry Price', 'Quantity'],
      ['AAPL', 'long', '2026-01-05', 150, 10],
    ])
    const { detectedHeaders } = parseTradesExcel(buffer)
    expect(detectedHeaders).toEqual(['Symbol', 'Direction', 'Entry Date', 'Entry Price', 'Quantity'])
  })

  it('כשאף כותרת לא מזוהה, כל השורות נדחות אך הכותרות הגולמיות עדיין מוחזרות', () => {
    const buffer = buildXlsxBuffer([
      ['Column A', 'Column B', 'Column C'],
      ['AAPL', 'long', 150],
    ])
    const { rows, detectedHeaders } = parseTradesExcel(buffer)
    expect(rows).toHaveLength(0)
    expect(detectedHeaders).toEqual(['Column A', 'Column B', 'Column C'])
  })

  it('מפענח פורמט "בלוק קניה/מכירה" עם כותרות פרושות על 3 שורות (יומן המסחר האמיתי של המשתמש)', () => {
    // חיקוי מדויק של המבנה האמיתי: שורה 0 = כותרת קבוצה בלבד, שורה 1+2 = תת-כותרות
    // (חלקן חוזרות/דומות בכוונה, למשל "שער" פעמיים ו"תאריך" פעמיים), שורות 3-4 ריקות (מפריד),
    // דאטה מתחילה בשורה 5. עמודות תואמות לתיעוד: 0=מספר,2=טיקר,3=כמות,5=שער-כניסה,6=סכום,
    // 7=תאריך-כניסה,9=שער-יציאה,10=סכום,11=תאריך-יציאה,13=רווח והפסד,14=%,15=ברוטו,16=רווח
    // (MAX(pnl,0) - עמודת מס, לא לשימוש!),17=עמלה,18=נטו רווח (אחרי מס - עמודת מס, לא לשימוש!).
    const header0: unknown[] = new Array(19).fill(null)
    header0[1] = 'קניה'
    header0[8] = 'מכירה'

    const header1: unknown[] = new Array(19).fill(null)
    header1[0] = 'מספר'
    header1[2] = 'טיקר'
    header1[3] = 'כמות'
    header1[5] = 'שער'
    header1[6] = 'סכום'
    header1[7] = 'תאריך'
    header1[9] = 'שער'
    header1[10] = 'סכום'
    header1[11] = 'תאריך'
    header1[13] = 'סה"כ'
    header1[14] = '%'
    header1[16] = 'סה"כ'

    const header2: unknown[] = new Array(19).fill(null)
    header2[0] = 'סידורי'
    header2[2] = 'מניה'
    header2[3] = 'מניות'
    header2[5] = 'מניה'
    header2[6] = 'קניה'
    header2[7] = 'קניה'
    header2[9] = 'מניה'
    header2[10] = 'מכירה'
    header2[11] = 'מכירה'
    header2[13] = 'רווח והפסד'
    header2[14] = 'רווח / הפסד'
    header2[15] = 'ברוטו'
    header2[16] = 'רווח'
    header2[17] = 'עמלה'
    header2[18] = 'נטו רווח'

    const blank = new Array(19).fill(null)

    // שורה עם רווח: כניסה 12.41 x 26.2499 = 325.63, יציאה 11.01 x 26.2499 = 289.14,
    // רווח והפסד גולמי (col13) = -36.49 (הפסד בפועל, כדי לוודא שלא לוקחים MAX(x,0) בטעות).
    const lossRow: unknown[] = [1, null, 'ONDS', 26.2499, null, 12.41, 325.63, 46050, null, 11.01, 289.14, 46052, null, -36.49, -0.112, 289.14, 0, 3.1, 0]
    // שורה עם רווח אמיתי: col13 = 50 (רווח), col16 (עמודת מס "רווח" = MAX(50,0) = 50 - במקרה זהה,
    // אבל col18 "נטו רווח" (אחרי מס 25%) = 37.5 - שונה מ-col13, מוודא שלא בטעות לוקחים אותו).
    const profitRow: unknown[] = [2, null, 'SATL ', 10, null, 100, 1000, 46060, null, 105, 1050, 46062, null, 50, 0.05, 1050, 50, 2, 37.5]

    const buffer = buildXlsxBuffer([header0, header1, header2, blank, blank, lossRow, profitRow])
    const { rows, errors } = parseTradesExcel(buffer)

    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(2)

    const [loss, profit] = rows
    expect(loss.symbol).toBe('ONDS')
    expect(loss.direction).toBe('long')
    expect(loss.quantity).toBe(26.2499)
    expect(loss.entryPrice).toBe(12.41)
    expect(loss.exitPrice).toBe(11.01)
    expect(loss.fee).toBe(3.1)
    expect(loss.pnl).toBe(-36.49) // col13 הגולמי, לא col16/col18 (עמודות מס)

    expect(profit.symbol).toBe('SATL') // trim
    expect(profit.direction).toBe('long')
    expect(profit.fee).toBe(2)
    expect(profit.pnl).toBe(50) // col13, לא col18=37.5 (אחרי ניכוי מס 25%)
  })
})
