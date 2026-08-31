import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CHIP_VALUES, ChipValue } from './models'
import { chipGeometry, chipMaterials } from './chipMesh'
import { useGame } from '../state/useGame'

const SCRATCH = new THREE.Object3D()
const MAX_IN_FLIGHT = 32

/** Eased arc between two points, rising in the middle like a tossed chip. */
function arc(out: THREE.Vector3, from: number[], to: number[], t: number) {
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  out.set(
    from[0] + (to[0] - from[0]) * e,
    from[1] + (to[1] - from[1]) * e + Math.sin(e * Math.PI) * 0.16,
    from[2] + (to[2] - from[2]) * e
  )
  return out
}

function FlightBatch({ value }: { value: ChipValue }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = chipGeometry()
  const materials = useMemo(() => chipMaterials(value), [value])
  const position = useRef(new THREE.Vector3())

  const flights = useGame(s => s.flights)
  const retireFlight = useGame(s => s.retireFlight)

  const mine = useMemo(() => flights.filter(f => f.value === value), [flights, value])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (mesh) mesh.count = Math.min(mine.length, MAX_IN_FLIGHT)
  }, [mine])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const now = performance.now()
    let written = 0

    for (const f of mine) {
      if (written >= MAX_IN_FLIGHT) break
      const t = (now - f.startedAt) / f.duration
      if (t >= 1) {
        retireFlight(f.id)
        continue
      }
      arc(position.current, f.from, f.to, Math.max(t, 0))
      SCRATCH.position.copy(position.current)
      SCRATCH.rotation.set(0, t * Math.PI * 2.5, t * 0.4)
      SCRATCH.updateMatrix()
      mesh.setMatrixAt(written++, SCRATCH.matrix)
    }

    mesh.count = written
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, materials as any, MAX_IN_FLIGHT]}
      castShadow
      frustumCulled={false}
    />
  )
}

/**
 * Chips in motion between the rack, the betting spot and the dealer's tray.
 * Kept separate from the static ChipField so settled stacks are never rewritten
 * on a frame where only a flight moved.
 */
export default function ChipFlights() {
  return (
    <>
      {CHIP_VALUES.map(v => (
        <FlightBatch key={v} value={v} />
      ))}
    </>
  )
}
