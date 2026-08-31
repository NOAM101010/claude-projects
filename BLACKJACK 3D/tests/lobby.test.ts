import { describe, it, expect } from 'vitest'
import {
  moveWithCollision, stationInRange, clampToRoom, wallColliders, allColliders,
  walkDelta, cameraForward, cameraRight,
  STATIONS, SPAWN, ROOM, INTERACT_RADIUS, Box2,
} from '../src/lobby/lobbyLayout'

describe('walking direction', () => {
  const D = 1 // one unit of travel

  // Facing -Z (yaw 0): the spawn orientation, looking toward the tables.
  it('W walks forward in the facing direction', () => {
    const d = walkDelta(0, 0, -1, D)
    expect(d.x).toBeCloseTo(0, 6)
    expect(d.z).toBeCloseTo(-1, 6) // toward -Z
  })

  it('S walks backward', () => {
    const d = walkDelta(0, 0, 1, D)
    expect(d.z).toBeCloseTo(1, 6) // toward +Z
  })

  it('D strafes to the right of the facing', () => {
    const d = walkDelta(0, 1, 0, D)
    expect(d.x).toBeCloseTo(1, 6) // +X is right when facing -Z
    expect(d.z).toBeCloseTo(0, 6)
  })

  it('A strafes to the left', () => {
    const d = walkDelta(0, -1, 0, D)
    expect(d.x).toBeCloseTo(-1, 6)
  })

  it('forward follows the camera after a 90° turn', () => {
    // Yaw +90°: cameraForward points toward -X.
    const f = cameraForward(Math.PI / 2)
    expect(f.x).toBeCloseTo(-1, 6)
    expect(f.z).toBeCloseTo(0, 6)
    const d = walkDelta(Math.PI / 2, 0, -1, D)
    expect(d.x).toBeCloseTo(-1, 6)
    expect(d.z).toBeCloseTo(0, 6)
  })

  it('right is always 90° clockwise from forward', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, -1.2, 2.5]) {
      const f = cameraForward(yaw)
      const r = cameraRight(yaw)
      // Perpendicular: dot product ~0.
      expect(f.x * r.x + f.z * r.z).toBeCloseTo(0, 6)
      // Both unit length.
      expect(Math.hypot(f.x, f.z)).toBeCloseTo(1, 6)
      expect(Math.hypot(r.x, r.z)).toBeCloseTo(1, 6)
    }
  })

  it('diagonal movement is normalised, not faster', () => {
    const d = walkDelta(0, 1, -1, D)
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 6)
  })

  it('no keys means no movement', () => {
    expect(walkDelta(0, 0, 0, D)).toEqual({ x: 0, z: 0 })
  })
})

describe('lobby movement', () => {
  const walls = wallColliders()

  it('moves freely in open space', () => {
    const p = moveWithCollision({ x: 0, z: 0 }, { x: 0.2, z: 0.1 }, walls)
    expect(p).toEqual({ x: 0.2, z: 0.1 })
  })

  it('stops at a wall instead of passing through', () => {
    const nearFar = { x: 0, z: -ROOM.d / 2 + 0.5 }
    const p = moveWithCollision(nearFar, { x: 0, z: -2 }, walls)
    // Blocked on Z, so it should not cross the wall plane.
    expect(p.z).toBeGreaterThan(-ROOM.d / 2)
  })

  it('slides along a wall, keeping the tangential component', () => {
    const nearFar = { x: 0, z: -ROOM.d / 2 + 0.5 }
    // Push diagonally into the far wall: Z is blocked, X should still move.
    const p = moveWithCollision(nearFar, { x: 0.5, z: -2 }, walls)
    expect(p.x).toBeCloseTo(0.5, 5)
    expect(p.z).toBeGreaterThan(-ROOM.d / 2)
  })

  it('cannot walk through a station', () => {
    const bj = STATIONS[0]
    const front = { x: bj.position.x, z: bj.position.z + bj.half.z + 0.2 }
    const p = moveWithCollision(front, { x: 0, z: -1 }, allColliders())
    // Should be stopped short of the station body.
    expect(p.z).toBeGreaterThan(bj.position.z + bj.half.z - 0.3)
  })

  it('never escapes the room even with a huge delta', () => {
    const p = moveWithCollision({ x: 0, z: 0 }, { x: 999, z: 999 }, allColliders())
    const clamped = clampToRoom(p)
    expect(Math.abs(clamped.x)).toBeLessThanOrEqual(ROOM.w / 2)
    expect(Math.abs(clamped.z)).toBeLessThanOrEqual(ROOM.d / 2)
  })
})

describe('station interaction', () => {
  it('spawn is not standing inside any station', () => {
    expect(stationInRange(SPAWN)).toBeNull()
  })

  it('detects a station when standing on its approach spot', () => {
    for (const s of STATIONS) {
      expect(stationInRange(s.approach)?.id).toBe(s.id)
    }
  })

  it('detects nothing from the middle of the room', () => {
    expect(stationInRange({ x: 0, z: 0 })).toBeNull()
  })

  it('picks the nearest station when two are close', () => {
    const s = STATIONS[0]
    const justInside = { x: s.approach.x + INTERACT_RADIUS - 0.3, z: s.approach.z }
    expect(stationInRange(justInside)?.id).toBe(s.id)
  })

  it('approach spots are actually within interaction range of their prop', () => {
    for (const s of STATIONS) {
      const dx = s.approach.x - s.position.x
      const dz = s.approach.z - s.position.z
      expect(Math.hypot(dx, dz)).toBeLessThan(INTERACT_RADIUS + 1)
    }
  })
})

describe('lobby layout sanity', () => {
  it('keeps every station inside the room', () => {
    for (const s of STATIONS) {
      expect(Math.abs(s.position.x) + s.half.x).toBeLessThan(ROOM.w / 2)
      expect(Math.abs(s.position.z) + s.half.z).toBeLessThan(ROOM.d / 2)
    }
  })

  it('no two station footprints overlap', () => {
    const boxes: Box2[] = STATIONS.map(s => ({
      minX: s.position.x - s.half.x, maxX: s.position.x + s.half.x,
      minZ: s.position.z - s.half.z, maxZ: s.position.z + s.half.z,
    }))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        const overlap = a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
        expect(overlap).toBe(false)
      }
    }
  })
})
