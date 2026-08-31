import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { StationDef } from './lobbyLayout'
import Prop from './Prop'
import { CASINO, NEW_MODELS } from './casinoModels'
import { t } from '../i18n/he'

const LABEL: Record<string, string> = {
  blackjack: t('blackjack'),
  slots: t('slots'),
  roulette: t('roulette'),
  scratch: t('scratch'),
}

/** A small scratch-ticket kiosk built from primitives. */
function ScratchKiosk() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.2, 0.5]} />
        <meshStandardMaterial color="#5a1a22" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.15, 0.26]}>
        <boxGeometry args={[0.9, 0.5, 0.04]} />
        <meshStandardMaterial color="#d4af37" emissive="#ffcf5a" emissiveIntensity={0.4} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.55, 0.26]}>
        <boxGeometry args={[0.7, 0.5, 0.03]} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.05, 20]} />
        <meshStandardMaterial color="#2a1010" roughness={0.7} />
      </mesh>
    </group>
  )
}

interface Props {
  station: StationDef
  locked: boolean
  unlockLevel: number
  highlighted: boolean
}

export default function GameStation({ station, locked, unlockLevel, highlighted }: Props) {
  const { position, rotationY } = station
  const p: [number, number, number] = [position.x, 0, position.z]

  const body =
    station.id === 'slots' ? (
      <Prop spec={NEW_MODELS.slotMachine} position={[0, 0, 0]} rotationY={rotationY} />
    ) : station.id === 'roulette' ? (
      <Prop spec={CASINO.rouletteTable} position={[0, 0, 0]} rotationY={rotationY} scale={0.85} />
    ) : station.id === 'scratch' ? (
      <group rotation={[0, rotationY, 0]}>
        <ScratchKiosk />
      </group>
    ) : (
      <Prop spec={NEW_MODELS.blackjackTable} position={[0, 0, 0]} rotationY={rotationY} />
    )

  return (
    <group position={p}>
      {body}

      {/* Neon sign floating above */}
      <Billboard position={[0, 2.7, 0]}>
        <Text
          fontSize={0.42}
          color={locked ? '#8a8a8a' : '#ffd964'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={locked ? '#000' : '#7a4a00'}
        >
          {LABEL[station.id]}
        </Text>
        {locked && (
          <Text position={[0, -0.42, 0]} fontSize={0.24} color="#c98a8a" anchorX="center" anchorY="middle">
            {`🔒 ${t('unlockAtLevel')} ${unlockLevel}`}
          </Text>
        )}
      </Billboard>

      {/* Ground halo when the player is near enough to play */}
      {highlighted && !locked && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.75, 48]} />
          <meshBasicMaterial color="#ffd964" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Warm spotlight over each station */}
      <pointLight position={[0, 2.3, 0]} intensity={locked ? 2 : 7} color={locked ? '#8899aa' : '#ffd08a'} distance={5} />
    </group>
  )
}
