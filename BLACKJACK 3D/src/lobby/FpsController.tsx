import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  EYE_HEIGHT, SPAWN, allColliders, clampToRoom, moveWithCollision,
  stationInRange, walkDelta, Vec2,
} from './lobbyLayout'
import { GameId } from '../state/useApp'

const SPEED = 3.2 // metres / second
const LOOK_SENSITIVITY = 0.0022
const MAX_PITCH = Math.PI / 2 - 0.15

interface Props {
  locked: boolean
  onRequestLock: () => void
  onNearStation: (id: GameId | null) => void
  onInteract: (id: GameId) => void
}

/**
 * Pointer-lock WASD walker. Movement and interaction detection delegate to the
 * pure helpers in lobbyLayout (which the tests cover); this component only wires
 * them to input, the camera and the frame loop.
 */
export default function FpsController({ locked, onRequestLock, onNearStation, onInteract }: Props) {
  const { camera, gl } = useThree()
  const pos = useRef<Vec2>({ ...SPAWN })
  // Spawn at +Z looking toward the tables at -Z. cameraForward(0) = (0,-1).
  const yaw = useRef(0)
  const pitch = useRef(0)
  const keys = useRef<Record<string, boolean>>({})
  const near = useRef<GameId | null>(null)
  const colliders = useRef(allColliders())

  // Initial camera placement.
  useEffect(() => {
    camera.position.set(SPAWN.x, EYE_HEIGHT, SPAWN.z)
    camera.rotation.order = 'YXZ'
  }, [camera])

  // Mouse look while pointer is locked.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      yaw.current -= e.movementX * LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH
      )
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [gl])

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true
      if (e.code === 'KeyE' && near.current) onInteract(near.current)
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [onInteract])

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05)

    // WASD always works — you never have to "start" to walk. Pointer lock only
    // governs mouse-look, so returning to the lobby you can move immediately.
    const k = keys.current
    let fx = 0
    let fz = 0
    if (k['KeyW'] || k['ArrowUp']) fz -= 1
    if (k['KeyS'] || k['ArrowDown']) fz += 1
    if (k['KeyA'] || k['ArrowLeft']) fx -= 1
    if (k['KeyD'] || k['ArrowRight']) fx += 1

    if (fx || fz) {
      const delta = walkDelta(yaw.current, fx, fz, SPEED * step)
      pos.current = clampToRoom(moveWithCollision(pos.current, delta, colliders.current))
    }

    camera.position.set(pos.current.x, EYE_HEIGHT, pos.current.z)
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')

    // Proximity to a station, reported only on change.
    const s = stationInRange(pos.current)
    const id = s?.id ?? null
    if (id !== near.current) {
      near.current = id
      onNearStation(id)
    }
  })

  // Click to (re)acquire pointer lock.
  useEffect(() => {
    const el = gl.domElement
    const onClick = () => {
      if (document.pointerLockElement !== el) onRequestLock()
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [gl, onRequestLock])

  return null
}
