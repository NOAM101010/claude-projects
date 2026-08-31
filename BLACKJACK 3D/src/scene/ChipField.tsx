import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CHIP_VALUES, ChipValue } from './models'
import { chipGeometry, chipMaterials } from './chipMesh'
import type { ChipPlacement } from './tableLayout'

/** Generous fixed ceiling so the instance buffer is allocated once and reused. */
const MAX_PER_VALUE = 96

const SCRATCH = new THREE.Object3D()

function ValueBatch({ value, placements }: { value: ChipValue; placements: ChipPlacement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = chipGeometry()
  const materials = useMemo(() => chipMaterials(value), [value])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const count = Math.min(placements.length, MAX_PER_VALUE)
    for (let i = 0; i < count; i++) {
      const p = placements[i]
      SCRATCH.position.set(p.position[0], p.position[1], p.position[2])
      // A touch of yaw per chip so stacks do not look machine-printed.
      SCRATCH.rotation.set(0, (i * 2.399) % (Math.PI * 2), 0)
      SCRATCH.updateMatrix()
      mesh.setMatrixAt(i, SCRATCH.matrix)
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [placements])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, materials as any, MAX_PER_VALUE]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  )
}

/**
 * Every static chip on the table, drawn as one instanced batch per
 * denomination. Instance matrices are written imperatively rather than through
 * per-chip React components, so a hundred chips cost one commit, not a hundred.
 */
export default function ChipField({ placements }: { placements: ChipPlacement[] }) {
  const byValue = useMemo(() => {
    const map = new Map<ChipValue, ChipPlacement[]>()
    for (const v of CHIP_VALUES) map.set(v, [])
    for (const p of placements) map.get(p.value)?.push(p)
    return map
  }, [placements])

  return (
    <>
      {CHIP_VALUES.map(v => (
        <ValueBatch key={v} value={v} placements={byValue.get(v) ?? []} />
      ))}
    </>
  )
}
