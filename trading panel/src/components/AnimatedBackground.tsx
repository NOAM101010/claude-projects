import { useEffect, useRef } from 'react'

const MAX_DPR = 2
const MAX_PARTICLES = 48

interface Particle {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  amber: boolean
}

interface AnimatedBackgroundProps {
  className?: string
}

/**
 * רקע דקורטיבי ל-`AccessCodeGate`: canvas+`requestAnimationFrame`, בלי React state
 * בכל פריים (רק refs/משתנים מקומיים בתוך ה-effect) - כדי לא לגרום ל-re-render וג'אנק.
 * מכבד `prefers-reduced-motion` (מצייר פריים סטטי יחיד, בלי לולאת אנימציה בכלל).
 * לא קשור יותר ל"reveal" חד-פעמי לסשן - זה עכשיו תפקידו של `LaunchScreen` (מוצג
 * בכל טעינה, לפני השער), אז הרכיב הזה הוא רק אנימציית רקע רציפה ותמימה.
 */
export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    const particles: Particle[] = []

    const seedParticles = () => {
      particles.length = 0
      const count = Math.min(MAX_PARTICLES, Math.max(16, Math.round((width * height) / 26000)))
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.6 + Math.random() * 1.8,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          amber: Math.random() > 0.5,
        })
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedParticles()
    }
    resize()

    const renderFrame = (moveParticles: boolean) => {
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        if (moveParticles) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0) p.x = width
          else if (p.x > width) p.x = 0
          if (p.y < 0) p.y = height
          else if (p.y > height) p.y = 0
        }
        const rgb = p.amber ? '217, 154, 43' : '34, 197, 94'
        ctx.beginPath()
        ctx.fillStyle = `rgba(${rgb}, 0.32)`
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    let rafId = 0

    if (reducedMotion) {
      renderFrame(false)
    } else {
      const loop = () => {
        renderFrame(true)
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
    }

    const handleResize = () => {
      resize()
      if (reducedMotion) renderFrame(false)
    }
    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
