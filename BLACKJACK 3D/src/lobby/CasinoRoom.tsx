import { useMemo } from 'react'
import * as THREE from 'three'
import { Sparkles } from '@react-three/drei'
import { ROOM } from './lobbyLayout'
import Prop from './Prop'
import { CASINO } from './casinoModels'
import { t } from '../i18n/he'

const half = { w: ROOM.w / 2, d: ROOM.d / 2 }

function carpetTexture(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 1.4)
  grad.addColorStop(0, '#3a1020')
  grad.addColorStop(1, '#1e0a14')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  g.strokeStyle = 'rgba(212,175,55,0.16)'
  g.lineWidth = 2
  const step = S / 6
  for (let i = -6; i < 12; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step + S, S); g.stroke()
    g.beginPath(); g.moveTo(i * step, S); g.lineTo(i * step + S, 0); g.stroke()
  }
  g.fillStyle = 'rgba(212,175,55,0.12)'
  for (let x = 0; x < 6; x++)
    for (let y = 0; y < 6; y++) {
      g.beginPath()
      g.arc(x * step + step / 2, y * step + step / 2, step * 0.13, 0, Math.PI * 2)
      g.fill()
    }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  return tex
}

/** Polished marble medallion inlaid at the room centre. */
function marbleTexture(): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#14100c'
  g.fillRect(0, 0, S, S)
  // Veined marble
  g.strokeStyle = 'rgba(212,175,55,0.22)'
  for (let i = 0; i < 40; i++) {
    g.lineWidth = Math.random() * 1.6 + 0.3
    g.beginPath()
    let x = Math.random() * S, y = Math.random() * S
    g.moveTo(x, y)
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 120
      y += (Math.random() - 0.5) * 120
      g.lineTo(x, y)
    }
    g.stroke()
  }
  // Gold ring + central spade
  g.strokeStyle = '#d4af37'
  g.lineWidth = 8
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.4, 0, Math.PI * 2); g.stroke()
  g.lineWidth = 3
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.34, 0, Math.PI * 2); g.stroke()
  g.fillStyle = 'rgba(212,175,55,0.5)'
  g.font = `${S * 0.34}px serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('♠', S / 2, S / 2 + S * 0.02)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
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
  grad.addColorStop(0, '#20101a')
  grad.addColorStop(0.5, '#38182a')
  grad.addColorStop(1, '#140a12')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // Damask motif
  g.strokeStyle = 'rgba(212,175,55,0.12)'
  g.lineWidth = 1.5
  for (let y = 40; y < H; y += 90) {
    for (let x = 30; x < W; x += 70) {
      g.beginPath()
      g.ellipse(x, y, 16, 26, 0, 0, Math.PI * 2)
      g.stroke()
    }
  }
  g.strokeStyle = 'rgba(212,175,55,0.3)'
  g.lineWidth = 3
  g.strokeRect(W * 0.12, H * 0.14, W * 0.76, H * 0.72)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(4, 1)
  return tex
}

/** Glowing marquee wordmark on canvas, emissive. */
function marqueeTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  g.fillStyle = 'rgba(0,0,0,0)'
  g.fillRect(0, 0, W, H)
  g.font = `bold ${H * 0.5}px Georgia, "Times New Roman", serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = '#ffcf5a'
  g.shadowBlur = 40
  g.fillStyle = '#ffe79a'
  g.fillText(t('brand'), W / 2, H / 2)
  g.shadowBlur = 0
  g.fillStyle = '#fff6da'
  g.fillText(t('brand'), W / 2, H / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const WALLS = [
  { x: 0, z: -half.d, ry: 0, span: ROOM.w },
  { x: 0, z: half.d, ry: Math.PI, span: ROOM.w },
  { x: -half.w, z: 0, ry: Math.PI / 2, span: ROOM.d },
  { x: half.w, z: 0, ry: -Math.PI / 2, span: ROOM.d },
] as const

export default function CasinoRoom() {
  const carpet = useMemo(carpetTexture, [])
  const marble = useMemo(marbleTexture, [])
  const wall = useMemo(wallTexture, [])
  const marquee = useMemo(marqueeTexture, [])

  const columns: [number, number][] = [
    [-half.w + 1.4, -half.d + 1.4],
    [half.w - 1.4, -half.d + 1.4],
    [-half.w + 1.4, half.d - 1.4],
    [half.w - 1.4, half.d - 1.4],
  ]

  return (
    <group>
      {/* Carpet floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial map={carpet} roughness={0.98} />
      </mesh>

      {/* Polished marble medallion at the centre */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
        <circleGeometry args={[3.2, 64]} />
        <meshStandardMaterial map={marble} roughness={0.18} metalness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[3.2, 3.32, 64]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.25} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, ROOM.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial color="#0c0710" roughness={1} />
      </mesh>
      {/* Coffered gold ring on the ceiling */}
      <mesh position={[0, ROOM.height - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.3, 2.9, 48]} />
        <meshStandardMaterial color="#3a2410" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Walls with gold rail + skirting */}
      {WALLS.map((w, i) => (
        <group key={i} position={[w.x, 0, w.z]} rotation={[0, w.ry, 0]}>
          <mesh position={[0, ROOM.height / 2, 0]}>
            <planeGeometry args={[w.span, ROOM.height]} />
            <meshStandardMaterial map={wall} roughness={0.82} side={THREE.DoubleSide} />
          </mesh>
          {[
            { y: 1.05, h: 0.03 },
            { y: 0.06, h: 0.12 },
            { y: ROOM.height - 0.08, h: 0.06 },
          ].map((s, si) => (
            <mesh key={si} position={[0, s.y, 0.02]}>
              <boxGeometry args={[w.span, s.h, 0.03]} />
              <meshStandardMaterial color="#a9862c" metalness={0.9} roughness={0.32} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Marquee wordmark on the far wall, above the blackjack table */}
      <group position={[0, 2.7, -half.d + 0.06]}>
        <mesh>
          <planeGeometry args={[6, 1.5]} />
          <meshBasicMaterial map={marquee} transparent toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0, 0.6]} intensity={5} color="#ffcf5a" distance={5} />
      </group>

      {/* Columns */}
      {columns.map(([x, z], i) => (
        <Prop key={i} spec={CASINO.column} position={[x, 0, z]} />
      ))}

      {/* Floor lamps flanking the entrance */}
      <Prop spec={CASINO.lamp} position={[-half.w + 1.2, 0, half.d - 4]} />
      <Prop spec={CASINO.lamp} position={[half.w - 1.2, 0, half.d - 4]} />

      {/* Lounge seating */}
      <Prop spec={CASINO.armchair} position={[-half.w + 2.4, 0, half.d - 2]} rotationY={-2.3} />
      <Prop spec={CASINO.armchair} position={[half.w - 2.4, 0, half.d - 2]} rotationY={2.3} />
      <Prop spec={CASINO.sideTable} position={[0, 0, half.d - 2.2]} />

      {/* Velvet ropes framing the entrance walkway */}
      {[-1.5, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, half.d - 5.5]}>
          {[-0.8, 0.8].map((z, j) => (
            <mesh key={j} position={[0, 0.5, z]} castShadow>
              <cylinderGeometry args={[0.05, 0.07, 1, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[0.06, 0.02, 1.6]} />
            <meshStandardMaterial color="#7a1020" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Floating sparkle motes for atmosphere */}
      <Sparkles count={60} scale={[ROOM.w * 0.8, 3, ROOM.d * 0.8]} position={[0, 1.6, 0]} size={2.5} speed={0.3} color="#ffd964" opacity={0.5} />

      {/* Cinematic lighting */}
      <ambientLight intensity={0.42} color="#ffdcb0" />
      <hemisphereLight args={['#4a2436', '#0a0508', 0.55]} />
      <pointLight position={[0, ROOM.height - 0.5, 0]} intensity={26} color="#ffe6b8" distance={16} decay={2} castShadow />
      <spotLight position={[0, ROOM.height - 0.3, 0]} target-position={[0, 0, 0]} angle={0.9} penumbra={0.9} intensity={30} color="#fff0d0" />
      <pointLight position={[-half.w + 2, 2.4, half.d - 4]} intensity={7} color="#ff9b6a" distance={7} />
      <pointLight position={[half.w - 2, 2.4, half.d - 4]} intensity={7} color="#ff9b6a" distance={7} />
      <pointLight position={[0, 2, -half.d + 2]} intensity={5} color="#ffd08a" distance={8} />
    </group>
  )
}
