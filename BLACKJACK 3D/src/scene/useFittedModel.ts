import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ModelSpec } from './models'

export interface FittedModel {
  object: THREE.Group
  /** Size in world units after fitting. */
  size: THREE.Vector3
  /** World Y of the surfaceNode's top face, or the model's top if unspecified. */
  surfaceY: number
  scale: number
}

function boxOf(root: THREE.Object3D, names?: string[]): THREE.Box3 {
  if (!names || names.length === 0) return new THREE.Box3().setFromObject(root)
  const box = new THREE.Box3()
  let found = false
  for (const name of names) {
    const node = root.getObjectByName(name)
    if (node) {
      box.union(new THREE.Box3().setFromObject(node))
      found = true
    }
  }
  return found ? box : new THREE.Box3().setFromObject(root)
}

/**
 * Places a loaded model in world space according to its spec: strip baked-in
 * props, correct the up-axis, then measure and scale.
 *
 * Measuring happens AFTER the rotation is applied and, when fitNodes is given,
 * over only the nodes that matter. Both details are load-bearing: measuring a
 * model before its rotation makes the fit axis mean the wrong thing, and
 * measuring the whole file lets stray props (a ground disc, a ring of chairs)
 * dictate the scale of the thing you actually care about.
 *
 * Pure so it can be tested against the real assets without a renderer.
 */
export function fitModel(source: THREE.Object3D, spec: ModelSpec): FittedModel {
  const model = source.clone(true)

  for (const name of spec.hide ?? []) {
    const node = model.getObjectByName(name)
    node?.parent?.remove(node)
  }

  const casts = spec.castShadow !== false
  model.traverse(o => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = casts
      mesh.receiveShadow = true
    }
  })

  // Rotation wrapper so the fit measurement sees the corrected orientation.
  const oriented = new THREE.Group()
  if (spec.rotation) oriented.rotation.set(...spec.rotation)
  oriented.add(model)
  oriented.updateMatrixWorld(true)

  const fitBox = boxOf(oriented, spec.fitNodes)
  const fitSize = fitBox.getSize(new THREE.Vector3())

  const extent =
    spec.fit.by === 'height' ? fitSize.y
      : spec.fit.by === 'depth' ? fitSize.z
      : spec.fit.by === 'diameter' ? Math.max(fitSize.x, fitSize.z)
      : fitSize.x
  const scale = extent > 0 ? spec.fit.size / extent : 1

  const outer = new THREE.Group()
  outer.add(oriented)
  outer.scale.setScalar(scale)
  outer.updateMatrixWorld(true)

  // Re-measure the whole model so nothing sinks below the floor.
  const fullBox = new THREE.Box3().setFromObject(outer)
  const center = fullBox.getCenter(new THREE.Vector3())
  const offsetY = spec.anchor === 'center' ? -center.y : -fullBox.min.y
  oriented.position.set(-center.x / scale, offsetY / scale, -center.z / scale)
  outer.updateMatrixWorld(true)

  const finalBox = new THREE.Box3().setFromObject(outer)
  const surfaceBox = spec.surfaceNode ? boxOf(outer, [spec.surfaceNode]) : finalBox

  return {
    object: outer,
    size: finalBox.getSize(new THREE.Vector3()),
    surfaceY: surfaceBox.max.y,
    scale,
  }
}

export function useFittedModel(spec: ModelSpec): FittedModel {
  const { scene } = useGLTF(spec.url)
  return useMemo(
    () => fitModel(scene, spec),
    [scene, spec.url, spec.fit.by, spec.fit.size, spec.anchor, spec.surfaceNode]
  )
}

export function preloadModel(spec: ModelSpec) {
  useGLTF.preload(spec.url)
}
