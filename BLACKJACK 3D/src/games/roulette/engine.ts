/**
 * European single-zero roulette (37 pockets, 0-36). Pure and seedable so the
 * payout maths is testable without spinning a wheel.
 */

export type Color = 'red' | 'black' | 'green'

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
])

export function colorOf(n: number): Color {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

/** The order numbers sit around a real European wheel, for the 3D layout. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export type BetKind =
  | 'straight' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen' | 'column'

export interface Bet {
  kind: BetKind
  /** Straight: the number 0-36. Dozen/column: 1, 2 or 3. Unused otherwise. */
  value?: number
  amount: number
}

/** Winnings multiplier (to 1), i.e. profit per unit staked when the bet wins. */
export const PAYOUT: Record<BetKind, number> = {
  straight: 35,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
  dozen: 2,
  column: 2,
}

/** Whether a single bet wins against the spun number. */
export function betWins(bet: Bet, result: number): boolean {
  switch (bet.kind) {
    case 'straight':
      return bet.value === result
    case 'red':
      return colorOf(result) === 'red'
    case 'black':
      return colorOf(result) === 'black'
    case 'even':
      return result !== 0 && result % 2 === 0
    case 'odd':
      return result % 2 === 1
    case 'low':
      return result >= 1 && result <= 18
    case 'high':
      return result >= 19 && result <= 36
    case 'dozen': {
      if (result === 0) return false
      const d = Math.ceil(result / 12)
      return d === bet.value
    }
    case 'column': {
      if (result === 0) return false
      // Columns run 1/4/7…, 2/5/8…, 3/6/9…
      return ((result - 1) % 3) + 1 === bet.value
    }
  }
}

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

export function spin(seed: number): number {
  return Math.floor(mulberry32(seed)() * 37)
}

/** Net delta across all bets: winners return stake×mult, losers lose the stake. */
export function settleBets(bets: Bet[], result: number): number {
  let net = 0
  for (const b of bets) {
    net += betWins(b, result) ? b.amount * PAYOUT[b.kind] : -b.amount
  }
  return net
}

/** Total staked across all bets. */
export function totalStaked(bets: Bet[]): number {
  return bets.reduce((a, b) => a + b.amount, 0)
}

/** Long-run RTP for a bet kind, to confirm the single-zero house edge (~2.7%). */
export function rtpForKind(kind: BetKind): number {
  let ret = 0
  for (let n = 0; n <= 36; n++) {
    if (betWins({ kind, value: kind === 'straight' ? 0 : 1, amount: 1 }, n)) ret += 1 + PAYOUT[kind]
  }
  return ret / 37
}
