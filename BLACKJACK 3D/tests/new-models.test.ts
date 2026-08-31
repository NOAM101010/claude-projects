import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { loadGlbBounds } from './glbFixture'
import { fitModel } from '../src/scene/useFittedModel'
import { NEW_MODELS } from '../src/lobby/casinoModels'

/**
 * The user-supplied furniture GLBs are integrated blind (WebGL can't be
 * composited in this environment), so verify their fit against the REAL files:
 * each must scale to its target size on the fit axis, sit on the floor (anchor
 * base → min.y ≈ 0), stay upright (footprint present, not paper-thin), and keep
 * a reasonable overall size.
 */
const CASES: { key: keyof typeof NEW_MODELS; path: string; maxHeight: number }[] = [
  { key: 'blackjackTable', path: 'public/models/new/blackjack_table_v2.glb', maxHeight: 2 },
  { key: 'slotMachine', path: 'public/models/new/slot_machine_v2.glb', maxHeight: 3 },
  { key: 'rouletteTable', path: 'public/models/new/roulette_table_v2.glb', maxHeight: 2.5 },
]

describe('new furniture models fit cleanly', () => {
  for (const { key, path, maxHeight } of CASES) {
    it(`${key} scales, sits on the floor and stays upright`, () => {
      const spec = NEW_MODELS[key]
      const fitted = fitModel(loadGlbBounds(path), spec)
      const box = new THREE.Box3().setFromObject(fitted.object)
      const size = box.getSize(new THREE.Vector3())

      // Fit axis matches the requested size (within a small tolerance).
      const axis = spec.fit.by === 'height' ? size.y : spec.fit.by === 'depth' ? size.z : size.x
      expect(axis).toBeCloseTo(spec.fit.size, 1)

      // Sits on the floor (anchor: base).
      expect(box.min.y).toBeCloseTo(0, 2)

      // Reasonable, non-degenerate proportions.
      expect(size.y).toBeGreaterThan(0.2)
      expect(size.y).toBeLessThan(maxHeight)
      expect(Math.min(size.x, size.z)).toBeGreaterThan(0.2)
    })
  }
})
