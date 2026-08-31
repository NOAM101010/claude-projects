import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useApp, GameId } from '../state/useApp'
import { useProgress } from '../progression/useProgress'
import { gameUnlockLevel } from '../progression/levels'
import { STATIONS } from './lobbyLayout'
import CasinoRoom from './CasinoRoom'
import GameStation from './GameStation'
import FpsController from './FpsController'
import { useOverlay } from '../state/useOverlay'
import { submitPlayerScore } from '../services/useLeaderboard'
import { t } from '../i18n/he'

function Scene({
  locked,
  onRequestLock,
  onNearStation,
  onInteract,
  level,
  nearId,
}: {
  locked: boolean
  onRequestLock: () => void
  onNearStation: (id: GameId | null) => void
  onInteract: (id: GameId) => void
  level: number
  nearId: GameId | null
}) {
  return (
    <>
      <color attach="background" args={['#0a0508']} />
      <fog attach="fog" args={['#0a0508', 6, 24]} />

      <FpsController
        locked={locked}
        onRequestLock={onRequestLock}
        onNearStation={onNearStation}
        onInteract={onInteract}
      />

      <Suspense fallback={null}>
        <CasinoRoom />
        {STATIONS.map(s => {
          const need = gameUnlockLevel(s.id)
          return (
            <GameStation
              key={s.id}
              station={s}
              locked={level < need}
              unlockLevel={need}
              highlighted={nearId === s.id}
            />
          )
        })}
      </Suspense>
    </>
  )
}

/**
 * The walkable 3D casino floor. WASD + mouse (pointer lock); approach a station
 * and press E to sit down. Locked games show their required level.
 */
export default function LobbyScene() {
  const enterGame = useApp(s => s.enterGame)
  const level = useProgress(s => s.level())
  const [locked, setLocked] = useState(false)
  const [nearId, setNearId] = useState<GameId | null>(null)
  const openPanel = useOverlay(s => s.open)

  // Publish the player's standing whenever the lobby is shown.
  useEffect(() => {
    submitPlayerScore()
  }, [])

  const requestLock = useCallback(() => {
    const canvas = document.querySelector('canvas')
    canvas?.requestPointerLock?.()
  }, [])

  // Track lock state so the controller only moves while locked.
  const onLockChange = useCallback(() => {
    setLocked(!!document.pointerLockElement)
  }, [])

  const tryEnter = useCallback(
    (id: GameId) => {
      if (level >= gameUnlockLevel(id)) {
        document.exitPointerLock?.()
        enterGame(id)
      }
    },
    [enterGame, level]
  )

  const nearLocked = nearId ? level < gameUnlockLevel(nearId) : false

  return (
    <div className="absolute inset-0" onMouseDown={undefined}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
        camera={{ fov: 70, near: 0.05, far: 60 }}
        onCreated={() => {
          document.addEventListener('pointerlockchange', onLockChange)
        }}
      >
        <Scene
          locked={locked}
          onRequestLock={requestLock}
          onNearStation={setNearId}
          onInteract={tryEnter}
          level={level}
          nearId={nearId}
        />
      </Canvas>

      {/* Subtle movement hint (does not block; walking works immediately). */}
      {!locked && (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center">
          <button
            onClick={requestLock}
            className="lux-glass pointer-events-auto rounded-full px-5 py-2 text-sm text-white/70 transition hover:text-white"
            style={{ animation: 'floatUp .4s ease-out' }}
          >
            {t('moveHint')} · לחץ להבטה עם העכבר
          </button>
        </div>
      )}

      {/* Interaction prompt when near a station */}
      {locked && nearId && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
          <div
            className={`lux-glass rounded-full px-6 py-2.5 font-bold ${
              nearLocked ? 'text-white/60' : 'text-gold'
            }`}
            style={{ animation: 'floatUp .25s ease-out' }}
          >
            {nearLocked
              ? `🔒 ${t('unlockAtLevel')} ${gameUnlockLevel(nearId)}`
              : `⏎  ${t('interactPrompt')}`}
          </div>
        </div>
      )}

      {/* Crosshair */}
      {locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      )}

      {/* Lobby menu buttons (hidden while walking) */}
      {!locked && (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2.5">
          <button onClick={() => openPanel('menu')} className="lux-gold rounded-full px-5 py-2.5 text-sm font-bold">
            ☰ {t('menu')} <span className="rounded bg-black/20 px-1.5 text-[10px]">M</span>
          </button>
          <button onClick={() => openPanel('shop')} className="lux-glass rounded-full px-5 py-2.5 text-sm font-bold text-gold transition hover:border-gold">
            🪙 {t('shop')}
          </button>
          <button onClick={() => openPanel('profile')} className="lux-glass rounded-full px-5 py-2.5 text-sm font-bold text-gold transition hover:border-gold">
            🤵 {t('profile')}
          </button>
          <button onClick={() => openPanel('leaderboard')} className="lux-glass rounded-full px-5 py-2.5 text-sm font-bold text-gold transition hover:border-gold">
            🏅 {t('leaderboard')}
          </button>
        </div>
      )}

    </div>
  )
}
