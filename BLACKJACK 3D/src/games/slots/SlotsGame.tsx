import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useSlots, AUTO_COUNTS } from './useSlots'
import { useJackpot } from '../../state/useJackpot'
import SlotReels from './SlotReels'
import SlotsPaytable from './SlotsPaytable'
import { t } from '../../i18n/he'

/** A clean, premium slot cabinet built from primitives (no clashing GLB). */
function Cabinet() {
  const spinning = useSlots(s => s.phase === 'spinning')

  return (
    <group>
      {/* Cabinet body */}
      <mesh position={[0, 0, -0.25]}>
        <boxGeometry args={[2.05, 2.5, 0.5]} />
        <meshStandardMaterial color="#14100a" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Rounded gold crown */}
      <mesh position={[0, 1.32, -0.2]}>
        <boxGeometry args={[2.15, 0.28, 0.55]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.25} />
      </mesh>
      {/* Side light strips */}
      {[-1.0, 1.0].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0.02]}>
          <boxGeometry args={[0.07, 2.1, 0.07]} />
          <meshStandardMaterial color="#ffcf5a" emissive="#ffcf5a" emissiveIntensity={spinning ? 2.4 : 1.1} toneMapped={false} />
        </mesh>
      ))}

      {/* Reel window: recessed dark panel + gold frame */}
      <mesh position={[0, 0.05, 0.03]}>
        <boxGeometry args={[1.72, 0.78, 0.06]} />
        <meshStandardMaterial color="#050505" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.05, 0.02]}>
        <boxGeometry args={[1.84, 0.9, 0.05]} />
        <meshStandardMaterial color="#a9862c" metalness={0.92} roughness={0.28} />
      </mesh>

      <group position={[0, 0.05, 0.08]}>
        <SlotReels />
      </group>

      {/* Lever on the right */}
      <group position={[1.15, 0.1, 0.1]}>
        <mesh position={[0, spinning ? -0.15 : 0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
          <meshStandardMaterial color="#8a6d1f" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, spinning ? 0.12 : 0.38, 0]}>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshStandardMaterial color="#c8102e" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function SlotsScene() {
  return (
    <>
      <color attach="background" args={['#0a0608']} />
      <fog attach="fog" args={['#0a0608', 5, 12]} />
      <ambientLight intensity={0.55} color="#ffe0c0" />
      <spotLight position={[0, 2.6, 2.4]} angle={0.7} penumbra={0.8} intensity={26} color="#fff0d0" castShadow />
      <pointLight position={[0, 0.2, 1.4]} intensity={6} color="#ffd08a" distance={5} />
      <pointLight position={[-2, 0.5, 1]} intensity={3} color="#ff5f8a" distance={6} />
      <pointLight position={[2, 0.5, 1]} intensity={3} color="#4f7dff" distance={6} />
      <Cabinet />
    </>
  )
}

function ChipButton({ label, onClick, disabled, accent }: {
  label: string; onClick: () => void; disabled?: boolean; accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-5 py-2.5 font-bold transition hover:brightness-110 disabled:opacity-30 ${
        accent ? 'lux-gold' : 'lux-glass text-white'
      }`}
    >
      {label}
    </button>
  )
}

export default function SlotsGame() {
  const bet = useSlots(s => s.bet)
  const phase = useSlots(s => s.phase)
  const minBet = useSlots(s => s.minBet)
  const maxBet = useSlots(s => s.maxBet)
  const message = useSlots(s => s.message)
  const changeBet = useSlots(s => s.changeBet)
  const setBetToMax = useSlots(s => s.setBetToMax)
  const setBetToMin = useSlots(s => s.setBetToMin)
  const doSpin = useSlots(s => s.doSpin)
  const startAuto = useSlots(s => s.startAuto)
  const stopAuto = useSlots(s => s.stopAuto)
  const autoRemaining = useSlots(s => s.autoRemaining)
  const syncBounds = useSlots(s => s.syncBounds)
  const [autoCount, setAutoCount] = useState(AUTO_COUNTS[1]) // default 25

  useEffect(() => { syncBounds() }, [syncBounds])

  const spinning = phase === 'spinning'
  const auto = autoRemaining > 0

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ position: [0, 0.15, 2.6], fov: 50 }}
      >
        <SlotsScene />
      </Canvas>

      {/* Progressive jackpot banner */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center">
        <div className="lux-glass flex items-center gap-3 rounded-2xl px-6 py-2">
          <span className="text-xl">💎</span>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold/70">{t('jackpot')}</div>
            <div className="lux-gold-text font-display text-2xl font-bold tabular-nums">
              {useJackpot(s => s.pool).toLocaleString('he-IL')}
            </div>
          </div>
        </div>
      </div>

      {/* Paytable on the side */}
      <div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2">
        <SlotsPaytable />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-4 p-6 pb-10">
        {message && (
          <div className="lux-glass rounded-2xl px-7 py-2.5 font-display text-2xl font-bold text-gold" style={{ animation: 'floatUp .3s ease-out' }}>
            {message}
          </div>
        )}

        {/* Auto-play row: pick a count, then AUTO runs them hands-free. */}
        <div className="lux-glass pointer-events-auto flex items-center gap-2 rounded-3xl px-4 py-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gold/60">{t('autoPlay')}</span>
          {AUTO_COUNTS.map(n => (
            <button
              key={n}
              onClick={() => setAutoCount(n)}
              disabled={auto}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition disabled:opacity-40 ${
                autoCount === n ? 'lux-gold' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {n}
            </button>
          ))}
          {auto ? (
            <button onClick={stopAuto} className="rounded-lg bg-red-500/80 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-500">
              ⏹ {t('stop')} · {autoRemaining}
            </button>
          ) : (
            <button onClick={() => startAuto(autoCount)} disabled={spinning} className="rounded-lg bg-gold/90 px-4 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-40">
              ▶ {t('autoStart')}
            </button>
          )}
        </div>

        <div className="lux-glass pointer-events-auto flex items-center gap-2 rounded-3xl px-5 py-3">
          <ChipButton label="MIN" onClick={setBetToMin} disabled={spinning || auto || bet <= minBet} />
          <ChipButton label="−" onClick={() => changeBet(-1)} disabled={spinning || auto || bet <= minBet} />
          <div className="min-w-24 text-center">
            <div className="text-[10px] uppercase tracking-widest text-gold/60">{t('bet')}</div>
            <div className="font-display text-2xl font-bold text-white tabular-nums">{bet.toLocaleString('he-IL')}</div>
          </div>
          <ChipButton label="+" onClick={() => changeBet(1)} disabled={spinning || auto || bet >= maxBet} />
          <ChipButton label="MAX" onClick={setBetToMax} disabled={spinning || auto || bet >= maxBet} />

          <div className="mx-1 h-10 w-px bg-white/15" />

          <ChipButton label={t('spin')} accent onClick={doSpin} disabled={spinning || auto} />
        </div>
      </div>
    </div>
  )
}
