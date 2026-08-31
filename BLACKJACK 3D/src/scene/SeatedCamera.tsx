import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { LAYOUT, useTableMetrics } from './TableMetrics'
import { useGame } from '../state/useGame'

/**
 * First-person seated rig on the player's side of the table (+Z), looking across
 * at the dealer (-Z). The gaze target shifts between the dealer and your own
 * cards depending on whose turn it is, so the action is always framed.
 */
export default function SeatedCamera() {
  const { camera } = useThree()
  const { surfaceY } = useTableMetrics()
  const phase = useGame(s => s.round?.phase)

  const gaze = useRef(new THREE.Vector3())
  const smoothed = useRef(new THREE.Vector3())
  const pointer = useRef({ x: 0, y: 0 })
  const initialised = useRef(false)

  useFrame(({ pointer: p }, dt) => {
    const k = Math.min(dt * 3.5, 1)
    pointer.current.x += (p.x - pointer.current.x) * k
    pointer.current.y += (p.y - pointer.current.y) * k

    camera.position.set(
      pointer.current.x * 0.07,
      surfaceY + LAYOUT.eyeAboveFelt + pointer.current.y * 0.035,
      LAYOUT.seatZ
    )

    // Look at the dealer while he acts, at your own cards while you act.
    const lookAtDealer = phase === 'DEALER' || phase === 'PAYOUT' || phase === 'BETTING' || !phase
    const targetZ = lookAtDealer ? LAYOUT.dealerCardsZ : LAYOUT.playerCardsZ + 0.04
    const targetY = surfaceY + (lookAtDealer ? 0.14 : 0.02)

    gaze.current.set(
      pointer.current.x * 0.3,
      targetY + pointer.current.y * 0.16,
      targetZ
    )

    if (!initialised.current) {
      smoothed.current.copy(gaze.current)
      initialised.current = true
    } else {
      smoothed.current.lerp(gaze.current, Math.min(dt * 2.2, 1))
    }
    camera.lookAt(smoothed.current)
  })

  return null
}
