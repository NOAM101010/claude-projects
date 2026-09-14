import type { Trade } from '../types/trade'

const CSV_COLUMNS: Array<keyof Trade> = [
  'id',
  'symbol',
  'direction',
  'entryAt',
  'entryPrice',
  'quantity',
  'stopLoss',
  'takeProfit',
  'exitAt',
  'exitPrice',
  'pnl',
  'currency',
  'fee',
  'setup',
  'notes',
  'chartImageUrl',
]

/** מבריח ערך יחיד ל-CSV: עוטף במרכאות אם יש פסיק/מרכאות/ירידת שורה, ומכפיל מרכאות פנימיות. */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

/** בונה טקסט CSV (עם שורת כותרות) מרשימת טריידים. פונקציה טהורה, לא תלויה בדפדפן - נבדקת ישירות. */
export function buildTradesCsv(trades: Trade[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows = trades.map((t) => CSV_COLUMNS.map((col) => escapeCsvValue(t[col])).join(','))
  return [header, ...rows].join('\n')
}

/** בונה JSON מסודר (2-space indent) מרשימת טריידים. פונקציה טהורה - נבדקת ישירות. */
export function buildTradesJson(trades: Trade[]): string {
  return JSON.stringify(trades, null, 2)
}

/** מפעיל הורדת קובץ בדפדפן (Blob + `<a download>` פרוגרמטי) - פעולת דפדפן רגילה על דאטה של המשתמש עצמו. */
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function exportAsJson(trades: Trade[], filename = 'tradepanel-export.json'): void {
  downloadBlob(buildTradesJson(trades), filename, 'application/json')
}

export function exportAsCsv(trades: Trade[], filename = 'tradepanel-export.csv'): void {
  downloadBlob(buildTradesCsv(trades), filename, 'text/csv')
}
