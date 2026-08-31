import { GameId } from '../state/useApp'

/** Axis-aligned box on the floor plane (y ignored). */
export interface Box2 {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface Vec2 {
  x: number
  z: number
}

export const ROOM = { w: 18, d: 18, wallThickness: 0.4, height: 4 }

/** Eye height of the walking player. */
export const EYE_HEIGHT = 1.65
/** Player's collision radius. */
export const PLAYER_RADIUS = 0.35
/** How close you must be to a station to interact. */
export const INTERACT_RADIUS = 2.4

export interface StationDef {
  id: GameId
  /** Floor position the prop is centred on. */
  position: Vec2
  /** Facing (radians) so the prop turns toward room centre. */
  rotationY: number
  /** Collision footprint half-extents. */
  half: { x: number; z: number }
  /** Where the player stands to interact — just in front of the prop. */
  approach: Vec2
}

const half = { w: ROOM.w / 2, d: ROOM.d / 2 }

export const STATIONS: StationDef[] = [
  {
    id: 'blackjack',
    position: { x: 0, z: -half.d + 3 },
    rotationY: 0,
    half: { x: 1.4, z: 0.9 },
    approach: { x: 0, z: -half.d + 4.7 },
  },
  {
    id: 'slots',
    position: { x: -half.w + 2.2, z: 1 },
    rotationY: Math.PI / 2,
    half: { x: 0.8, z: 0.8 },
    approach: { x: -half.w + 3.9, z: 1 },
  },
  {
    id: 'roulette',
    position: { x: half.w - 3, z: 1 },
    rotationY: -Math.PI / 2,
    half: { x: 1.3, z: 1.3 },
    approach: { x: half.w - 5, z: 1 },
  },
  {
    id: 'scratch',
    position: { x: -4.5, z: -4 },
    rotationY: 0.84,
    half: { x: 1.0, z: 0.7 },
    approach: { x: -3.3, z: -2.9 },
  },
]

/** The player's spawn point, facing the blackjack table. */
export const SPAWN: Vec2 = { x: 0, z: half.d - 4 }

/**
 * Wall colliders extend far outward rather than being thin slabs, so a single
 * large movement step cannot tunnel through to the far side of a wall. The
 * inner face is what matters; the outer extent is effectively infinite.
 */
export function wallColliders(): Box2[] {
  const F = 1000
  return [
    { minX: -F, maxX: F, minZ: -half.d - F, maxZ: -half.d }, // far (-Z)
    { minX: -F, maxX: F, minZ: half.d, maxZ: half.d + F }, // near (+Z)
    { minX: -half.w - F, maxX: -half.w, minZ: -F, maxZ: F }, // left (-X)
    { minX: half.w, maxX: half.w + F, minZ: -F, maxZ: F }, // right (+X)
  ]
}

/** Station footprints as colliders. */
export function stationColliders(): Box2[] {
  return STATIONS.map(s => ({
    minX: s.position.x - s.half.x,
    maxX: s.position.x + s.half.x,
    minZ: s.position.z - s.half.z,
    maxZ: s.position.z + s.half.z,
  }))
}

export function allColliders(): Box2[] {
  return [...wallColliders(), ...stationColliders()]
}

/** Whether a circle of PLAYER_RADIUS at p overlaps the (expanded) box. */
function overlaps(p: Vec2, box: Box2): boolean {
  const cx = Math.max(box.minX, Math.min(p.x, box.maxX))
  const cz = Math.max(box.minZ, Math.min(p.z, box.maxZ))
  const dx = p.x - cx
  const dz = p.z - cz
  return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS
}

/**
 * Resolves a desired move against colliders by trying each axis independently,
 * so sliding along a wall keeps the tangential component instead of stopping
 * dead. Pure, which is how the walking is verified without a running renderer.
 */
export function moveWithCollision(from: Vec2, delta: Vec2, colliders: Box2[]): Vec2 {
  const pos = { ...from }

  const tryX = { x: pos.x + delta.x, z: pos.z }
  if (!colliders.some(b => overlaps(tryX, b))) pos.x = tryX.x

  const tryZ = { x: pos.x, z: pos.z + delta.z }
  if (!colliders.some(b => overlaps(tryZ, b))) pos.z = tryZ.z

  return pos
}

/** The station within interaction range, or null. Nearest wins on a tie. */
export function stationInRange(p: Vec2, stations: StationDef[] = STATIONS): StationDef | null {
  let best: StationDef | null = null
  let bestD = INTERACT_RADIUS * INTERACT_RADIUS
  for (const s of stations) {
    const dx = p.x - s.approach.x
    const dz = p.z - s.approach.z
    const d = dx * dx + dz * dz
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/**
 * Camera basis on the floor plane for a given yaw, matching three.js
 * `camera.rotation.set(pitch, yaw, 0, 'YXZ')`: local -Z (forward) and +X (right)
 * rotated about Y.
 */
export function cameraForward(yaw: number): Vec2 {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) }
}
export function cameraRight(yaw: number): Vec2 {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) }
}

/**
 * Movement delta for WASD input, in world units.
 *
 * Input convention: `fz = -1` is forward (W), `fx = +1` is strafe-right (D) —
 * the raw key axes. The result moves the player the way the camera faces, which
 * the earlier hand-inlined maths got backwards on both axes.
 */
export function walkDelta(yaw: number, fx: number, fz: number, distance: number): Vec2 {
  const len = Math.hypot(fx, fz)
  if (len === 0) return { x: 0, z: 0 }
  const nx = fx / len
  const nz = fz / len
  const fwd = cameraForward(yaw)
  const right = cameraRight(yaw)
  const forwardAmount = -nz // W (fz=-1) → move forward
  return {
    x: (right.x * nx + fwd.x * forwardAmount) * distance,
    z: (right.z * nx + fwd.z * forwardAmount) * distance,
  }
}

/** Keeps a position inside the play area regardless of collision resolution. */
export function clampToRoom(p: Vec2): Vec2 {
  const m = 0.5
  return {
    x: Math.max(-half.w + m, Math.min(p.x, half.w - m)),
    z: Math.max(-half.d + m, Math.min(p.z, half.d - m)),
  }
}
