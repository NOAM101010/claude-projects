import { readCssVar } from './canvasExport'
import { formatCurrency } from './format'
import type { CurrencyCode } from '../types/trade'

export interface CalendarCanvasDay {
  date: number
  inMonth: boolean
  pnl: number | null
  trades: number
}

export interface MonthlyCalendarCanvasData {
  monthLabel: string
  monthPnl: number
  winRatePct: number
  tradingDays: number
  bestDayPnl: number | null
  baseCurrency: CurrencyCode
  locale: string
  dow: string[]
  weeks: CalendarCanvasDay[][]
  maxAbs: number
  disclaimer: string
}

const WIDTH = 1200
const HEIGHT = 1500

function backgroundFor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0 || pnl === 0) return 'rgba(255, 255, 255, 0.04)'
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
  const alpha = 0.12 + intensity * 0.55
  return pnl > 0 ? `rgba(34, 197, 94, ${alpha})` : `rgba(239, 68, 68, ${alpha})`
}

/**
 * מצייר את "Calendar" ל-canvas לשיתוף: כותרת חודש + שורת סיכום (Month P&L / Win Rate /
 * Trading Days / Best Day - כל הנתונים מגיעים כבר מחושבים מ-`MonthlyCalendar.tsx` דרך
 * `stats.ts`, לא לוגיקה כפולה כאן) + רשת הימים, בלי badge/מדליה על היום הכי טוב - רק
 * ההדגשה הצבעונית. הדיסקליימר מתווסף רק כאן, בתחתית ה-PNG המיוצא.
 */
export function renderMonthlyCalendarToCanvas(canvas: HTMLCanvasElement, data: MonthlyCalendarCanvasData): void {
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bg = readCssVar('--bg', '#07080b')
  const metal1 = readCssVar('--metal-1', '#0c0e11')
  const metal2 = readCssVar('--metal-2', '#15181d')
  const textH = readCssVar('--text-h', '#f2f2f4')
  const textDim = readCssVar('--text-dim', '#74747c')
  const accent2 = readCssVar('--accent-2', '#e8b341')
  const pos = readCssVar('--pnl-pos-2', '#4ade80')
  const neg = readCssVar('--pnl-neg-2', '#f87171')
  const border = readCssVar('--border', 'rgba(255,255,255,0.09)')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const pad = 44
  const panelX = pad
  const panelY = pad
  const panelW = WIDTH - pad * 2
  const panelH = HEIGHT - pad * 2
  const grad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH)
  grad.addColorStop(0, metal2)
  grad.addColorStop(0.55, '#101317')
  grad.addColorStop(1, metal1)
  ctx.fillStyle = grad
  roundRect(ctx, panelX, panelY, panelW, panelH, 28)
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 2
  roundRect(ctx, panelX, panelY, panelW, panelH, 28)
  ctx.stroke()

  let y = panelY + 76
  const cx = WIDTH / 2

  ctx.textAlign = 'center'
  ctx.fillStyle = accent2
  ctx.font = '700 24px "JetBrains Mono", monospace'
  ctx.fillText('TRADEPANEL · CALENDAR', cx, y)
  y += 60

  ctx.fillStyle = textH
  ctx.font = '900 64px "Frank Ruhl Libre", Georgia, serif'
  ctx.fillText(data.monthLabel, cx, y)
  y += 60

  // שורת סיכום
  const summary = [
    { label: 'MONTH P&L', value: formatCurrency(data.monthPnl, data.baseCurrency, data.locale), color: data.monthPnl >= 0 ? pos : neg },
    { label: 'WIN RATE', value: `${data.winRatePct.toFixed(1)}%`, color: textH },
    { label: 'TRADING DAYS', value: String(data.tradingDays), color: textH },
    {
      label: 'BEST DAY',
      value: data.bestDayPnl !== null ? formatCurrency(data.bestDayPnl, data.baseCurrency, data.locale) : '—',
      color: pos,
    },
  ]
  const colW = panelW / summary.length
  summary.forEach((item, i) => {
    const x = panelX + colW * i + colW / 2
    ctx.fillStyle = textDim
    ctx.font = '700 18px "JetBrains Mono", monospace'
    ctx.fillText(item.label, x, y)
    ctx.fillStyle = item.color
    ctx.font = '800 32px "JetBrains Mono", monospace'
    ctx.fillText(item.value, x, y + 40)
  })
  y += 90

  ctx.strokeStyle = border
  ctx.beginPath()
  ctx.moveTo(panelX + 60, y)
  ctx.lineTo(panelX + panelW - 60, y)
  ctx.stroke()
  y += 30

  // רשת ימים
  const gridTop = y
  const gridLeft = panelX + 30
  const gridWidth = panelW - 60
  const dowH = 40
  const rows = data.weeks.length
  const gridBottom = panelH + panelY - 70
  const cellsAreaH = gridBottom - gridTop - dowH
  const cellH = cellsAreaH / rows
  const cellW = gridWidth / 7

  ctx.font = '700 18px "JetBrains Mono", monospace'
  ctx.fillStyle = textDim
  data.dow.forEach((d, i) => {
    ctx.fillText(d, gridLeft + cellW * i + cellW / 2, gridTop + 26)
  })

  data.weeks.forEach((week, wi) => {
    week.forEach((day, di) => {
      const x = gridLeft + cellW * di
      const cy = gridTop + dowH + cellH * wi
      const w = cellW - 6
      const h = cellH - 6
      ctx.fillStyle = day.inMonth && day.pnl !== null ? backgroundFor(day.pnl, data.maxAbs) : 'rgba(255,255,255,0.03)'
      roundRect(ctx, x + 3, cy + 3, w, h, 8)
      ctx.fill()

      ctx.textAlign = 'left'
      ctx.fillStyle = day.inMonth ? textDim : 'rgba(255,255,255,0.2)'
      ctx.font = '700 16px "JetBrains Mono", monospace'
      ctx.fillText(String(day.date), x + 12, cy + 24)

      if (day.inMonth && day.pnl !== null) {
        ctx.fillStyle = day.pnl >= 0 ? pos : neg
        ctx.font = '800 18px "JetBrains Mono", monospace'
        ctx.fillText(formatCurrency(day.pnl, data.baseCurrency, data.locale), x + 12, cy + h - 14)
      }
      ctx.textAlign = 'center'
    })
  })

  // דיסקליימר - רק בייצוא, לא בתצוגה הרגילה באפליקציה
  ctx.fillStyle = textDim
  ctx.font = '500 16px "Heebo", sans-serif'
  ctx.textAlign = 'center'
  wrapText(ctx, data.disclaimer, cx, panelY + panelH - 24, panelW - 120, 20)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, bottomY: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  const startY = bottomY - (lines.length - 1) * lineHeight
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
