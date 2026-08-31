import { describe, it, expect } from 'vitest'
import {
  spin, evaluate, symbolInfo, SYMBOLS, REEL_STRIP, theoreticalRtp, SpinResult, Symbol,
} from '../src/games/slots/engine'

const res = (a: Symbol, b: Symbol, c: Symbol): SpinResult => ({ symbols: [a, b, c], stops: [0, 0, 0] })

describe('slots reel', () => {
  it('is seeded and reproducible', () => {
    expect(spin(42).symbols).toEqual(spin(42).symbols)
  })

  it('produces valid symbols and in-range stops', () => {
    for (let s = 0; s < 50; s++) {
      const r = spin(s)
      for (const sym of r.symbols) expect(SYMBOLS.some(x => x.id === sym)).toBe(true)
      for (const stop of r.stops) {
        expect(stop).toBeGreaterThanOrEqual(0)
        expect(stop).toBeLessThan(REEL_STRIP.length)
      }
    }
  })

  it('the strip reflects the symbol weights', () => {
    for (const info of SYMBOLS) {
      const count = REEL_STRIP.filter(s => s === info.id).length
      expect(count).toBe(info.weight)
    }
  })
})

describe('slots payouts', () => {
  it('pays three-of-a-kind by symbol', () => {
    const e = evaluate(res('seven', 'seven', 'seven'), 100)
    expect(e.kind).toBe('three')
    expect(e.win).toBe(100 * symbolInfo('seven').three)
  })

  it('the diamond is the top payout', () => {
    const e = evaluate(res('diamond', 'diamond', 'diamond'), 10)
    expect(e.win).toBe(10 * symbolInfo('diamond').three)
    expect(symbolInfo('diamond').three).toBeGreaterThan(symbolInfo('seven').three)
  })

  it('rarer symbols pay more', () => {
    // Payout should rise monotonically as weight (frequency) falls.
    const ordered = [...SYMBOLS].sort((a, b) => b.weight - a.weight)
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].three).toBeGreaterThan(ordered[i - 1].three)
    }
  })

  it('pays two cherries', () => {
    const e = evaluate(res('cherry', 'cherry', 'lemon'), 100)
    expect(e.kind).toBe('two')
    expect(e.win).toBe(100)
  })

  it('does not pay two of a non-cherry symbol', () => {
    expect(evaluate(res('bell', 'bell', 'lemon'), 100).kind).toBe('none')
  })

  it('pays nothing on a total miss', () => {
    const e = evaluate(res('cherry', 'lemon', 'bell'), 100)
    expect(e).toMatchObject({ kind: 'none', win: 0 })
  })

  it('three cherries beats the two-cherry payout', () => {
    const e = evaluate(res('cherry', 'cherry', 'cherry'), 100)
    expect(e.kind).toBe('three')
    expect(e.win).toBe(100 * symbolInfo('cherry').three)
  })
})

describe('slots balance', () => {
  it('sits in a fair, real-machine RTP band with a house edge', () => {
    const rtp = theoreticalRtp(300000)
    expect(rtp).toBeGreaterThan(0.88)
    expect(rtp).toBeLessThan(0.98)
  })
})
