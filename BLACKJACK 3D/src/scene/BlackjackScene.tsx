import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useGame } from '../state/useGame'
import { useWallet } from '../state/useWallet'
import Table, { BettingCircle } from './Table'
import Room from './Room'
import Prop from '../lobby/Prop'
import { NEW_MODELS } from '../lobby/casinoModels'
import Dealer from './Dealer'
import DealerSpeech from './DealerSpeech'
import SeatedCamera from './SeatedCamera'
import DevBridge from './DevBridge'
import HandArea from './HandArea'
import DealerArea from './DealerArea'
import ChipField from './ChipField'
import ChipFlights from './ChipFlights'
import ChipTray from './ChipTray'
import { LAYOUT, TableMetrics, TableMetricsContext } from './TableMetrics'
import { ChipPlacement, betPlacements, dealerTrayPlacements, rackPlacements } from './tableLayout'

function Scene() {
  const [surfaceY, setSurfaceY] = useState(0.81)
  const [measured, setMeasured] = useState(false)

  const onSurface = useCallback((y: number) => {
    if (Number.isFinite(y) && y > 0.2 && y < 2) {
      setSurfaceY(y)
      setMeasured(true)
    }
  }, [])

  const metrics = useMemo<TableMetrics>(() => ({ surfaceY, ready: measured }), [surfaceY, measured])
  const restY = surfaceY + LAYOUT.restOffset

  const round = useGame(s => s.round)
  const pendingBet = useGame(s => s.pendingBet)
  const setAnchors = useGame(s => s.setAnchors)
  const balance = useWallet(s => s.balance)

  // Publish the real world positions so chip flights start and land correctly.
  useEffect(() => {
    setAnchors({
      rack: [0, restY + 0.03, LAYOUT.rackZ],
      bet: [0, restY + 0.02, LAYOUT.bettingCircleZ],
      dealerTray: [0, restY + 0.03, LAYOUT.dealerTrayZ],
    })
  }, [restY, setAnchors])

  // Every settled chip on the table, gathered into instanced batches.
  const chips = useMemo<ChipPlacement[]>(() => {
    const out: ChipPlacement[] = []
    out.push(...rackPlacements(balance, restY))
    out.push(...dealerTrayPlacements(restY))
    if (pendingBet > 0) out.push(...betPlacements(pendingBet, 0, 1, restY))
    if (round) {
      round.hands.forEach((h, i) => {
        out.push(...betPlacements(h.bet, i, round.hands.length, restY))
      })
    }
    return out
  }, [balance, pendingBet, round, restY])

  const betting = !round || round.phase === 'BETTING'

  return (
    <TableMetricsContext.Provider value={metrics}>
      <color attach="background" args={['#0a0508']} />
      <fog attach="fog" args={['#120810', 4, 14]} />

      <SeatedCamera />
      {import.meta.env.DEV && <DevBridge />}

      <ambientLight intensity={0.55} color="#ffd9b0" />
      <spotLight
        position={[0, surfaceY + 1.9, -0.05]}
        angle={0.85}
        penumbra={0.8}
        intensity={22}
        color="#fff0d0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-2.4, 1.9, 1.8]} intensity={6} color="#ff5f8a" distance={9} />
      <pointLight position={[2.4, 1.8, 1.4]} intensity={5} color="#4f7dff" distance={9} />
      <pointLight position={[0, surfaceY + 0.9, -1.2]} intensity={3} color="#ffd9a0" distance={4} />

      <Suspense fallback={null}>
        <Room />
        {/* Background casino decor against the back wall, behind the dealer —
            uses the detailed furniture models in-game (not just the lobby).
            Kept to the light slot-machine model so the heavy procedural table
            stays the scene's only big mesh. */}
        <Prop spec={NEW_MODELS.slotMachine} position={[-3.2, 0, -4.0]} rotationY={0} />
        <Prop spec={NEW_MODELS.slotMachine} position={[-1.95, 0, -4.0]} rotationY={0} />
        <Prop spec={NEW_MODELS.slotMachine} position={[3.2, 0, -4.0]} rotationY={0} />
        <Prop spec={NEW_MODELS.slotMachine} position={[1.95, 0, -4.0]} rotationY={0} />
        <Table onSurface={onSurface} />
        <BettingCircle surfaceY={surfaceY} active={betting} />
        <ChipTray surfaceY={surfaceY} z={LAYOUT.rackZ} />
        <ChipTray surfaceY={surfaceY} z={LAYOUT.dealerTrayZ} />

        <Dealer position={[0, 0, LAYOUT.dealerStandZ]} />
        <DealerSpeech position={[0, surfaceY + 0.78, LAYOUT.dealerStandZ + 0.12]} />

        {round && <DealerArea cards={round.dealer} restY={restY} />}

        {round?.hands.map((h, i) => (
          <HandArea
            key={i}
            hand={h}
            slot={i}
            slotCount={round.hands.length}
            active={round.phase === 'PLAYER' && round.activeHandIndex === i}
            restY={restY}
          />
        ))}

        <ChipField placements={chips} />
        <ChipFlights />
      </Suspense>
    </TableMetricsContext.Provider>
  )
}

export default function BlackjackScene() {
  return (
    <Canvas
      shadows
      // Fixed rather than adaptive: a PerformanceMonitor that flips the ratio
      // resizes every render target, which costs more than it saves here.
      dpr={[1, 1.75]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
      camera={{ fov: 55, near: 0.03, far: 40 }}
    >
      <Scene />
    </Canvas>
  )
}
