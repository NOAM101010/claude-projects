import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { fitModel } from '../src/scene/useFittedModel'
import { CHIP_DIAMETER, CHIP_PITCH, MODELS, TABLE_WIDTH, breakIntoChips } from '../src/scene/models'
import { rackCounts, stackPositions } from '../src/scene/tableLayout'
import { loadGlbBounds } from './glbFixture'

const PUBLIC = 'public'
const glb = (url: string) => loadGlbBounds(`${PUBLIC}${url}`)

/**
 * These lock in the asset-orientation fixes. Each assertion corresponds to a
 * concrete bug found by measuring the shipped GLBs: the table's scale being set
 * by its ring of chairs, the dealer being shrunk to a doll by a baked-in floor
 * disc, and chips standing on edge because their thickness runs along Z.
 */
describe('table', () => {
  const fitted = fitModel(glb(MODELS.table.url), MODELS.table)

  it('is fitted to a real table width, ignoring the chairs', () => {
    // The chairs span ~850 units vs the table's ~589; fitting the whole file
    // would leave the table itself far too small.
    const topOnly = new THREE.Box3()
    for (const name of ['Top', 'Table']) {
      const node = fitted.object.getObjectByName(name)
      if (node) topOnly.union(new THREE.Box3().setFromObject(node))
    }
    const width = topOnly.getSize(new THREE.Vector3()).x
    expect(width).toBeCloseTo(TABLE_WIDTH, 2)
  })

  it('has a plausible casino table height', () => {
    expect(fitted.surfaceY).toBeGreaterThan(0.7)
    expect(fitted.surfaceY).toBeLessThan(0.95)
  })

  it('rests on the floor rather than hovering', () => {
    const box = new THREE.Box3().setFromObject(fitted.object)
    expect(box.min.y).toBeCloseTo(0, 5)
  })

  it('drops the baked-in chip props that would clash with our own', () => {
    expect(fitted.object.getObjectByName('Chips')).toBeUndefined()
  })

  it('puts the player edge at +Z and the dealer edge at -Z', () => {
    // The model ships with its chairs on -Z; the spec rotates it by pi so the
    // curved player side faces the camera at +Z.
    const chairs = fitted.object.getObjectByName('Chairs')
    expect(chairs).toBeDefined()
    const chairBox = new THREE.Box3().setFromObject(chairs!)
    expect(chairBox.getCenter(new THREE.Vector3()).z).toBeGreaterThan(0)
  })
})

describe('dealer figure', () => {
  const fitted = fitModel(glb(MODELS.character.url), MODELS.character)

  it('removes the 3m floor disc bundled with the model', () => {
    expect(fitted.object.getObjectByName('floor')).toBeUndefined()
  })

  it('stands at human height', () => {
    expect(fitted.size.y).toBeCloseTo(1.75, 2)
  })

  it('is not a doll — the regression that fitting by width caused', () => {
    expect(fitted.size.y).toBeGreaterThan(1.5)
  })

  it('is person-shaped once the floor is gone', () => {
    // With the disc included the horizontal extent was ~3.1m.
    expect(Math.max(fitted.size.x, fitted.size.z)).toBeLessThan(1.2)
  })

  it('has its feet on the ground', () => {
    const box = new THREE.Box3().setFromObject(fitted.object)
    expect(box.min.y).toBeCloseTo(0, 5)
  })
})

describe('chip stacking geometry', () => {
  /**
   * Chips are procedural rather than loaded from the supplied GLBs, which are
   * 18k-36k triangles each — instancing shares their draw call but not their
   * geometry, so a hundred chips meant millions of triangles per frame.
   */
  it('stacks with no gap and no overlap', () => {
    const restY = 0.8
    const stack = stackPositions([10, 10, 10], [0, restY, 0], CHIP_PITCH)
    // Cylinder geometry is centred, so the first chip sits half a thickness up.
    expect(stack[0].position[1]).toBeCloseTo(restY + CHIP_PITCH / 2, 6)
    expect(stack[1].position[1] - stack[0].position[1]).toBeCloseTo(CHIP_PITCH, 6)
  })

  it('rests on the felt rather than floating above it', () => {
    const restY = 0.8
    const [first] = stackPositions([100], [0, restY, 0], CHIP_PITCH)
    const bottomOfChip = first.position[1] - CHIP_PITCH / 2
    expect(bottomOfChip).toBeCloseTo(restY, 6)
  })

  it('keeps a realistic thickness-to-diameter ratio', () => {
    expect(CHIP_PITCH).toBeGreaterThan(CHIP_DIAMETER * 0.07)
    expect(CHIP_PITCH).toBeLessThan(CHIP_DIAMETER * 0.16)
  })

  it('breaks an amount into the fewest chips, largest first', () => {
    expect(breakIntoChips(5620)).toEqual([5000, 500, 100, 20])
    expect(breakIntoChips(0)).toEqual([])
  })

  it('honours the chip cap so a big bankroll cannot flood the table', () => {
    expect(breakIntoChips(1_000_000, undefined, 7)).toHaveLength(7)
  })
})

describe('chip tray', () => {
  /**
   * A literal breakdown of 5,000 is a single 5,000 chip, which reads as an
   * empty tray. The tray is stocked by what you could bet instead.
   */
  it('is well stocked at the starting bankroll', () => {
    const counts = rackCounts(5000)
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(15)
  })

  it('shows the low denominations most', () => {
    const counts = rackCounts(5000)
    expect(counts.get(10)!).toBeGreaterThan(counts.get(500)!)
  })

  it('empties out as the bankroll drains', () => {
    const rich = [...rackCounts(5000).values()].reduce((a, b) => a + b, 0)
    const poor = [...rackCounts(150).values()].reduce((a, b) => a + b, 0)
    expect(poor).toBeLessThan(rich)
    expect(poor).toBeGreaterThan(0)
  })

  it('hides denominations you cannot afford', () => {
    const counts = rackCounts(150)
    expect(counts.get(5000)).toBe(0)
    expect(counts.get(500)).toBe(0)
    expect(counts.get(100)).toBe(1)
  })

  it('shows nothing when broke', () => {
    expect([...rackCounts(0).values()].reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('never exceeds the column height the tray can hold', () => {
    for (const n of rackCounts(10_000_000).values()) expect(n).toBeLessThanOrEqual(9)
  })
})
