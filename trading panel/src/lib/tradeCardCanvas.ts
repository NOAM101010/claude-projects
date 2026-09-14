import { readCssVar } from './canvasExport'

export interface TradeCardCanvasData {
  symbol: string
  pnlLabel: string
  pnlPositive: boolean
  pctLabel: string
  monthLabel: string
  bestOfLabel: string
  sideLabel: string
  metaLabel: string
  /** רק שתי נקודות אמיתיות - מחיר כניסה ומחיר יציאה - לקו הרקע. */
  entryPrice: number
  exitPrice: number
}

const WIDTH = 1080
const HEIGHT = 1920

/**
 * מצייר את כרטיס "Trade of the Month" ישירות ל-canvas (בלי html2canvas) ביחס 9:16,
 * בהתאמה חזותית לתצוגה המקדימה שב-`TradeOfTheMonthCard.tsx` - אותה שכבת דאטה,
 * אותם צבעי עיצוב (נקראים מה-CSS custom properties החיות כדי לא לשכפל את הפלטה).
 */
export function renderTradeCardToCanvas(canvas: HTMLCanvasElement, data: TradeCardCanvasData): void {
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
  const pnlColor = data.pnlPositive ? pos : neg

  // רקע כללי
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // פאנל מתכתי מרכזי
  const pad = 56
  const panelX = pad
  const panelY = pad
  const panelW = WIDTH - pad * 2
  const panelH = HEIGHT - pad * 2
  const grad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH)
  grad.addColorStop(0, metal2)
  grad.addColorStop(0.55, '#101317')
  grad.addColorStop(1, metal1)
  ctx.fillStyle = grad
  roundRect(ctx, panelX, panelY, panelW, panelH, 32)
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 2
  roundRect(ctx, panelX, panelY, panelW, panelH, 32)
  ctx.stroke()

  const cx = WIDTH / 2
  let y = panelY + 130

  // eyebrow
  ctx.fillStyle = accent2
  ctx.font = '700 26px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '4px'
  ctx.fillText('TRADE OF THE MONTH', cx, y)
  ctx.letterSpacing = '0px'
  y += 50

  ctx.fillStyle = textDim
  ctx.font = '600 26px "JetBrains Mono", monospace'
  ctx.fillText(data.monthLabel, cx, y)
  y += 130

  // מיני-גרף רקע: קו בין נקודת כניסה ליציאה בלבד
  const chartTop = y - 90
  const chartBottom = y + 30
  const chartLeft = panelX + 100
  const chartRight = panelX + panelW - 100
  const values = [data.entryPrice, data.exitPrice]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const yFor = (v: number) => chartBottom - ((v - min) / range) * (chartBottom - chartTop)
  ctx.beginPath()
  ctx.moveTo(chartLeft, yFor(data.entryPrice))
  ctx.lineTo(chartRight, yFor(data.exitPrice))
  ctx.strokeStyle = pnlColor
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = pnlColor
  ;[
    [chartLeft, yFor(data.entryPrice)],
    [chartRight, yFor(data.exitPrice)],
  ].forEach(([px, py]) => {
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fill()
  })

  y += 90

  // סימבול
  ctx.fillStyle = textH
  ctx.font = '900 108px "Frank Ruhl Libre", Georgia, serif'
  ctx.fillText(data.symbol, cx, y)
  y += 130

  // P&L
  ctx.fillStyle = pnlColor
  ctx.font = '800 96px "JetBrains Mono", monospace'
  ctx.fillText(data.pnlLabel, cx, y)
  y += 60

  // אחוז שינוי
  ctx.fillStyle = pnlColor
  ctx.font = '700 34px "JetBrains Mono", monospace'
  ctx.fillText(data.pctLabel, cx, y)
  y += 70

  // Best of N
  ctx.fillStyle = textDim
  ctx.font = '500 26px "Heebo", sans-serif'
  ctx.fillText(data.bestOfLabel, cx, y)
  y += 90

  // קו מפריד
  ctx.strokeStyle = border
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(panelX + 90, y)
  ctx.lineTo(panelX + panelW - 90, y)
  ctx.stroke()
  y += 60

  // מטא: side / החזקה / גודל
  ctx.fillStyle = textDim
  ctx.font = '600 26px "JetBrains Mono", monospace'
  ctx.fillText(`${data.sideLabel} · ${data.metaLabel}`, cx, y)

  ctx.textAlign = 'left'
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
