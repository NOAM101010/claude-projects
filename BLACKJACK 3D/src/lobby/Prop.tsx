import { Suspense } from 'react'
import type { ModelSpec } from '../scene/models'
import { useFittedModel } from '../three'

function Model({ spec }: { spec: ModelSpec }) {
  const { object } = useFittedModel(spec)
  return <primitive object={object} />
}

/**
 * Places a fitted GLB prop at a position. Renders nothing until loaded (props
 * are decorative, so no fallback box is needed).
 */
export default function Prop({
  spec,
  position,
  rotationY = 0,
  scale = 1,
}: {
  spec: ModelSpec
  position: [number, number, number]
  rotationY?: number
  scale?: number
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <Suspense fallback={null}>
        <Model spec={spec} />
      </Suspense>
    </group>
  )
}
