import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * A private VIP salon: panelled walls with gold reveals, a patterned carpet, a
 * coffered ceiling and a chandelier over the table.
 *
 * Deliberately built from a handful of primitives. The table model alone is
 * 500k triangles, so the room around it has to stay in the low hundreds.
 */

const ROOM = { w: 9, d: 9, h: 3.4 }

/** Each wall's centre, facing rotation, and the span it covers. */
const WALLS = [
  { x: 0, z: -ROOM.d / 2, ry: 0, span: ROOM.w },
  { x: 0, z: ROOM.d / 2, ry: Math.PI, span: ROOM.w },
  { x: -ROOM.w / 2, z: 0, ry: Math.PI / 2, span: ROOM.d },
  { x: ROOM.w / 2, z: 0, ry: -Math.PI / 2, span: ROOM.d },
] as const

function carpetTexture(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!

  g.fillStyle = '#3d1020'
  g.fillRect(0, 0, S, S)

  // Damask-ish lattice
  g.strokeStyle = 'rgba(212,175,55,0.16)'
  g.lineWidth = 2
  const step = S / 8
  for (let i = -8; i < 16; i++) {
    g.beginPath()
    g.moveTo(i * step, 0)
    g.lineTo(i * step + S, S)
    g.stroke()
    g.beginPath()
    g.moveTo(i * step, S)
    g.lineTo(i * step + S, 0)
    g.stroke()
  }
  g.fillStyle = 'rgba(212,175,55,0.12)'
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      g.beginPath()
      g.arc(x * step + step / 2, y * step + step / 2, step * 0.13, 0, Math.PI * 2)
      g.fill()
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 5)
  tex.anisotropy = 4
  return tex
}

function wallTexture(): THREE.CanvasTexture {
  const W = 256
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#241019')
  grad.addColorStop(0.55, '#3a1a26')
  grad.addColorStop(1, '#160a10')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)

  // Raised panel with a gold reveal
  g.strokeStyle = 'rgba(212,175,55,0.34)'
  g.lineWidth = 3
  g.strokeRect(W * 0.16, H * 0.2, W * 0.68, H * 0.62)
  g.strokeStyle = 'rgba(212,175,55,0.14)'
  g.lineWidth = 1.5
  g.strokeRect(W * 0.21, H * 0.245, W * 0.58, H * 0.53)

  g.fillStyle = 'rgba(255,255,255,0.03)'
  g.fillRect(W * 0.16, H * 0.2, W * 0.68, H * 0.62)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(6, 1)
  tex.anisotropy = 4
  return tex
}

function Chandelier({ y }: { y: number }) {
  const arms = 12
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#8a6d1f" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <torusGeometry args={[0.42, 0.022, 6, 28]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.52, 0]}>
        <torusGeometry args={[0.27, 0.018, 6, 24]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.28} />
      </mesh>
      {Array.from({ length: arms }, (_, i) => {
        const a = (i / arms) * Math.PI * 2
        const r = 0.42
        return (
          <mesh key={i} position={[Math.cos(a) * r, -0.3, Math.sin(a) * r]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial
              color="#fff3d0"
              emissive="#ffd98a"
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
        )
      })}
      <mesh position={[0, -0.42, 0]}>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshStandardMaterial color="#fff6de" emissive="#ffcf7a" emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Framed art / mirror panels to break up the wall line. */
function WallArt({ z, rotationY }: { z: number; rotationY: number }) {
  return (
    <group position={[0, 1.55, z]} rotation={[0, rotationY, 0]}>
      <mesh>
        <planeGeometry args={[1.15, 0.8]} />
        <meshStandardMaterial color="#0d0710" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.24, 0.89]} />
        <meshStandardMaterial color="#a9862c" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  )
}

export default function Room() {
  const carpet = useMemo(carpetTexture, [])
  const wall = useMemo(wallTexture, [])

  const half = { w: ROOM.w / 2, d: ROOM.d / 2 }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={carpet} roughness={0.98} />
      </mesh>

      {/* Walls, and the gold rail + skirting that run along each of them */}
      {WALLS.map((w, i) => (
        <group key={i} position={[w.x, 0, w.z]} rotation={[0, w.ry, 0]}>
          <mesh position={[0, ROOM.h / 2, 0]}>
            <planeGeometry args={[w.span, ROOM.h]} />
            <meshStandardMaterial map={wall} roughness={0.85} />
          </mesh>
          {/* Chair rail and skirting, as strips against the wall face. */}
          {[
            { y: 0.92, h: 0.022 },
            { y: 0.05, h: 0.09 },
          ].map((strip, s) => (
            <mesh key={s} position={[0, strip.y, 0.012]}>
              <boxGeometry args={[w.span, strip.h, 0.022]} />
              <meshStandardMaterial color="#a9862c" metalness={0.85} roughness={0.35} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Coffered ceiling */}
      <mesh position={[0, ROOM.h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial color="#180b12" roughness={1} />
      </mesh>
      <mesh position={[0, ROOM.h - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.3, 1.75, 32]} />
        <meshStandardMaterial color="#2a1420" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      <Chandelier y={ROOM.h - 0.45} />

      <WallArt z={-half.d + 0.02} rotationY={0} />
      <WallArt z={half.d - 0.02} rotationY={Math.PI} />
    </group>
  )
}
