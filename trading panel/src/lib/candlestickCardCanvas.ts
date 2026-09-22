import { readCssVar } from './canvasExport'

export interface CandlestickCardStat {
  label: string
  value: string
}

export interface CandlestickCardData {
  /** 'trade' = Trade of the Month single-trade framing, 'summary' = monthly-recap framing. */
  variant: 'trade' | 'summary'
  eyebrowLabel: string
  /** רק ל-variant='trade'. */
  symbol?: string
  pnlLabel: string
  pnlPositive: boolean
  /** רק ל-variant='trade' - "+0.84% · SEP 2026". */
  pctLabel?: string
  /** רק ל-variant='trade' - "LONG · 3 DAYS · SIZE 92". */
  metaLabel?: string
  /** רק ל-variant='summary' - כותרת-משנה מתחת ל-P&L ("NET MONTHLY P&L"). */
  pnlSubLabel?: string
  /** רק ל-variant='summary' - עד 3 סטטיסטיקות (Win Rate/Profit Factor/Trades). */
  stats?: CandlestickCardStat[]
  disclaimer: string
}

const SIZE = 1080

/**
 * 10 נרות דקורטיביים בלבד (special-design round, כיוון 3 ב-`share-card-directions.html`) -
 * גבהי wick/body קבועים, **לא** נגזרים מדאטה אמיתית של מחירים (אותו עיקרון בדיוק כמו
 * ה-launch-screen/access-gate: מוטיב חזותי-מסחרי, לא ייצוג מחירים). יחס up/down קבוע.
 */
const CANDLES: { up: boolean; wickTop: number; body: number; wickBottom: number }[] = [
  { up: true, wickTop: 14, body: 38, wickBottom: 8 },
  { up: false, wickTop: 10, body: 52, wickBottom: 16 },
  { up: true, wickTop: 20, body: 70, wickBottom: 6 },
  { up: true, wickTop: 8, body: 96, wickBottom: 22 },
  { up: false, wickTop: 16, body: 44, wickBottom: 10 },
  { up: true, wickTop: 12, body: 120, wickBottom: 14 },
  { up: true, wickTop: 24, body: 150, wickBottom: 8 },
  { up: false, wickTop: 10, body: 60, wickBottom: 18 },
  { up: true, wickTop: 14, body: 88, wickBottom: 10 },
  { up: true, wickTop: 18, body: 130, wickBottom: 12 },
]

/**
 * מצייר כרטיס שיתוף "תבנית נרות" (theme חדש, לצד ה-theme הקיים ב-`tradeCardCanvas.ts`/
 * `monthlyCalendarCanvas.ts`) - ריבוע 1080x1080, רצועת נרות ירוק/אדום מטושטשת ברקע עם
 * vignette, אותו דפוס בדיוק כמו שאר הקנבסים (`readCssVar` לצבעים חיים, לא הארדקוד).
 * תומך בשתי המסגרות (`variant`) שסוכמו: טרייד בודד ("Trade of the Month") וסיכום חודשי.
 */
