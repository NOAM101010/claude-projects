import { readFileSync } from 'node:fs'
import * as THREE from 'three'

/**
 * Builds a THREE hierarchy from a .glb's JSON chunk, preserving node names and
 * transforms and standing in each mesh with a box matching its POSITION
 * accessor bounds.
 *
 * fitModel only ever consults bounding boxes and node names, so this is a
 * faithful stand-in for a real GLTFLoader parse — and it runs in plain Node,
 * with no DOM, no image decoding, and no renderer.
 */
export function loadGlbBounds(path: string): THREE.Group {
  const data = readFileSync(path)
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  const dv = new DataView(buf)

  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error(`not a glb: ${path}`)

  let offset = 12
  let json: any = null
  while (offset < buf.byteLength) {
    const len = dv.getUint32(offset, true)
    const type = dv.getUint32(offset + 4, true)
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, offset + 8, len)))
      break
    }
    offset += 8 + len
  }
  if (!json) throw new Error(`no JSON chunk: ${path}`)

  const build = (index: number): THREE.Object3D => {
    const node = json.nodes[index]
    const obj = new THREE.Group()
    obj.name = node.name ?? ''

    if (node.matrix) {
      const m = new THREE.Matrix4().fromArray(node.matrix)
      m.decompose(obj.position, obj.quaternion, obj.scale)
    } else {
      if (node.translation) obj.position.fromArray(node.translation)
      if (node.rotation) obj.quaternion.fromArray(node.rotation)
      if (node.scale) obj.scale.fromArray(node.scale)
    }

    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        const accessor = json.accessors[prim.attributes.POSITION]
        if (!accessor?.min) continue
        const [minX, minY, minZ] = accessor.min
        const [maxX, maxY, maxZ] = accessor.max
        const geometry = new THREE.BoxGeometry(
          Math.max(maxX - minX, 1e-9),
          Math.max(maxY - minY, 1e-9),
          Math.max(maxZ - minZ, 1e-9)
        )
        geometry.translate((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
        obj.add(new THREE.Mesh(geometry))
      }
    }

    for (const child of node.children ?? []) obj.add(build(child))
    return obj
  }

  const root = new THREE.Group()
  for (const index of json.scenes[json.scene ?? 0].nodes) root.add(build(index))
  root.updateMatrixWorld(true)
  return root
}

export function sizeOf(object: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
}
