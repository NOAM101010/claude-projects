import * as THREE from 'three'
import { Rank, Suit } from '../engine/types'

const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const SUIT_COLOR: Record<Suit, string> = { S: '#141414', H: '#c1121f', D: '#c1121f', C: '#141414' }

const cache = new Map<string, THREE.CanvasTexture>()

export function cardFaceTexture(rank: Rank, suit: Suit): THREE.CanvasTexture {
  const key = `${rank}${suit}`
  const hit = cache.get(key)
  if (hit) return hit

  const W = 512
  const H = 716
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  g.fillStyle = '#fdfdf8'
  roundRect(g, 0, 0, W, H, 48)
  g.fill()
  g.strokeStyle = '#d8d4c4'
  g.lineWidth = 6
  roundRect(g, 3, 3, W - 6, H - 6, 46)
  g.stroke()

  const color = SUIT_COLOR[suit]
  const glyph = SUIT_GLYPH[suit]
  g.fillStyle = color

  g.font = 'bold 118px Georgia, serif'
  g.textAlign = 'center'
  g.textBaseline = 'top'
  g.fillText(rank, 76, 34)
  g.font = '92px Georgia, serif'
  g.fillText(glyph, 76, 152)

  g.save()
  g.translate(W, H)
  g.rotate(Math.PI)
  g.font = 'bold 118px Georgia, serif'
  g.fillText(rank, 76, 34)
  g.font = '92px Georgia, serif'
  g.fillText(glyph, 76, 152)
  g.restore()

  g.font = '260px Georgia, serif'
  g.textBaseline = 'middle'
  g.fillText(glyph, W / 2, H / 2)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}

/** Visual palette of a card back — chosen by the equipped card-back skin. */
export interface CardBackPalette {
  base: string
  accent: string
  pattern: 'diagonal' | 'grid' | 'rays'
}

const DEFAULT_BACK: CardBackPalette = { base: '#8b1220', accent: '#d4af37', pattern: 'diagonal' }
let currentBack: CardBackPalette = DEFAULT_BACK
const backCache = new Map<string, THREE.CanvasTexture>()

/** Swap the active card-back palette (equip). New texture builds lazily. */
export function setCardBack(p: CardBackPalette) {
  currentBack = p
}

function backKey(p: CardBackPalette): string {
  return `${p.base}|${p.accent}|${p.pattern}`
}

export function cardBackTexture(): THREE.CanvasTexture {
  const key = backKey(currentBack)
  const hit = backCache.get(key)
  if (hit) return hit

  const p = currentBack
  const W = 512
  const H = 716
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  g.fillStyle = p.base
  roundRect(g, 0, 0, W, H, 48)
  g.fill()
  g.fillStyle = '#fdfdf8'
  roundRect(g, 22, 22, W - 44, H - 44, 34)
  g.fill()
  g.fillStyle = p.base
  roundRect(g, 34, 34, W - 68, H - 68, 26)
  g.fill()

  g.save()
  g.beginPath()
  roundRect(g, 34, 34, W - 68, H - 68, 26)
  g.clip()
  g.strokeStyle = 'rgba(255,255,255,0.22)'
  g.lineWidth = 3
  if (p.pattern === 'grid') {
    for (let x = 34; x < W - 34; x += 30) { g.beginPath(); g.moveTo(x, 34); g.lineTo(x, H - 34); g.stroke() }
    for (let y = 34; y < H - 34; y += 30) { g.beginPath(); g.moveTo(34, y); g.lineTo(W - 34, y); g.stroke() }
  } else if (p.pattern === 'rays') {
    g.strokeStyle = 'rgba(255,255,255,0.16)'
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(W / 2 + Math.cos(a) * H, H / 2 + Math.sin(a) * H); g.stroke()
    }
  } else {
    for (let i = -H; i < W + H; i += 26) {
      g.beginPath(); g.moveTo(i, 34); g.lineTo(i + H, H - 34); g.stroke()
      g.beginPath(); g.moveTo(i, H - 34); g.lineTo(i + H, 34); g.stroke()
    }
  }
  g.restore()

  g.fillStyle = p.accent
  g.font = 'bold 74px Georgia, serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('BJ', W / 2, H / 2)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  backCache.set(key, tex)
  return tex
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
