/**
 * A three-reel, single-payline slot. Kept pure and seeded so outcomes are
 * reproducible and the payout maths can be tested without spinning anything.
 */

export type Symbol = 'cherry' | 'lemon' | 'bell' | 'bar' | 'seven' | 'diamond'

export interface SymbolInfo {
  id: Symbol
  glyph: string
  /** Relative frequency on the reel strip. Rarer = higher payout. */
  weight: number
  /** Bet multiplier for three of this symbol on the payline. */
  three: number
  /** Bet multiplier for exactly two (0 = no two-of-a-kind payout). */
  two: number
}

// Payouts tuned for ~92% RTP (see the balance test). Real machines sit at
// 90-97%; the earlier table paid 57%, which drained players far too fast.
export const SYMBOLS: SymbolInfo[] = [
  { id: 'cherry', glyph: '🍒', weight: 28, three: 6, two: 1 },
  { id: 'lemon', glyph: '🍋', weight: 24, three: 12, two: 0 },
  { id: 'bell', glyph: '🔔', weight: 16, three: 26, two: 0 },
  { id: 'bar', glyph: '🍫', weight: 12, three: 50, two: 0 },
  { id: 'seven', glyph: '7️⃣', weight: 7, three: 130, two: 0 },
  { id: 'diamond', glyph: '💎', weight: 4, three: 450, two: 0 },
]

export const REEL_COUNT = 3

const BY_ID: Record<Symbol, SymbolInfo> = Object.fromEntries(
  SYMBOLS.map(s => [s.id, s])
) as Record<Symbol, SymbolInfo>

export function symbolInfo(id: Symbol): SymbolInfo {
  return BY_ID[id]
}

/** A weighted reel strip built once; every reel uses the same distribution. */
export const REEL_STRIP: Symbol[] = SYMBOLS.flatMap(s => Array<Symbol>(s.weight).fill(s.id))

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

export interface SpinResult {
  symbols: [Symbol, Symbol, Symbol]
  /** Index into REEL_STRIP each reel stopped at, for the 3D reel rotation. */
  stops: [number, number, number]
}

export function spin(seed: number): SpinResult {
  const rand = mulberry32(seed)
  const stops = [0, 0, 0].map(() => Math.floor(rand() * REEL_STRIP.length)) as [number, number, number]
  const symbols = stops.map(i => REEL_STRIP[i]) as [Symbol, Symbol, Symbol]
  return { symbols, stops }
}

export interface Evaluation {
  multiplier: number
  win: number
  kind: 'none' | 'two' | 'three'
  symbol: Symbol | null
}

/** Scores the payline. Three-of-a-kind first, then any two-of-a-kind payout. */
export function evaluate(result: SpinResult, bet: number): Evaluation {
  const [a, b, c] = result.symbols

  if (a === b && b === c) {
    const info = symbolInfo(a)
    return { multiplier: info.three, win: bet * info.three, kind: 'three', symbol: a }
  }

  // Two of a kind: only symbols that pay on two (the cherry), and only when a
  // matching pair is present.
  const counts = new Map<Symbol, number>()
  for (const s of result.symbols) counts.set(s, (counts.get(s) ?? 0) + 1)
  for (const [sym, n] of counts) {
    if (n >= 2) {
      const info = symbolInfo(sym)
      if (info.two > 0) return { multiplier: info.two, win: bet * info.two, kind: 'two', symbol: sym }
    }
  }

  return { multiplier: 0, win: 0, kind: 'none', symbol: null }
}

/** Long-run return-to-player, for balancing the payout table. */
export function theoreticalRtp(samples = 200000, seed = 12345): number {
  const rand = mulberry32(seed)
  let staked = 0
  let won = 0
  for (let i = 0; i < samples; i++) {
    const stops = [0, 0, 0].map(() => Math.floor(rand() * REEL_STRIP.length)) as [number, number, number]
    const symbols = stops.map(s => REEL_STRIP[s]) as [Symbol, Symbol, Symbol]
    staked += 1
    won += evaluate({ symbols, stops }, 1).win
  }
  return won / staked
}
