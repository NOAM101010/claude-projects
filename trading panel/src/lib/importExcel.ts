import type * as XLSXTypes from 'xlsx'
import type { Direction, Trade } from '../types/trade'

/** xlsx (SheetJS) הוא תלות כבדה שלא צריכה להיטען עד שמשתמש בפועל מפעיל ייבוא Excel - נטענת
 * דינמית ב-import ראשון ומוזרמת (cache) לקריאות חוזרות, כדי לא לשלש הורדה/פענוח באותו session. */
let xlsxPromise: Promise<typeof XLSXTypes> | null = null
function loadXlsx(): Promise<typeof XLSXTypes> {
  if (!xlsxPromise) xlsxPromise = import('xlsx')
  return xlsxPromise
}

/**
 * שורה מפוענחת מקובץ Excel חיצוני. השדות ה"חובה" המינימליים מובטחים (symbol/direction/
 * entryAt/entryPrice/quantity) - בלעדיהם השורה נדחית ומדווחת ב-errors, לא נכנסת למערך.
 * שאר השדות אופציונליים כי ליומן חיצוני אין בהכרח את כל מה שהאפליקציה שלנו שומרת.
 */
export type ParsedExcelRow = Pick<Trade, 'symbol' | 'direction' | 'entryAt' | 'entryPrice' | 'quantity'> &
  Partial<Pick<Trade, 'stopLoss' | 'takeProfit' | 'exitAt' | 'exitPrice' | 'pnl' | 'fee' | 'notes' | 'setup'>>

export interface ParseExcelResult {
  rows: ParsedExcelRow[]
  errors: string[]
  /** הכותרות הגולמיות שנקראו משורה 1 של הגיליון, לפני מיפוי - לצורך הצגה למשתמש כשאף כותרת לא זוהתה. */
  detectedHeaders: string[]
}

/** מילון כותרות רב-לשוני (עברית+אנגלית) -> שדה Trade. הכותרות מנורמלות ל-lowercase+trim לפני חיפוש. */
const HEADER_ALIASES: Record<string, keyof ParsedExcelRow> = {
  symbol: 'symbol',
  ticker: 'symbol',
  'סימבול': 'symbol',
  'מניה': 'symbol',

  direction: 'direction',
  side: 'direction',
  'כיוון': 'direction',

  'entry date': 'entryAt',
  date: 'entryAt',
  'תאריך כניסה': 'entryAt',
  'תאריך': 'entryAt',

  'entry price': 'entryPrice',
  entry: 'entryPrice',
  price: 'entryPrice',
  'מחיר כניסה': 'entryPrice',
  'מחיר': 'entryPrice',

  quantity: 'quantity',
  qty: 'quantity',
  size: 'quantity',
  shares: 'quantity',
  units: 'quantity',
  'כמות': 'quantity',

  'stop loss': 'stopLoss',
  sl: 'stopLoss',
  'סטופ': 'stopLoss',

  'take profit': 'takeProfit',
  tp: 'takeProfit',
  'יעד': 'takeProfit',

  'exit date': 'exitAt',
  'תאריך יציאה': 'exitAt',

  'exit price': 'exitPrice',
  exit: 'exitPrice',
  'מחיר יציאה': 'exitPrice',

  pnl: 'pnl',
  profit: 'pnl',
  'p&l': 'pnl',
  'p/l': 'pnl',
  net: 'pnl',
  result: 'pnl',
  'רווח': 'pnl',

  fee: 'fee',
  commission: 'fee',
  'עמלה': 'fee',

  notes: 'notes',
  comment: 'notes',
  'הערות': 'notes',

  setup: 'setup',
  strategy: 'setup',
  'סטאפ': 'setup',
}

const DIRECTION_ALIASES: Record<string, Direction> = {
  buy: 'long',
  long: 'long',
  'קניה': 'long',
  'קנייה': 'long',
  'לונג': 'long',
  sell: 'short',
  short: 'short',
  'מכירה': 'short',
  'שורט': 'short',
}

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

function parseDirection(raw: unknown): Direction | null {
  const key = normalizeHeader(raw)
  return DIRECTION_ALIASES[key] ?? null
}

