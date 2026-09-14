import { useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/LanguageContext'
import styles from './LaunchScreen.module.css'

const MAX_DPR = 2
const MAX_CANDLES = 26
const CANDLE_MS = 340
const UP_RGB = '34, 197, 94'
const DOWN_RGB = '239, 68, 68'
const AMBER_RGB = '217, 154, 43'

interface Candle {
  open: number
  close: number
  high: number
  low: number
}

/**
 * מסך פתיחה מלא-מסך: מוצג בתחילת **כל** טעינה של האפליקציה (ראה `App.tsx`,
 * `SHOW_INTRO_SPLASH` ב-`config/locks.ts`) - בניגוד ל-reveal החד-פעמי-לסשן
 * שהיה קודם בתוך `AccessCodeGate`/`AnimatedBackground` (הוסר, ראה שם).
 * נסגר בלחיצה/הקשה יחידה בכל מקום על המסך - לא טיימר. הרקע הוא canvas ייעודי
 * (לא `AnimatedBackground` - מוטיב שונה לגמרי: נרות יפניים "בונים" שרשרת עולה
 * ולא אבק צף) עם אותה משמעת ביצועים: rAF יחיד, בלי React state בכל פריים,
 * DPR מוגבל, מכבד `prefers-reduced-motion` (פריים סטטי אחד, בלי לולאה).
 */
export function LaunchScreen({ onDismiss }: { onDismiss: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const t = useTranslation()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startTime = performance.now()

    let width = 0
    let height = 0
    const candles: Candle[] = []
    let lastClose = 0.5

    const nextCandle = (): Candle => {
      // דריפט חיובי קל (הרוב עולה, לפעמים יורד) - "עקומת הון" שמטפסת לאט,
      // לא קו ישר משעמם ולא רעש אקראי חסר כיוון.
      const open = lastClose
      const bias = Math.random() < 0.66 ? 1 : -1
      const move = bias * (0.02 + Math.random() * 0.05)
      const close = Math.min(0.96, Math.max(0.04, open + move))
      const wick = 0.015 + Math.random() * 0.03
      const high = Math.max(open, close) + wick
      const low = Math.min(open, close) - wick
      lastClose = close
      return { open, close, high, low }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    if (candles.length === 0) {
      for (let i = 0; i < MAX_CANDLES; i++) candles.push(nextCandle())
    }

    const yOf = (v: number) => height * 0.82 - v * height * 0.5
    const step = () => width / (MAX_CANDLES - 1)

    const renderFrame = (revealCount: number) => {
      ctx.clearRect(0, 0, width, height)
      const s = step()
      const body = Math.max(3, Math.min(14, s * 0.5))

      // עקומת EMA ענבר עדינה מעל הנרות - "שורה תחתונה" עולה
      ctx.beginPath()
      for (let i = 0; i < revealCount; i++) {
        const x = i * s
        const y = yOf((candles[i].open + candles[i].close) / 2)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(${AMBER_RGB}, 0.35)`
      ctx.lineWidth = 1.5
      ctx.stroke()

      for (let i = 0; i < revealCount; i++) {
        const c = candles[i]
        const up = c.close >= c.open
        const rgb = up ? UP_RGB : DOWN_RGB
        const x = i * s
        const fresh = revealCount - i
        const a = fresh <= 6 ? 0.25 + (1 - fresh / 6) * 0.55 : 0.55

        ctx.strokeStyle = `rgba(${rgb}, ${a * 0.8})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(Math.round(x) + 0.5, yOf(c.high))
        ctx.lineTo(Math.round(x) + 0.5, yOf(c.low))
        ctx.stroke()

        const yO = yOf(c.open)
        const yC = yOf(c.close)
        const top = Math.min(yO, yC)
        const h = Math.max(1.5, Math.abs(yC - yO))
        ctx.fillStyle = `rgba(${rgb}, ${a})`
        ctx.fillRect(x - body / 2, top, body, h)
      }
    }

    let rafId = 0
    // מצב הקצב חי מחוץ ל-loop (לא נגזר מ-elapsed מוחלט - ראה הערה למטה) כדי ש-handleResize
    // יוכל לצייר מחדש עם אותו revealCount הנוכחי בלי לקפוץ.
    let revealCount = 1
    let lastStepTime = startTime
    let holdStart: number | null = null

    if (reducedMotion) {
      revealCount = MAX_CANDLES
      renderFrame(MAX_CANDLES)
    } else {
      const loop = (now: number) => {
        if (revealCount < MAX_CANDLES) {
          if (now - lastStepTime >= CANDLE_MS) {
            revealCount = Math.min(MAX_CANDLES, revealCount + 1)
            lastStepTime = now
          }
        } else {
          // כשהשרשרת מסתיימת, מתחילים שרשרת חדשה כל 900ms (לא בכל elapsed>900 - אחרת
          // אחרי הרגע הראשון שהתנאי היה true הוא היה נשאר true לנצח, כי elapsed רק גדל
          // מ-startTime הקבוע. holdStart מתאפס בכל "צעד" כדי לשמור על קצב אמיתי).
          if (holdStart === null) holdStart = now
          if (now - holdStart > 900) {
            candles.shift()
            candles.push(nextCandle())
            holdStart = now
          }
        }
        renderFrame(revealCount)
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
    }

    const handleResize = () => {
      resize()
      renderFrame(revealCount)
    }
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const dismiss = () => onDismiss()
    window.addEventListener('click', dismiss, { once: true })
    window.addEventListener('keydown', dismiss, { once: true })
    window.addEventListener('touchstart', dismiss, { once: true, passive: true })
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('touchstart', dismiss)
    }
  }, [onDismiss])

  return (
    <div
      className={styles.wrapper}
      role="button"
      tabIndex={0}
      aria-label={`TradePanel — ${t('launch.hint')}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onDismiss()
      }}
    >
      <canvas ref={canvasRef} className={styles.background} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={`${styles.content} count-in`}>
        <span className={`eyebrow ${styles.eyebrow}`}>{t('launch.eyebrow')}</span>
        <h1 className={`hero-title ${styles.title}`}>TradePanel</h1>
        <p className={styles.tagline}>{t('launch.tagline')}</p>
        <p className={styles.hint}>{t('launch.hint')}</p>
      </div>
    </div>
  )
}
