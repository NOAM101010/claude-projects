import { CHIP_DIAMETER, CHIP_VALUES } from './models'

const GAP = CHIP_DIAMETER * 1.15
const WIDTH = CHIP_VALUES.length * GAP + CHIP_DIAMETER * 0.5

/**
 * The recessed wooden tray the chip columns sit in, so a stack reads as held
 * rather than balanced on the felt.
 */
export default function ChipTray({ surfaceY, z }: { surfaceY: number; z: number }) {
  const depth = CHIP_DIAMETER * 1.5

  return (
    <group position={[0, surfaceY, z]}>
      <mesh position={[0, 0.0015, 0]} receiveShadow>
        <boxGeometry args={[WIDTH, 0.003, depth]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.75} metalness={0.1} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[0, 0.008, (side * depth) / 2]} castShadow receiveShadow>
          <boxGeometry args={[WIDTH, 0.016, 0.006]} />
          <meshStandardMaterial color="#4a3018" roughness={0.6} metalness={0.15} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh key={side} position={[(side * WIDTH) / 2, 0.008, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.006, 0.016, depth]} />
          <meshStandardMaterial color="#4a3018" roughness={0.6} metalness={0.15} />
        </mesh>
      ))}
      <mesh position={[0, 0.0165, 0]}>
        <boxGeometry args={[WIDTH * 1.004, 0.0012, depth * 1.02]} />
        <meshStandardMaterial color="#a9862c" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  )
}
