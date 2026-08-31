import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { MODELS, TABLE_WIDTH } from './models'
import { useFittedModel } from './useFittedModel'
import { LAYOUT } from './TableMetrics'
import { useCosmetics } from '../state/useCosmetics'

function GlbTable({ onSurface }: { onSurface: (y: number) => void }) {
  const { object, surfaceY } = useFittedModel(MODELS.table)
  const feltColor = useCosmetics(s => s.currentFelt().felt)

  useEffect(() => {
    onSurface(surfaceY)
  }, [surfaceY, onSurface])

  // Tint the felt material to the selected skin, so the in-game table matches
  // the lobby/roulette. The blackjack GLB names its felt material "Felt".
  useEffect(() => {
    const target = new THREE.Color(feltColor)
    object.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial
        if (mat?.name && /felt/i.test(mat.name) && (mat as any).color) {
          mat.color.copy(target)
          mat.needsUpdate = true
        }
      }
    })
  }, [object, feltColor])

  return <primitive object={object} />
}

export function FallbackTable({ surfaceY = 0.81 }: { surfaceY?: number }) {
  return (
    <group>
      <mesh position={[0, surfaceY - 0.03, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[TABLE_WIDTH / 2, TABLE_WIDTH / 2, 0.06, 48, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#0e5a2b" roughness={0.95} />
      </mesh>
      <mesh position={[0, (surfaceY - 0.03) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, surfaceY - 0.03, 24]} />
        <meshStandardMaterial color="#2a1608" roughness={0.6} />
      </mesh>
    </group>
  )
}

/** The betting spot the player drops chips onto. */
export function BettingCircle({ surfaceY, active }: { surfaceY: number; active: boolean }) {
  return (
    <mesh
      // Just under the chips' resting height so the ring cannot z-fight with
      // the stack that lands on it.
      position={[0, surfaceY + 0.0004, LAYOUT.bettingCircleZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.058, 0.064, 48]} />
      <meshBasicMaterial
        color={active ? '#ffd964' : '#e8d9a0'}
        transparent
        opacity={active ? 0.85 : 0.3}
      />
    </mesh>
  )
}

export default function Table({ onSurface }: { onSurface: (y: number) => void }) {
  return (
    <Suspense fallback={<FallbackTable />}>
      <GlbTable onSurface={onSurface} />
    </Suspense>
  )
}
