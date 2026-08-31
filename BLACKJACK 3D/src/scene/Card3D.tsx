import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Card } from '../engine/types'
import { cardBackTexture, cardFaceTexture } from './cardTexture'
import { LAYOUT } from './TableMetrics'

const CARD_W = 0.062
const CARD_H = 0.088
const CARD_T = 0.0009

/** Where cards fly in from — the shoe at the dealer's right. */
const SHOE = new THREE.Vector3(0.52, 0.1, LAYOUT.dealerCardsZ - 0.16)

interface Props {
  card: Card
  position: [number, number, number]
  /** Slight fan rotation around the table's vertical axis. */
  tilt?: number
  delay?: number
}

export default function Card3D({ card, position, tilt = 0, delay = 0 }: Props) {
  const group = useRef<THREE.Group>(null)
  const elapsed = useRef(-delay)
  const dealt = useRef(false)
  const target = useRef(new THREE.Vector3())

  const face = cardFaceTexture(card.rank, card.suit)
  const back = cardBackTexture()

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return

    const faceX = card.faceUp ? -Math.PI / 2 : Math.PI / 2
    target.current.set(...position)

    if (!dealt.current) {
      elapsed.current += dt
      const p = THREE.MathUtils.clamp(elapsed.current / 0.42, 0, 1)
      const e = 1 - Math.pow(1 - p, 3)
      g.position.lerpVectors(SHOE, target.current, e)
      g.position.y += Math.sin(e * Math.PI) * 0.075
      g.rotation.x = faceX + (1 - e) * 0.8
      g.rotation.y = tilt
      g.scale.setScalar(0.88 + e * 0.12)
      if (p >= 1) dealt.current = true
      return
    }

    // Settled: only keep working while the flip or position is still catching up.
    const posDone = g.position.distanceToSquared(target.current) < 1e-8
    const rotDone = Math.abs(g.rotation.x - faceX) < 1e-4
    if (posDone && rotDone) return

    g.position.lerp(target.current, Math.min(dt * 8, 1))
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, faceX, Math.min(dt * 7, 1))
    g.rotation.y = tilt
    g.scale.setScalar(1)
  })

  return (
    <group ref={group} position={SHOE.toArray()}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CARD_W, CARD_H, CARD_T]} />
        <meshStandardMaterial attach="material-0" color="#f2efe4" roughness={0.75} />
        <meshStandardMaterial attach="material-1" color="#f2efe4" roughness={0.75} />
        <meshStandardMaterial attach="material-2" color="#f2efe4" roughness={0.75} />
        <meshStandardMaterial attach="material-3" color="#f2efe4" roughness={0.75} />
        <meshStandardMaterial attach="material-4" map={face} roughness={0.55} />
        <meshStandardMaterial attach="material-5" map={back} roughness={0.55} />
      </mesh>
    </group>
  )
}
