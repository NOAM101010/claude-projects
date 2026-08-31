import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SYMBOLS, Symbol } from './engine'
import { useSlots } from './useSlots'

/** Canvas texture of one symbol glyph, cached per symbol. */
const glyphCache = new Map<Symbol, THREE.CanvasTexture>()

function glyphTexture(sym: Symbol): THREE.CanvasTexture {
  const hit = glyphCache.get(sym)
  if (hit) return hit
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#0b0b10'
  g.fillRect(0, 0, S, S)
  g.font = `${Math.round(S * 0.62)}px system-ui, "Segoe UI Emoji", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(SYMBOLS.find(s => s.id === sym)!.glyph, S / 2, S / 2 + S * 0.03)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  glyphCache.set(sym, tex)
  return tex
}

const ALL: Symbol[] = SYMBOLS.map(s => s.id)

/**
 * A single digital reel. While spinning it cycles symbols fast; it locks to the
 * engine's result symbol at its scheduled stop time. Because it always lands on
 * the stored result, the shown symbol can never disagree with the payout.
 */
function Reel({ index, x }: { index: number; x: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const cycle = useRef(0)
  const stopped = useRef(true)
  const lastPhase = useRef<string>('idle')

  useFrame(() => {
    const s = useSlots.getState()
    const m = mat.current
    if (!m) return

    if (s.phase === 'spinning') {
      if (lastPhase.current !== 'spinning') stopped.current = false
      lastPhase.current = 'spinning'

      const elapsed = performance.now() - s.spinStart
      const stopAt = s.reelStops[index]

      if (elapsed < stopAt) {
        // Blur through random symbols; speed eases down near the stop.
        const speed = elapsed > stopAt - 300 ? 3 : 1.4
        cycle.current += speed
        const sym = ALL[Math.floor(cycle.current) % ALL.length]
        m.map = glyphTexture(sym)
        m.emissiveIntensity = 0.15
        if (mesh.current) mesh.current.position.y = Math.sin(cycle.current) * 0.01
      } else if (!stopped.current) {
        // Lock to the authoritative result. Resolution/payout is handled by the
        // store's own timer, not here — the view only shows the landing.
        const target = s.result?.symbols[index]
        if (target) {
          m.map = glyphTexture(target)
          m.emissiveIntensity = 0.35
        }
        if (mesh.current) mesh.current.position.y = 0
        stopped.current = true
      }
      m.needsUpdate = true
    } else {
      lastPhase.current = s.phase
      const target = s.result?.symbols[index] ?? ALL[0]
      const desired = glyphTexture(target)
      if (m.map !== desired) {
        m.map = desired
        m.needsUpdate = true
      }
      // Glow the winning line briefly.
      m.emissiveIntensity = s.phase === 'result' && s.lastWin > 0 ? 0.7 : 0.28
    }
  })

  return (
    <group position={[x, 0, 0]}>
      {/* Reel window frame */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[0.42, 0.5, 0.05]} />
        <meshStandardMaterial color="#1a1206" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh ref={mesh}>
        <planeGeometry args={[0.38, 0.44]} />
        <meshStandardMaterial
          ref={mat}
          map={glyphTexture(ALL[0])}
          emissive="#ffd964"
          emissiveIntensity={0.28}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** The three-reel window, centred on the origin. */
export default function SlotReels() {
  const xs = useMemo(() => [-0.46, 0, 0.46], [])
  return (
    <group>
      {xs.map((x, i) => (
        <Reel key={i} index={i} x={x} />
      ))}
      {/* Payline */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.5, 0.012]} />
        <meshBasicMaterial color="#ffd964" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}
