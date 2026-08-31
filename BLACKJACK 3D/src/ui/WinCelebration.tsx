import { useEffect, useMemo, useState } from 'react'
import { useCelebration } from '../state/useCelebration'

interface Coin {
  left: number
  delay: number
  duration: number
  size: number
  glyph: string
}

/**
 * Coin shower + banner for big wins. Pure DOM (no 3D dependency) so it works over
 * any screen. Driven by the celebration store; auto-clears after the animation.
 */
export default function WinCelebration() {
  const active = useCelebration(s => s.active)
  const clear = useCelebration(s => s.clear)
  const [shown, setShown] = useState<typeof active>(null)

  // Latch the active celebration and auto-clear it.
  useEffect(() => {
    if (!active) return
    setShown(active)
    clear()
  }, [active, clear])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 2800)
    return () => clearTimeout(t)
  }, [shown])

  const coins = useMemo<Coin[]>(() => {
    if (!shown) return []
    const n = shown.kind === 'jackpot' ? 60 : 34
    return Array.from({ length: n }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.7,
      duration: 1.6 + Math.random() * 1.4,
      size: 18 + Math.random() * 22,
      glyph: Math.random() < 0.15 ? '💎' : '🪙',
    }))
  }, [shown])

  if (!shown) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      {coins.map((c, i) => (
        <span
          key={i}
          className="absolute -top-10"
          style={{
            left: `${c.left}%`,
            fontSize: `${c.size}px`,
            animation: `coinFall ${c.duration}s linear ${c.delay}s forwards`,
          }}
        >
          {c.glyph}
        </span>
      ))}

      <div className="absolute inset-x-0 top-1/3 flex justify-center">
        <div
          className={`rounded-3xl border px-10 py-5 text-center shadow-2xl ${
            shown.kind === 'jackpot' ? 'border-gold bg-gradient-to-b from-[#3a2c06] to-black' : 'border-gold/60 bg-black/80'
          }`}
          style={{ animation: 'floatUp .4s ease-out' }}
        >
          <div className="lux-shimmer font-display text-2xl font-bold">
            {shown.kind === 'jackpot' ? "🎉 ג'קפוט!" : 'זכייה גדולה!'}
          </div>
          <div className="mt-1 font-display text-4xl font-bold text-gold tabular-nums">
            +{Math.round(shown.amount).toLocaleString('he-IL')}
          </div>
        </div>
      </div>
    </div>
  )
}
