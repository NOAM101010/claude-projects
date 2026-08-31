import * as THREE from 'three'
import { CHIP_DIAMETER, CHIP_PITCH, CHIP_COLORS, ChipValue } from './models'

/**
 * Procedural casino chips.
 *
 * The supplied chip GLBs are 18k-36k triangles each. Instancing shares their
 * draw call but not their geometry, so a table showing ~100 chips was pushing
 * well over two million triangles every frame — the main cause of the stutter.
 * A real chip is a short cylinder; 32 radial segments is 128 triangles and is
 * visually indistinguishable at table scale, while giving us full control over
 * the printed face.
 */

const RADIAL_SEGMENTS = 32

let geometry: THREE.CylinderGeometry | null = null

/** Shared body geometry — groups are [side, top cap, bottom cap]. */
export function chipGeometry(): THREE.CylinderGeometry {
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(
      CHIP_DIAMETER / 2,
      CHIP_DIAMETER / 2,
      CHIP_PITCH,
      RADIAL_SEGMENTS,
      1,
      false
    )
  }
  return geometry
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1))
  return `#${c.getHexString()}`
}

function label(value: number): string {
  return value >= 1000 ? `${value / 1000}K` : String(value)
}

const faceCache = new Map<number, THREE.CanvasTexture>()

/** Printed chip face: colour ring, cream centre, denomination. */
function faceTexture(value: ChipValue): THREE.CanvasTexture {
  const hit = faceCache.get(value)
  if (hit) return hit

  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const g = canvas.getContext('2d')!
  const base = CHIP_COLORS[value]
  const mid = S / 2

  g.fillStyle = base
  g.beginPath()
  g.arc(mid, mid, mid, 0, Math.PI * 2)
  g.fill()

  // Edge spots, the classic dashed ring.
  g.fillStyle = 'rgba(255,255,255,0.92)'
  const spots = 8
  for (let i = 0; i < spots; i++) {
    const a = (i / spots) * Math.PI * 2
    g.save()
    g.translate(mid + Math.cos(a) * mid * 0.83, mid + Math.sin(a) * mid * 0.83)
    g.rotate(a)
    g.fillRect(-mid * 0.105, -mid * 0.052, mid * 0.21, mid * 0.104)
    g.restore()
  }

  // Inlay
  g.fillStyle = shade(base, -0.1)
  g.beginPath()
  g.arc(mid, mid, mid * 0.7, 0, Math.PI * 2)
  g.fill()

  g.fillStyle = '#f6f1e0'
  g.beginPath()
  g.arc(mid, mid, mid * 0.62, 0, Math.PI * 2)
  g.fill()

  g.strokeStyle = shade(base, -0.18)
  g.lineWidth = S * 0.012
  g.beginPath()
  g.arc(mid, mid, mid * 0.53, 0, Math.PI * 2)
  g.stroke()

  g.fillStyle = shade(base, -0.28)
  g.font = `bold ${Math.round(S * (label(value).length > 3 ? 0.24 : 0.3))}px Georgia, serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label(value), mid, mid + S * 0.012)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  faceCache.set(value, tex)
  return tex
}

const edgeCache = new Map<number, THREE.CanvasTexture>()

/** Striped rim so stacks read as separate chips from the side. */
function edgeTexture(value: ChipValue): THREE.CanvasTexture {
  const hit = edgeCache.get(value)
  if (hit) return hit

  const W = 256
  const H = 16
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  const base = CHIP_COLORS[value]

  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  const stripes = 12
  for (let i = 0; i < stripes; i++) {
    const x = (i / stripes) * W
    g.fillRect(x, 0, W / stripes / 2.4, H)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  edgeCache.set(value, tex)
  return tex
}

const materialCache = new Map<number, THREE.Material[]>()

/** Materials ordered to match the cylinder's groups: side, top, bottom. */
export function chipMaterials(value: ChipValue): THREE.Material[] {
  const hit = materialCache.get(value)
  if (hit) return hit

  const face = faceTexture(value)
  const mats = [
    new THREE.MeshStandardMaterial({ map: edgeTexture(value), roughness: 0.62, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ map: face, roughness: 0.5, metalness: 0.03 }),
    new THREE.MeshStandardMaterial({ map: face, roughness: 0.5, metalness: 0.03 }),
  ]
  materialCache.set(value, mats)
  return mats
}

/**
 * Drops all cached chip textures/materials so the next render rebuilds them from
 * the current CHIP_COLORS — used when a chip skin changes the palette.
 */
export function clearChipMaterialCache() {
  faceCache.clear()
  edgeCache.clear()
  materialCache.clear()
}
