/**
 * Scratch card: a 3×3 grid of prize symbols. If any prize multiplier appears
 * three or more times, the card wins the best such prize (ticket × multiplier).
 * Pure and seeded so payouts are testable and reproducible.
 */

export interface Prize {
  /** Payout as a multiple of the ticket price (0 = blank). */
  mult: number
  glyph: string
  /** Relative frequency on the card. */
  weight: number
}

export const CELLS = 9

// Weighted so blanks dominate and big multipliers are rare — tuned to ~88% RTP
// (see the balance test).
export const PRIZES: Prize[] = [
  { mult: 0, glyph: '❌', weight: 50 },
  { mult: 1, glyph: '🍒', weight: 18 },
  { mult: 3, glyph: '🔔', weight: 12 },
  { mult: 7, glyph: '⭐', weight: 7 },
  { mult: 15, glyph: '💰', weight: 4 },
  { mult: 40, glyph: '💎', weight: 2 },
  { mult: 150, glyph: '👑', weight: 1 },
]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STRIP: Prize[] = PRIZES.flatMap(p => Array<Prize>(p.weight).fill(p))

function pick(rand: () => number): Prize {
  return STRIP[Math.floor(rand() * STRIP.length)]
}

export interface Card {
  cells: Prize[]
}

export function generateCard(seed: number): Card {
  const rand = mulberry32(seed)
  return { cells: Array.from({ length: CELLS }, () => pick(rand)) }
}

export interface ScratchResult {
  /** Winning multiplier (0 if none), and which glyph won. */
  mult: number
  glyph: string | null
  /** Indices of the winning cells (for highlighting). */
  winningCells: number[]
}

/** Best prize whose glyph appears ≥3 times. */
export function evaluateCard(card: Card): ScratchResult {
  const byGlyph = new Map<string, { mult: number; idx: number[] }>()
  card.cells.forEach((p, i) => {
    if (p.mult === 0) return
    const e = byGlyph.get(p.glyph) ?? { mult: p.mult, idx: [] }
    e.idx.push(i)
    byGlyph.set(p.glyph, e)
  })

  let best: ScratchResult = { mult: 0, glyph: null, winningCells: [] }
  for (const [glyph, e] of byGlyph) {
    if (e.idx.length >= 3 && e.mult > best.mult) {
      best = { mult: e.mult, glyph, winningCells: e.idx.slice(0, e.idx.length) }
    }
  }
  return best
}

export function winForTicket(card: Card, ticket: number): number {
  return Math.round(ticket * evaluateCard(card).mult)
}

/** Long-run RTP, for balancing. */
export function theoreticalRtp(samples = 300000, seed = 999): number {
  const rand = mulberry32(seed)
  let staked = 0
  let won = 0
  for (let i = 0; i < samples; i++) {
    const cells = Array.from({ length: CELLS }, () => pick(rand))
    staked += 1
    won += evaluateCard({ cells }).mult
  }
  return won / staked
}
