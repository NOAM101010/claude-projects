import { describe, it, expect } from 'vitest'
import {
  colorOf, betWins, settleBets, spin, WHEEL_ORDER, RED_NUMBERS, rtpForKind, Bet,
} from '../src/games/roulette/engine'

describe('roulette wheel', () => {
  it('has 37 pockets in the wheel order, each unique', () => {
    expect(WHEEL_ORDER).toHaveLength(37)
    expect(new Set(WHEEL_ORDER).size).toBe(37)
    expect(Math.min(...WHEEL_ORDER)).toBe(0)
    expect(Math.max(...WHEEL_ORDER)).toBe(36)
  })

  it('colours zero green and splits the rest evenly', () => {
    expect(colorOf(0)).toBe('green')
    let red = 0, black = 0
    for (let n = 1; n <= 36; n++) colorOf(n) === 'red' ? red++ : black++
    expect(red).toBe(18)
    expect(black).toBe(18)
  })

  it('matches the standard red set', () => {
    expect(RED_NUMBERS.has(1)).toBe(true)
    expect(RED_NUMBERS.has(2)).toBe(false)
    expect(colorOf(2)).toBe('black')
  })

  it('spins are seeded and in range', () => {
    expect(spin(7)).toBe(spin(7))
    for (let s = 0; s < 100; s++) {
      const n = spin(s * 101 + 1)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(36)
    }
  })
})

describe('roulette bets', () => {
  it('pays a straight number 35:1', () => {
    expect(betWins({ kind: 'straight', value: 17, amount: 10 }, 17)).toBe(true)
    expect(settleBets([{ kind: 'straight', value: 17, amount: 10 }], 17)).toBe(350)
    expect(settleBets([{ kind: 'straight', value: 17, amount: 10 }], 18)).toBe(-10)
  })

  it('even-money bets lose to zero', () => {
    for (const kind of ['red', 'black', 'even', 'odd', 'low', 'high'] as const) {
      expect(betWins({ kind, amount: 10 }, 0)).toBe(false)
    }
  })

  it('resolves colours', () => {
    expect(betWins({ kind: 'red', amount: 5 }, 1)).toBe(true)
    expect(betWins({ kind: 'black', amount: 5 }, 1)).toBe(false)
  })

  it('even excludes zero but odd never includes it', () => {
    expect(betWins({ kind: 'even', amount: 1 }, 0)).toBe(false)
    expect(betWins({ kind: 'odd', amount: 1 }, 0)).toBe(false)
    expect(betWins({ kind: 'even', amount: 1 }, 2)).toBe(true)
  })

  it('low/high split at 18/19', () => {
    expect(betWins({ kind: 'low', amount: 1 }, 18)).toBe(true)
    expect(betWins({ kind: 'low', amount: 1 }, 19)).toBe(false)
    expect(betWins({ kind: 'high', amount: 1 }, 19)).toBe(true)
  })

  it('pays dozens 2:1', () => {
    expect(betWins({ kind: 'dozen', value: 1, amount: 10 }, 5)).toBe(true)
    expect(betWins({ kind: 'dozen', value: 2, amount: 10 }, 5)).toBe(false)
    expect(betWins({ kind: 'dozen', value: 3, amount: 10 }, 30)).toBe(true)
    expect(settleBets([{ kind: 'dozen', value: 1, amount: 10 }], 5)).toBe(20)
  })

  it('pays columns 2:1 on the right column', () => {
    expect(betWins({ kind: 'column', value: 1, amount: 10 }, 1)).toBe(true)
    expect(betWins({ kind: 'column', value: 1, amount: 10 }, 4)).toBe(true)
    expect(betWins({ kind: 'column', value: 2, amount: 10 }, 2)).toBe(true)
    expect(betWins({ kind: 'column', value: 3, amount: 10 }, 3)).toBe(true)
    expect(betWins({ kind: 'column', value: 1, amount: 10 }, 2)).toBe(false)
  })

  it('settles several bets together', () => {
    const bets: Bet[] = [
      { kind: 'red', amount: 10 },
      { kind: 'straight', value: 7, amount: 5 },
      { kind: 'dozen', value: 1, amount: 20 },
    ]
    // Spin 7: red wins (+10), straight 7 wins (+175), first dozen wins (+40).
    expect(settleBets(bets, 7)).toBe(10 + 175 + 40)
  })
})

describe('roulette house edge', () => {
  it('every bet kind carries the single-zero 2.7% edge', () => {
    for (const kind of ['straight', 'red', 'even', 'low', 'dozen', 'column'] as const) {
      const rtp = rtpForKind(kind)
      expect(rtp).toBeGreaterThan(0.96)
      expect(rtp).toBeLessThan(0.98)
    }
  })
})
