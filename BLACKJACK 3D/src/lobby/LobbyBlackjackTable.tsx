import { useMemo } from 'react'
import * as THREE from 'three'
import { useCosmetics } from '../state/useCosmetics'

/** Curved "BLACKJACK PAYS 3 TO 2" style arc drawn to a canvas texture. */
function feltTexture(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#0e5a2b'
  g.fillRect(0, 0, S, S)
  // subtle radial shading
  const rad = g.createRadialGradient(S / 2, S * 0.62, 40, S / 2, S * 0.62, S * 0.7)
  rad.addColorStop(0, 'rgba(255,255,255,0.06)')
  rad.addColorStop(1, 'rgba(0,0,0,0.25)')
  g.fillStyle = rad
  g.fillRect(0, 0, S, S)

  // Gold betting arcs
  g.strokeStyle = 'rgba(212,175,55,0.85)'
  g.lineWidth = 5
  g.beginPath()
  g.arc(S / 2, S * 0.15, S * 0.42, 0.2 * Math.PI, 0.8 * Math.PI)
  g.stroke()
  g.lineWidth = 2.5
  g.beginPath()
  g.arc(S / 2, S * 0.15, S * 0.5, 0.18 * Math.PI, 0.82 * Math.PI)
  g.stroke()

  // Text
  g.fillStyle = 'rgba(255,240,200,0.9)'
  g.font = `bold ${S * 0.062}px Georgia, serif`
  g.textAlign = 'center'
  g.fillText("BLACKJACK PAYS 3 TO 2", S / 2, S * 0.44)
  g.font = `${S * 0.04}px Georgia, serif`
  g.fillStyle = 'rgba(255,240,200,0.6)'
  g.fillText("DEALER MUST STAND ON 17", S / 2, S * 0.52)

  // Three betting circles
  g.strokeStyle = 'rgba(212,175,55,0.7)'
  g.lineWidth = 3
  for (const x of [0.3, 0.5, 0.7]) {
    g.beginPath()
    g.arc(S * x, S * 0.72, S * 0.06, 0, Math.PI * 2)
    g.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * A half-round blackjack table built from primitives — cheap, and it actually
 * reads as a blackjack table (unlike the hat-shaped poker GLB it replaces).
 */
export default function LobbyBlackjackTable() {
  const feltTex = useMemo(feltTexture, [])
  const feltColor = useCosmetics(s => s.currentFelt().felt)
  const H = 0.78

  return (
    <group>
      {/* Half-round felt top */}
      <mesh position={[0, H, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.15, 1.15, 0.07, 48, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={feltColor} roughness={0.92} />
      </mesh>
      {/* Felt print on top face */}
      <mesh position={[0, H + 0.036, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.12, 48, 0, Math.PI]} />
        <meshStandardMaterial map={feltTex} roughness={0.95} />
      </mesh>
      {/* Padded leather rail */}
      <mesh position={[0, H + 0.02, 0]}>
        <torusGeometry args={[1.15, 0.055, 12, 48, Math.PI]} />
        <meshStandardMaterial color="#5a1a22" roughness={0.6} />
      </mesh>
      {/* Straight edge rail (dealer side) */}
      <mesh position={[0, H + 0.02, 0]}>
        <boxGeometry args={[2.34, 0.09, 0.09]} />
        <meshStandardMaterial color="#5a1a22" roughness={0.6} />
      </mesh>
      {/* Dealer chip tray */}
      <mesh position={[0, H + 0.05, -0.35]}>
        <boxGeometry args={[0.6, 0.05, 0.14]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Pedestal */}
      <mesh position={[0, H / 2, -0.1]} castShadow>
        <cylinderGeometry args={[0.26, 0.42, H, 20]} />
        <meshStandardMaterial color="#2a1608" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.03, -0.1]}>
        <cylinderGeometry args={[0.6, 0.6, 0.06, 24]} />
        <meshStandardMaterial color="#1a0e06" roughness={0.7} />
      </mesh>
    </group>
  )
}