export function renderCandlestickCardCanvas(canvas: HTMLCanvasElement, data: CandlestickCardData): void {
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const textH = readCssVar('--text-h', '#f2f2f4')
  const textDim = readCssVar('--text-dim', '#74747c')
  const accent2 = readCssVar('--accent-2', '#e8b341')
  const pos = readCssVar('--pnl-pos-2', '#4ade80')
  const neg = readCssVar('--pnl-neg-2', '#f87171')
  const pnlColor = data.pnlPositive ? pos : neg

  // רקע כללי
  const bgGrad = ctx.createLinearGradient(0, 0, 0, SIZE)
  bgGrad.addColorStop(0, '#0a0c10')
  bgGrad.addColorStop(0.6, '#07080b')
  bgGrad.addColorStop(1, '#050608')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, SIZE, SIZE)

  // רצועת נרות מטושטשת - ממורכזת אופקית, יושבת על קו הבסיס
  ctx.save()
  ctx.filter = 'blur(2px)'
  ctx.globalAlpha = 0.5
  const candleW = 38
  const gap = 26
  const totalW = CANDLES.length * candleW + (CANDLES.length - 1) * gap
  let x = (SIZE - totalW) / 2
  const baseline = SIZE - 60
  const scale = 2.4
  for (const c of CANDLES) {
    ctx.strokeStyle = c.up ? pos : neg
    ctx.fillStyle = c.up ? pos : neg
    ctx.lineWidth = 4
    const bodyH = c.body * scale
    const wickTopH = c.wickTop * scale
    const wickBottomH = c.wickBottom * scale
    const bodyTop = baseline - wickBottomH - bodyH
    const cx = x + candleW / 2
    ctx.beginPath()
    ctx.moveTo(cx, bodyTop - wickTopH)
    ctx.lineTo(cx, baseline)
    ctx.stroke()
    roundRect(ctx, x, bodyTop, candleW, bodyH, 5)
    ctx.fill()
    x += candleW + gap
  }
  ctx.restore()

  // Vignette - שכבה כהה מעל הנרות, כדי שהטקסט יישאר קריא לגמרי
  const vignette = ctx.createRadialGradient(SIZE / 2, SIZE * 0.42, SIZE * 0.1, SIZE / 2, SIZE * 0.42, SIZE * 0.62)
  vignette.addColorStop(0, 'rgba(7,8,11,0.2)')
  vignette.addColorStop(0.78, 'rgba(7,8,11,0.93)')
  vignette.addColorStop(1, '#07080b')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, SIZE, SIZE)

  const cx = SIZE / 2
  ctx.textAlign = 'center'

  // מיקרו-מותג - פינה עליונה
  ctx.fillStyle = accent2
  ctx.font = '700 20px "JetBrains Mono", monospace'
  ctx.letterSpacing = '3px'
  ctx.fillText('TRADEPANEL', cx, 60)
  ctx.letterSpacing = '0px'

  let y = SIZE / 2 - (data.variant === 'trade' ? 90 : 70)

  // eyebrow
  ctx.fillStyle = accent2
  ctx.font = '700 24px "JetBrains Mono", monospace'
  ctx.letterSpacing = '4px'
  ctx.fillText(data.eyebrowLabel.toUpperCase(), cx, y)
  ctx.letterSpacing = '0px'
  y += 56

  if (data.variant === 'trade') {
    ctx.fillStyle = textH
    ctx.font = '900 84px "Frank Ruhl Libre", Georgia, serif'
    ctx.fillText(data.symbol ?? '', cx, y)
    y += 96

    ctx.fillStyle = pnlColor
    ctx.font = '800 78px "JetBrains Mono", monospace'
    ctx.fillText(data.pnlLabel, cx, y)
    y += 50

    if (data.pctLabel) {
      ctx.fillStyle = pnlColor
      ctx.font = '700 24px "JetBrains Mono", monospace'
      ctx.fillText(data.pctLabel, cx, y)
      y += 50
    }

    if (data.metaLabel) {
      ctx.fillStyle = textDim
      ctx.font = '600 20px "JetBrains Mono", monospace'
      ctx.letterSpacing = '1.5px'
      ctx.fillText(data.metaLabel.toUpperCase(), cx, y)
      ctx.letterSpacing = '0px'
    }
  } else {
    ctx.fillStyle = pnlColor
    ctx.font = '800 66px "JetBrains Mono", monospace'
    ctx.fillText(data.pnlLabel, cx, y)
    y += 42

    if (data.pnlSubLabel) {
      ctx.fillStyle = textDim
      ctx.font = '600 22px "JetBrains Mono", monospace'
      ctx.fillText(data.pnlSubLabel.toUpperCase(), cx, y)
      y += 60
    }

    if (data.stats && data.stats.length > 0) {
      const colW = 220
      const startX = cx - (colW * (data.stats.length - 1)) / 2
      data.stats.forEach((s, i) => {
        const sx = startX + colW * i
        ctx.fillStyle = textDim
        ctx.font = '700 15px "JetBrains Mono", monospace'
        ctx.letterSpacing = '1.5px'
        ctx.fillText(s.label.toUpperCase(), sx, y)
        ctx.letterSpacing = '0px'
        ctx.fillStyle = textH
        ctx.font = '800 30px "JetBrains Mono", monospace'
        ctx.fillText(s.value, sx, y + 36)
      })
    }
  }

  // דיסקליימר
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.font = '500 15px "Heebo", sans-serif'
  wrapText(ctx, data.disclaimer, cx, SIZE - 26, SIZE - 140, 20)
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
