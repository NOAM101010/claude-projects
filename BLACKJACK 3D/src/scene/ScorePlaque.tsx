import { Billboard } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

export type PlaqueTone = 'idle' | 'active' | 'bust' | 'blackjack' | 'dealer'

interface Palette {
  fill: string
  stroke: string
  text: string
  glow: string
}

const TONE: Record<PlaqueTone, Palette> = {
  idle: { fill: 'rgba(10,12,16,0.82)', stroke: 'rgba(212,175,55,0.45)', text: '#efe9dc', glow: 'rgba(0,0,0,0)' },
  dealer: { fill: 'rgba(10,12,16,0.86)', stroke: 'rgba(226,232,240,0.4)', text: '#f4f6fa', glow: 'rgba(0,0,0,0)' },
  active: { fill: 'rgba(28,22,8,0.88)', stroke: 'rgba(212,175,55,0.95)', text: '#ffd964', glow: 'rgba(212,175,55,0.5)' },
  bust: { fill: 'rgba(38,10,12,0.88)', stroke: 'rgba(239,68,68,0.75)', text: '#ff9b9b', glow: 'rgba(239,68,68,0.35)' },
  blackjack: { fill: 'rgba(30,25,6,0.92)', stroke: 'rgba(255,215,100,1)', text: '#ffdf7e', glow: 'rgba(255,200,60,0.6)' },
}

const cache = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>()

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/**
 * Draws the plaque to a cached canvas texture.
 *
 * Using drei's <Text> here meant troika regenerating SDF glyphs every time a
 * total changed — on every card dealt, for every hand. Canvas textures are
 * generated once per distinct label and cost nothing to re-render.
 */
function plaque(label: string, tone: PlaqueTone) {
  const key = `${label}|${tone}`
  const hit = cache.get(key)
  if (hit) return hit

  const p = TONE[tone]
  const H = 128
  const pad = 34
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `600 ${Math.round(H * 0.52)}px Georgia, 'Times New Roman', serif`
  const textW = measure.measureText(label).width
  const W = Math.ceil(Math.max(textW + pad * 2, H * 1.5))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!

  const inset = 6
  const r = (H - inset * 2) / 2

  if (p.glow !== 'rgba(0,0,0,0)') {
    g.shadowColor = p.glow
    g.shadowBlur = 26
  }
  g.fillStyle = p.fill
  roundRect(g, inset, inset, W - inset * 2, H - inset * 2, r)
  g.fill()
  g.shadowBlur = 0

  g.strokeStyle = p.stroke
  g.lineWidth = 2.5
  roundRect(g, inset, inset, W - inset * 2, H - inset * 2, r)
  g.stroke()

  // Inner hairline for the engraved look.
  g.strokeStyle = 'rgba(255,255,255,0.09)'
  g.lineWidth = 1
  roundRect(g, inset + 5, inset + 5, W - (inset + 5) * 2, H - (inset + 5) * 2, r - 5)
  g.stroke()

  g.fillStyle = p.text
  g.font = `600 ${Math.round(H * 0.52)}px Georgia, 'Times New Roman', serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, W / 2, H / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const entry = { texture, aspect: W / H }
  cache.set(key, entry)
  return entry
}

interface Props {
  label: string
  position: [number, number, number]
  tone?: PlaqueTone
  /** World height of the plaque. */
  height?: number
}

/**
 * A hand total on an engraved plate that always faces the camera. Flat text on
 * the felt is unreadable from a seated first-person view.
 */
export default function ScorePlaque({ label, position, tone = 'idle', height = 0.05 }: Props) {
  const entry = useMemo(() => (label ? plaque(label, tone) : null), [label, tone])
  if (!entry) return null

  return (
    <Billboard position={position} follow>
      <mesh renderOrder={10}>
        <planeGeometry args={[height * entry.aspect, height]} />
        <meshBasicMaterial
          map={entry.texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}
