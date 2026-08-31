import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MODELS } from './models'
import { useFittedModel } from './useFittedModel'
import { useGame } from '../state/useGame'

function GlbDealer() {
  const { object } = useFittedModel(MODELS.character)
  return <primitive object={object} />
}

function FallbackDealer() {
  return (
    <group>
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.19, 0.5, 8, 16]} />
        <meshStandardMaterial color="#151821" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.52, 0]} castShadow>
        <sphereGeometry args={[0.125, 24, 24]} />
        <meshStandardMaterial color="#c99b74" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.12, 0.18]}>
        <boxGeometry args={[0.06, 0.28, 0.012]} />
        <meshStandardMaterial color="#8b1220" roughness={0.5} />
      </mesh>
    </group>
  )
}

/**
 * The dealer, with a weighted lean toward the shoe each time a card comes out.
 *
 * man_in_suit.glb has no skeleton (skins: 0, animations: 0), so the arms cannot
 * be posed. Leaning the whole figure reads as reaching for the shoe and is the
 * most honest motion available from a static mesh — a rigged dealer would be
 * needed for real hand animation.
 */
function DealMotion({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const gesture = useRef(0)
  const lastCount = useRef(0)

  const cardCount = useGame(
    s => (s.round?.dealer.length ?? 0) + (s.round?.hands.reduce((a, h) => a + h.cards.length, 0) ?? 0)
  )

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return

    if (cardCount > lastCount.current) gesture.current = 1
    lastCount.current = cardCount

    if (gesture.current > 0) gesture.current = Math.max(gesture.current - dt * 2.1, 0)

    // Ease out and back, peaking early like a real reach.
    const e = Math.sin(gesture.current * Math.PI)
    g.rotation.x = -e * 0.12
    g.rotation.y = e * 0.16
    g.position.z = e * 0.05
    g.position.y = -e * 0.02
  })

  return <group ref={group}>{children}</group>
}

export default function Dealer({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <DealMotion>
        <Suspense fallback={<FallbackDealer />}>
          <GlbDealer />
        </Suspense>
      </DealMotion>
    </group>
  )
}
