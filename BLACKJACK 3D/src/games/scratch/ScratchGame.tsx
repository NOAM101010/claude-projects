import { useEffect, useRef, useState } from 'react'
import { useScratch, TICKETS } from './useScratch'
import { PRIZES } from './engine'
import { t } from '../../i18n/he'

/** Luxury tiers — the higher the price, the bigger the payout (prize = price × mult). */
const TIERS: Record<number, { name: string; color: string; glow: string }> = {
  100: { name: 'ברונזה', color: '#c98a4b', glow: 'rgba(201,138,75,0.45)' },
  500: { name: 'כסף', color: '#c4ccd6', glow: 'rgba(196,204,214,0.45)' },
  2500: { name: 'זהב', color: '#e8c94a', glow: 'rgba(232,201,74,0.55)' },
  10000: { name: 'יהלום', color: '#8ac6ff', glow: 'rgba(138,198,255,0.6)' },
}
const TOP_MULT = Math.max(...PRIZES.map(p => p.mult))

function Paytable() {
  const winning = PRIZES.filter(p => p.mult > 0)
  return (
    <div className="lux-glass rounded-2xl p-3">
      <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-gold/70">3 זהים = פרס</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {winning.map(p => (
          <div key={p.glyph} className="flex items-center justify-between">
            <span className="text-lg">{p.glyph}</span>
            <span className="font-bold text-gold tabular-nums">×{p.mult}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The scratchable card: a 3×3 prize grid behind a foil canvas you rub off with
 *  a coin. Revealing enough (~55%) auto-completes; the coin follows the pointer. */
function ScratchCard() {
  const card = useScratch(s => s.card)
  const phase = useScratch(s => s.phase)
  const winningCells = useScratch(s => s.winningCells)
  const revealAll = useScratch(s => s.revealAll)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const moves = useRef(0)
  const [coin, setCoin] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false })

  const SIZE = 300

  // (Re)paint the foil whenever a fresh card enters the revealing phase.
  useEffect(() => {
    if (phase !== 'revealing') return
    const c = canvasRef.current
    if (!c) return
    const g = c.getContext('2d')!
    g.globalCompositeOperation = 'source-over'
    const grad = g.createLinearGradient(0, 0, SIZE, SIZE)
    grad.addColorStop(0, '#b9902f')
    grad.addColorStop(0.5, '#8a6d1f')
    grad.addColorStop(1, '#c8a84a')
    g.fillStyle = grad
    g.fillRect(0, 0, SIZE, SIZE)
    // subtle sheen lines
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 2
    for (let i = -SIZE; i < SIZE * 2; i += 22) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + SIZE, SIZE); g.stroke()
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.font = 'bold 22px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('גרד עם המטבע 🪙', SIZE / 2, SIZE / 2)
    moves.current = 0
  }, [phase, card])

  const erasedFraction = () => {
    const c = canvasRef.current
    if (!c) return 0
    const g = c.getContext('2d')!
    const { data } = g.getImageData(0, 0, SIZE, SIZE)
    let clear = 0, total = 0
    for (let i = 3; i < data.length; i += 40 * 4) { // sample every 40th pixel's alpha
      total++
      if (data[i] === 0) clear++
    }
    return total ? clear / total : 0
  }

  const scratchAt = (clientX: number, clientY: number) => {
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * SIZE
    const y = ((clientY - rect.top) / rect.height) * SIZE
    setCoin({ x: clientX - rect.left, y: clientY - rect.top, show: true })
    const g = c.getContext('2d')!
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.arc(x, y, 26, 0, Math.PI * 2)
    g.fill()
    if (++moves.current % 6 === 0 && erasedFraction() > 0.55) revealAll()
  }

  const onDown = (e: React.PointerEvent) => { drawing.current = true; scratchAt(e.clientX, e.clientY) }
  const onMove = (e: React.PointerEvent) => { if (drawing.current) scratchAt(e.clientX, e.clientY) }
  const onUp = () => { drawing.current = false; setCoin(c => ({ ...c, show: false })) }

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* Prize grid (behind the foil) */}
      <div className="absolute inset-0 grid grid-cols-3 gap-2 rounded-2xl bg-[#0e0a08] p-2">
        {Array.from({ length: 9 }, (_, i) => {
          const win = phase === 'result' && winningCells.includes(i)
          return (
            <div
              key={i}
              className={`grid place-items-center rounded-xl text-4xl ${win ? 'bg-gold/30 ring-2 ring-gold' : 'bg-white/5'}`}
            >
              {card?.cells[i]?.glyph ?? '✦'}
            </div>
          )
        })}
      </div>

      {/* Foil canvas (only while revealing) */}
      {phase === 'revealing' && (
        <>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="absolute inset-0 cursor-none rounded-2xl touch-none"
            style={{ width: SIZE, height: SIZE }}
          />
          {coin.show && (
            <div
              className="pointer-events-none absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-lg font-bold text-[#5a4410] shadow-lg"
              style={{ left: coin.x, top: coin.y, background: 'radial-gradient(circle at 35% 30%, #ffe9a8, #d4af37 60%, #a9862c)' }}
            >
              ₿
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ScratchGame() {
  const ticket = useScratch(s => s.ticket)
  const phase = useScratch(s => s.phase)
  const message = useScratch(s => s.message)
  const setTicket = useScratch(s => s.setTicket)
  const buy = useScratch(s => s.buy)
  const revealAll = useScratch(s => s.revealAll)

  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0a0608]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 35%, rgba(212,175,55,0.1), transparent 60%)' }}
      />

      <div className="relative flex flex-col items-center gap-5 p-6 pt-24">
        {phase === 'idle' ? (
          /* ── Luxury card picker ── */
          <div className="lux-glass w-full max-w-lg rounded-3xl p-6">
            <div className="mb-4 text-center font-display text-2xl font-bold text-gold">🎫 בחר כרטיס גירוד</div>
            <div className="grid grid-cols-2 gap-3">
              {TICKETS.map(v => {
                const tier = TIERS[v]
                const active = ticket === v
                return (
                  <button
                    key={v}
                    onClick={() => setTicket(v)}
                    className={`rounded-2xl border-2 p-4 text-right transition ${active ? 'border-gold' : 'border-white/10 hover:border-white/30'}`}
                    style={{ background: `linear-gradient(150deg, ${tier.color}22, #0d0a08)`, boxShadow: active ? `0 0 18px ${tier.glow}` : 'none' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-lg font-bold" style={{ color: tier.color }}>{tier.name}</span>
                      <span className="text-2xl">🎫</span>
                    </div>
                    <div className="mt-1 text-sm font-bold text-white">{v.toLocaleString('he-IL')} 🪙</div>
                    <div className="text-[11px] text-white/50">עד {(v * TOP_MULT).toLocaleString('he-IL')} 🪙</div>
                  </button>
                )
              })}
            </div>
            <button onClick={buy} className="lux-gold mt-4 w-full rounded-2xl py-3.5 font-display text-lg font-bold">
              {t('buyTicket')} · {ticket.toLocaleString('he-IL')} 🪙
            </button>
          </div>
        ) : (
          /* ── Card + scratch ── */
          <div className="flex items-start gap-6">
            <div className="lux-glass rounded-3xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-lg font-bold" style={{ color: TIERS[ticket]?.color ?? '#d4af37' }}>
                  {TIERS[ticket]?.name} · {ticket.toLocaleString('he-IL')} 🪙
                </span>
              </div>
              <ScratchCard />
              {phase === 'revealing' && (
                <button onClick={revealAll} className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20">
                  ⚡ {t('autoScratch')}
                </button>
              )}
            </div>
            <Paytable />
          </div>
        )}

        {message && (
          <div className="lux-glass rounded-2xl px-7 py-2 font-display text-2xl font-bold text-gold" style={{ animation: 'floatUp .3s ease-out' }}>
            {message}
          </div>
        )}
        {phase === 'result' && (
          <div className="px-8 py-1 text-base font-bold text-white/60">כרטיס חדש בעוד רגע…</div>
        )}
      </div>
    </div>
  )
}
