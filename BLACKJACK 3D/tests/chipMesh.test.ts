import { describe, it, expect } from 'vitest'
import { chipGeometry } from '../src/scene/chipMesh'
import { CHIP_DIAMETER, CHIP_PITCH } from '../src/scene/models'

describe('chip geometry', () => {
  const geometry = chipGeometry()

  /**
   * ChipField and ChipFlights render the cylinder with a three-material array
   * (side, top cap, bottom cap). If the geometry's group count ever stops
   * matching, faces silently render with the wrong material.
   */
  it('has exactly three groups for the three-material array', () => {
    expect(geometry.groups).toHaveLength(3)
  })

  it('groups are ordered side, top, bottom', () => {
    const [side, top, bottom] = geometry.groups
    expect(side.materialIndex).toBe(0)
    expect(top.materialIndex).toBe(1)
    expect(bottom.materialIndex).toBe(2)
  })

  it('is the agreed physical size', () => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    expect(box.max.x - box.min.x).toBeCloseTo(CHIP_DIAMETER, 6)
    expect(box.max.y - box.min.y).toBeCloseTo(CHIP_PITCH, 6)
  })

  it('is centred, so a stack position is the chip centre', () => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    expect(box.min.y).toBeCloseTo(-CHIP_PITCH / 2, 6)
    expect(box.max.y).toBeCloseTo(CHIP_PITCH / 2, 6)
  })

  it('stays within the triangle budget that fixed the stutter', () => {
    // The supplied GLB chips were 18k-36k triangles each.
    const tris = geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3
    expect(tris).toBeLessThan(400)
  })

  it('is shared, not rebuilt per chip', () => {
    expect(chipGeometry()).toBe(geometry)
  })
})
