import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { MODELS, type ModelSpec } from '../src/scene/models'

/**
 * The dealer is placed at -Z and is expected to look toward the seated player
 * at +Z with no corrective rotation. That only holds because this particular
 * model is authored facing +Z — swap the asset and the dealer silently turns
 * his back on the table, which is exactly the kind of thing nobody notices
 * until it ships.
 */
function facialFeatureZ(path: string) {
  const data = readFileSync(path)
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  const dv = new DataView(buf)
  let off = 12
  let g: any = null
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true)
    if (dv.getUint32(off + 4, true) === 0x4e4f534a) {
      g = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)))
      break
    }
    off += 8 + len
  }

  const local = (n: any) => {
    const m = new THREE.Matrix4()
    if (n.matrix) return m.fromArray(n.matrix)
    return m.compose(
      new THREE.Vector3().fromArray(n.translation ?? [0, 0, 0]),
      new THREE.Quaternion().fromArray(n.rotation ?? [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(n.scale ?? [1, 1, 1])
    )
  }

  const boxes = new Map<string, THREE.Box3>()
  const visit = (i: number, parent: THREE.Matrix4) => {
    const n = g.nodes[i]
    const world = new THREE.Matrix4().multiplyMatrices(parent, local(n))
    if (n.mesh !== undefined) {
      for (const p of g.meshes[n.mesh].primitives) {
        const a = g.accessors[p.attributes.POSITION]
        if (!a?.min) continue
        const name = g.materials?.[p.material]?.name ?? `mat${p.material}`
        const box = boxes.get(name) ?? new THREE.Box3()
        for (let c = 0; c < 8; c++) {
          box.expandByPoint(
            new THREE.Vector3(
              c & 1 ? a.max[0] : a.min[0],
              c & 2 ? a.max[1] : a.min[1],
              c & 4 ? a.max[2] : a.min[2]
            ).applyMatrix4(world)
          )
        }
        boxes.set(name, box)
      }
    }
    for (const c of n.children ?? []) visit(c, world)
  }
  visit(g.scenes[g.scene ?? 0].nodes[0], new THREE.Matrix4())

  const centreZ = (name: string) => boxes.get(name)?.getCenter(new THREE.Vector3()).z
  return { lips: centreZ('lips'), eyes: centreZ('eye_mat3'), buttons: centreZ('button') }
}

describe('dealer orientation', () => {
  const z = facialFeatureZ(MODELS.character.url.replace(/^\//, 'public/'))

  it('faces +Z, so no corrective rotation is needed', () => {
    expect(z.lips).toBeGreaterThan(0)
    expect(z.eyes).toBeGreaterThan(0)
    expect(z.buttons).toBeGreaterThan(0)
  })

  it('is placed without a yaw that would turn him away', () => {
    const spec: ModelSpec = MODELS.character
    expect(spec.rotation).toBeUndefined()
  })
})