/** ממיר תא תאריך של xlsx (Date object, serial number, או string) ל-ISO string. null אם לא ניתן לפרסר. */
function parseDateCell(raw: unknown, XLSX: typeof XLSXTypes): string | null {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return raw.toISOString()
  }
  if (typeof raw === 'number') {
    // Excel serial date (epoch 1899-12-30, כולל "באג" יום מעבר 1900 שנשמר בכוונה לתאימות).
    const parsed = XLSX.SSF.parse_date_code(raw)
    if (!parsed) return null
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.round(parsed.S)))
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const d = new Date(trimmed)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString()
  }
  return null
}

function parseNumberCell(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim().replace(/,/g, '')
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function parseStringCell(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  return s || null
}

/** מיקומי העמודות (0-based) שזוהו עבור פורמט "בלוק קניה/מכירה" (כותרות פרושות על כמה שורות). */
interface BuySellBlockColumns {
  symbolCol: number
  quantityCol: number
  entryPriceCol: number
  exitPriceCol: number
  entryAtCol: number
  exitAtCol: number
  feeCol: number
  pnlCol: number
  /** השורה הראשונה שאחרי כל שורות הכותרות שזוהו - משם מתחילים לחפש דאטה (כולל דילוג על שורות ריקות שבינתיים). */
  dataStartRow: number
}

/** לאחר trim - השוואת שוויון מדויקת, לא substring, כדי להבדיל בין "רווח והפסד" (ה-P&L האמיתי)
 * לבין "רווח / הפסד" (עמודות אחוז/המרת מטבע) ו"רווח"/"נטו רווח" (עמודות מס רווח הון) שדומות מאוד. */
function cellEquals(raw: unknown, expected: string): boolean {
  return String(raw ?? '').trim() === expected
}

/**
 * מזהה פורמט "בלוק קניה/מכירה" - כותרות פרושות על כמה שורות (קבוצת "קניה"/"מכירה" למעלה, שתי
 * שורות תת-כותרות מתחתיה) כמו יומן המסחר האמיתי של המשתמש. לא מניחה מספרי עמודות/שורות קבועים -
 * מגלה אותם דינמית מתוך תוכן שורות הכותרות, כדי לשרוד שינויים קלים במבנה הקובץ בעתיד.
 * מחזירה null אם לא זוהה מבנה כזה (למשל קובץ עם שורת כותרות בודדת רגילה).
 */
export function detectBuySellBlockFormat(rawRows: unknown[][]): BuySellBlockColumns | null {
  const scanLimit = Math.min(6, rawRows.length)
  let lastMatchedRow = -1

  let symbolCol = -1
  let quantityCol = -1
  const priceCols: number[] = []
  const dateCols: number[] = []
  let feeCol = -1
  let pnlCol = -1
  let symbolFallbackCol = -1
  let quantityFallbackCol = -1

  for (let r = 0; r < scanLimit; r++) {
    const row = rawRows[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (cellEquals(cell, 'טיקר')) {
        symbolCol = c
        lastMatchedRow = Math.max(lastMatchedRow, r)
      } else if (cellEquals(cell, 'כמות')) {
        quantityCol = c
        lastMatchedRow = Math.max(lastMatchedRow, r)
      } else if (cellEquals(cell, 'שער')) {
        priceCols.push(c)
        lastMatchedRow = Math.max(lastMatchedRow, r)
      } else if (cellEquals(cell, 'תאריך')) {
        dateCols.push(c)
        lastMatchedRow = Math.max(lastMatchedRow, r)
      } else if (cellEquals(cell, 'עמלה')) {
        feeCol = c
        lastMatchedRow = Math.max(lastMatchedRow, r)
      } else if (cellEquals(cell, 'רווח והפסד')) {
        pnlCol = c
        lastMatchedRow = Math.max(lastMatchedRow, r)
      } else if (cellEquals(cell, 'מניה') && symbolFallbackCol === -1) {
        symbolFallbackCol = c
      } else if (cellEquals(cell, 'מניות') && quantityFallbackCol === -1) {
        quantityFallbackCol = c
      }
    }
  }

  // "מניה"/"מניות" גם מופיעים בעמודות מחיר (ר' תיעוד המבנה) - נופלים חזרה אליהם רק אם
  // "טיקר"/"כמות" הייחודיים לא נמצאו, ורק אם הם לא חופפים עמודת מחיר שכבר זוהתה.
  if (symbolCol === -1 && symbolFallbackCol !== -1 && !priceCols.includes(symbolFallbackCol)) {
    symbolCol = symbolFallbackCol
  }
  if (quantityCol === -1 && quantityFallbackCol !== -1 && !priceCols.includes(quantityFallbackCol)) {
    quantityCol = quantityFallbackCol
  }

  if (
    symbolCol === -1 ||
    quantityCol === -1 ||
    priceCols.length < 2 ||
    dateCols.length < 2 ||
    feeCol === -1 ||
    pnlCol === -1
  ) {
    return null
  }

  const [entryPriceCol, exitPriceCol] = priceCols
  const [entryAtCol, exitAtCol] = dateCols

  return {
    symbolCol,
    quantityCol,
    entryPriceCol,
    exitPriceCol,
    entryAtCol,
    exitAtCol,
    feeCol,
    pnlCol,
    dataStartRow: lastMatchedRow + 1,
  }
}

/** מפענח שורות דאטה לפי עמודות "בלוק קניה/מכירה" שזוהו - יומן Long-only, אין עמודת כיוון בקובץ. */
function parseBuySellBlockRows(
  rawRows: unknown[][],
  columns: BuySellBlockColumns,
  XLSX: typeof XLSXTypes,
): ParseExcelResult {
  const errors: string[] = []
  const rows: ParsedExcelRow[] = []

  for (let r = columns.dataStartRow; r < rawRows.length; r++) {
    const dataRow = rawRows[r]
    if (!dataRow || dataRow.every((cell) => cell === null || cell === undefined || cell === '')) continue

    const lineNumber = r + 1
    const symbol = parseStringCell(dataRow[columns.symbolCol])
    const quantity = parseNumberCell(dataRow[columns.quantityCol])
    const entryPrice = parseNumberCell(dataRow[columns.entryPriceCol])
    const entryAt = parseDateCell(dataRow[columns.entryAtCol], XLSX)

    const missing: string[] = []
    if (!symbol) missing.push('symbol')
    if (quantity === null) missing.push('quantity')
    if (entryPrice === null) missing.push('entry price')
    if (!entryAt) missing.push('entry date')

    if (missing.length > 0) {
      errors.push(`Row ${lineNumber}: missing/invalid required field(s): ${missing.join(', ')}`)
      continue
    }

    rows.push({
      symbol: symbol as string,
      direction: 'long',
      entryAt: entryAt as string,
      entryPrice: entryPrice as number,
      quantity: quantity as number,
      stopLoss: null,
      takeProfit: null,
      exitAt: parseDateCell(dataRow[columns.exitAtCol], XLSX),
      exitPrice: parseNumberCell(dataRow[columns.exitPriceCol]),
      pnl: parseNumberCell(dataRow[columns.pnlCol]),
      fee: parseNumberCell(dataRow[columns.feeCol]),
    })
  }

  return { rows, errors, detectedHeaders: ['קניה/מכירה (בלוק רב-שורות)'] }
}

/**
 * מפענח את הגיליון הראשון של קובץ .xlsx לשורות טריידים. שורה בודדת פגומה (חסר אחד
 * מהשדות המחייבים: symbol/direction/entryAt/entryPrice/quantity) לא זורקת - נכנסת
 * ל-errors עם מספר שורה (1-based, כולל שורת הכותרות) וסיבה, וממשיכים לשורה הבאה.
 * async: טוענת את xlsx דינמית (ר' loadXlsx) - התלות הכבדה הזו לא נטענת עד שמשתמש בפועל מפעיל ייבוא.
 */
export async function parseTradesExcel(buffer: ArrayBuffer): Promise<ParseExcelResult> {
  const XLSX = await loadXlsx()
  // cellDates:false (the default) is intentional, not an oversight: SheetJS's own cellDates:true
  // conversion pre-converts numeric date cells into JS Date objects using the Excel epoch (Dec 30
  // 1899) anchored through the *local* Date constructor - and in timezones whose historical Local
  // Mean Time offset isn't a round number (e.g. Asia/Jerusalem was UTC+2:00:40 before standard time),
  // that anchor bakes in the old LMT offset for every date computed from it, not the modern +2/+3
  // offset. Confirmed on this machine: serial 46050 (a clean "2026-01-28 00:00") came back as
  // "2026-01-27T21:59:20.000Z" - consistently off by exactly that historical Jerusalem LMT delta.
  // Leaving cellDates off means numeric date cells stay raw numbers, which parseDateCell() below
  // converts itself via XLSX.SSF.parse_date_code() + Date.UTC() - verified clean, no LMT artifact.
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const errors: string[] = []
  if (!sheetName) {
    return { rows: [], errors: ['The workbook has no sheets'], detectedHeaders: [] }
  }
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })
  if (rawRows.length === 0) {
    return { rows: [], errors: ['The sheet is empty'], detectedHeaders: [] }
  }

  const headerRow = rawRows[0]
  const detectedHeaders = headerRow
    .map((cell) => String(cell ?? '').trim())
    .filter((h) => h.length > 0)
  const columnMap = new Map<number, keyof ParsedExcelRow>()
  headerRow.forEach((cell, colIndex) => {
    const normalized = normalizeHeader(cell)
    const field = HEADER_ALIASES[normalized]
    if (field) columnMap.set(colIndex, field)
  })

  const rows: ParsedExcelRow[] = []
  for (let r = 1; r < rawRows.length; r++) {
    const dataRow = rawRows[r]
    if (!dataRow || dataRow.every((cell) => cell === null || cell === undefined || cell === '')) continue

    const lineNumber = r + 1 // 1-based, כולל שורת הכותרות - תואם למה שהמשתמש רואה באקסל
    const cells: Partial<Record<keyof ParsedExcelRow, unknown>> = {}
    columnMap.forEach((field, colIndex) => {
      cells[field] = dataRow[colIndex]
    })

    const symbol = parseStringCell(cells.symbol)
    const direction = parseDirection(cells.direction)
    const entryAt = parseDateCell(cells.entryAt, XLSX)
    const entryPrice = parseNumberCell(cells.entryPrice)
    const quantity = parseNumberCell(cells.quantity)

    const missing: string[] = []
    if (!symbol) missing.push('symbol')
    if (!direction) missing.push('direction')
    if (!entryAt) missing.push('entry date')
    if (entryPrice === null) missing.push('entry price')
    if (quantity === null) missing.push('quantity')

    if (missing.length > 0) {
      errors.push(`Row ${lineNumber}: missing/invalid required field(s): ${missing.join(', ')}`)
      continue
    }

    rows.push({
      symbol: symbol as string,
      direction: direction as Direction,
      entryAt: entryAt as string,
      entryPrice: entryPrice as number,
      quantity: quantity as number,
      stopLoss: parseNumberCell(cells.stopLoss),
      takeProfit: parseNumberCell(cells.takeProfit),
      exitAt: parseDateCell(cells.exitAt, XLSX),
      exitPrice: parseNumberCell(cells.exitPrice),
      pnl: parseNumberCell(cells.pnl),
      fee: parseNumberCell(cells.fee),
      notes: parseStringCell(cells.notes) ?? undefined,
      setup: parseStringCell(cells.setup) ?? undefined,
    })
  }

  if (rows.length === 0) {
    // הזיהוי הרגיל (שורת כותרות בודדת) לא הניב אף שורה תקינה - יתכן שזה פורמט "בלוק קניה/מכירה"
    // (כותרות פרושות על כמה שורות, כמו יומן המסחר החיצוני של המשתמש). ננסה לזהות אותו לפני ויתור.
    const blockColumns = detectBuySellBlockFormat(rawRows)
    if (blockColumns) {
      const blockResult = parseBuySellBlockRows(rawRows, blockColumns, XLSX)
      return { ...blockResult, detectedHeaders }
    }
  }

  return { rows, errors, detectedHeaders }
}
