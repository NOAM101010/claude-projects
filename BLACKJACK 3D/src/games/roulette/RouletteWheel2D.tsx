import { useEffect, useRef } from 'react'
import { WHEEL_ORDER, colorOf } from './engine'
import { useRoulette } from './useRoulette'

const N = WHEEL_ORDER.length
const SEG = 360 / N
const CX = 200
const CY = 200
const R_OUT = 178
const R_IN = 116
const R_NUM = (R_OUT + R_IN) / 2 + 4
const R_BALL = R_OUT - 15
const SPIN_TURNS = 6
const BALL_TURNS = 12
const FILL: Record<string, string> = { red: '#c8102e', black: '#1a1a1a', green: '#0f8a42' }

/** Point on a circle, angle measured clockwise from the top (12 o'clock). */
function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)]
}

/** Annular-sector path for one pocket, spanning [a0, a1] degrees. */
function sector(a0: number, a1: number): string {
  const [x1, y1] = polar(R_OUT, a0)
  const [x2, y2] = polar(R_OUT, a1)
  const [x3, y3] = polar(R_IN, a1)
  const [x4, y4] = polar(R_IN, a0)
  return `M${x1} ${y1} A${R_OUT} ${R_OUT} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${R_IN} ${R_IN} 0 0 0 ${x4} ${y4} Z`
}

const POCKETS = WHEEL_ORDER.map((n, i) => {
  const center = i * SEG
  return { n, color: FILL[colorOf(n)], center, path: sector(center - SEG / 2, center + SEG / 2) }
})
const FRETS = WHEEL_ORDER.map((_, i) => (i - 0.5) * SEG)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Top-down 2D roulette rendered in SVG. Rotation uses the `rotate(deg CX CY)`
 * ATTRIBUTE (not a CSS transform), so the pivot is always the true centre — the
 * old CSS-transition version re-anchored the transform-origin and threw the
 * wheel off-centre.
 *
 * The REST/landing position is declarative React (`transform={...}` in JSX) so
 * it's always correct even when rAF is paused (e.g. a background tab): the wheel
 * lands with the winning pocket under the top pointer and the ball rests there
 * too, so the ball is always on the number the engine rolled. rAF only adds the
 * smooth spin on top (it starts from exactly the declarative value → no jump).
 */
export default function RouletteWheel2D() {
  const phase = useRoulette(s => s.phase)
  const targetIndex = useRoulette(s => s.targetIndex)
  const spinDuration = useRoulette(s => s.spinDuration)
  const wheelRef = useRef<SVGGElement>(null)
  const ballRef = useRef<SVGGElement>(null)

  const wheelFinal = -targetIndex * SEG // winning pocket → top (0°)
  const spinning = phase === 'spinning'
  // While spinning the declarative angle is the spun-up start, which is a whole
  // number of extra turns → the SAME screen position as the final landing.
  const wheelRest = spinning ? wheelFinal + 360 * SPIN_TURNS : wheelFinal
  const ballRest = spinning ? -360 * BALL_TURNS : 0

  useEffect(() => {
    if (!spinning) return
    let raf = 0
    const anim = () => {
      const s = useRoulette.getState()
      const t = Math.min(Math.max((performance.now() - s.spinStart) / s.spinDuration, 0), 1)
      const e = easeOutCubic(t)
      wheelRef.current?.setAttribute('transform', `rotate(${wheelFinal + (1 - e) * 360 * SPIN_TURNS} ${CX} ${CY})`)
      ballRef.current?.setAttribute('transform', `rotate(${(1 - e) * -360 * BALL_TURNS} ${CX} ${CY})`)
      if (t < 1) raf = requestAnimationFrame(anim)
    }
    raf = requestAnimationFrame(anim)
    return () => cancelAnimationFrame(raf)
  }, [spinning, spinDuration, wheelFinal])

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 400 400" className="h-[min(76vw,72vh)] w-[min(76vw,72vh)] max-h-[540px] max-w-[540px]">
        <defs>
          <radialGradient id="rw-bowl" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#5a3418" />
            <stop offset="72%" stopColor="#331808" />
            <stop offset="100%" stopColor="#150a04" />
          </radialGradient>
          <radialGradient id="rw-hub" cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#8a5626" />
            <stop offset="60%" stopColor="#4a2c12" />
            <stop offset="100%" stopColor="#241206" />
          </radialGradient>
          <linearGradient id="rw-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9e6a0" />
            <stop offset="48%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#7d5f18" />
          </linearGradient>
        </defs>

        {/* Fixed bowl + gold rims (concentric with the wheel) */}
        <circle cx={CX} cy={CY} r={196} fill="url(#rw-bowl)" />
        <circle cx={CX} cy={CY} r={193} fill="none" stroke="url(#rw-gold)" strokeWidth={8} />
        <circle cx={CX} cy={CY} r={R_OUT + 5} fill="none" stroke="url(#rw-gold)" strokeWidth={3.5} />

        {/* Rotating wheel */}
        <g ref={wheelRef} transform={`rotate(${wheelRest} ${CX} ${CY})`}>
          {POCKETS.map((p, i) => (
            <path key={i} d={p.path} fill={p.color} />
          ))}
          {FRETS.map((a, i) => {
            const [x1, y1] = polar(R_IN, a)
            const [x2, y2] = polar(R_OUT, a)
            return <line key={`f${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#caa63a" strokeWidth={0.8} opacity={0.75} />
          })}
          {POCKETS.map((p, i) => {
            const [x, y] = polar(R_NUM, p.center)
            return (
              <text
                key={`t${i}`}
                x={x}
                y={y}
                fill="#fdf6e3"
                fontSize={12.5}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${p.center} ${x} ${y})`}
                style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2 }}
              >
                {p.n}
              </text>
            )
          })}
          <circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke="url(#rw-gold)" strokeWidth={2} />
          <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="url(#rw-gold)" strokeWidth={3} />
        </g>

        {/* Ball — own rotating layer, rests at the top */}
        <g ref={ballRef} transform={`rotate(${ballRest} ${CX} ${CY})`}>
          <circle cx={CX} cy={CY - R_BALL} r={6.5} fill="#fdfdf5" stroke="#a8a898" strokeWidth={1} />
          <circle cx={CX - 2} cy={CY - R_BALL - 2} r={2.2} fill="#ffffff" />
        </g>

        {/* Centre hub + spinner cross (static) */}
        <circle cx={CX} cy={CY} r={R_IN - 3} fill="url(#rw-hub)" />
        <circle cx={CX} cy={CY} r={R_IN - 3} fill="none" stroke="url(#rw-gold)" strokeWidth={2} />
        <g stroke="url(#rw-gold)" strokeWidth={5} strokeLinecap="round">
          <line x1={CX} y1={CY - (R_IN - 26)} x2={CX} y2={CY + (R_IN - 26)} />
          <line x1={CX - (R_IN - 26)} y1={CY} x2={CX + (R_IN - 26)} y2={CY} />
        </g>
        <circle cx={CX} cy={CY} r={13} fill="url(#rw-gold)" stroke="#5a4410" strokeWidth={1} />
        <circle cx={CX - 3} cy={CY - 3} r={4} fill="#fff3c8" opacity={0.7} />

        {/* Fixed pointer at the top */}
        <path d={`M${CX - 10} 8 L${CX + 10} 8 L${CX} 28 Z`} fill="url(#rw-gold)" stroke="#5a4410" strokeWidth={1} />
      </svg>
    </div>
  )
}
