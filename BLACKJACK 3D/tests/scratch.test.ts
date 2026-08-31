import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size },
}

import {
  generateCard, evaluateCard, winForTicket, theoreticalRtp, PRIZES, CELLS, Card,
} from '../src/games/scratch/engine'
import { useScratch } from '../src/games/scratch/useScratch'
import { useWallet } from '../src/state/useWallet'
import { useProgress, ACHIEVEMENTS } from '../src/progression/useProgress'
import { xpForLevel } from '../src/progression/levels'

const prize = (glyph: string) => PRIZES.find(p => p.glyph === glyph)!
function cardOf(glyphs: string[]): Card {
  return { cells: glyphs.map(g => prize(g)) }
}

describe('scratch engine', () => {
  it('cards are seeded and reproducible', () => {
    expect(generateCard(7).cells.map(c => c.glyph)).toEqual(generateCard(7).cells.map(c => c.glyph))
  })

  it('has 9 cells', () => {
    expect(generateCard(1).cells).toHaveLength(CELLS)
  })

  it('pays when a prize glyph appears three times', () => {
    const card = cardOf(['🍒', '🍒', '🍒', '❌', '❌', '❌', '❌', '❌', '❌'])
    const r = evaluateCard(card)
    expect(r.glyph).toBe('🍒')
    expect(r.mult).toBe(prize('🍒').mult)
    expect(winForTicket(card, 100)).toBe(100 * prize('🍒').mult)
  })

  it('pays nothing with only two matching', () => {
    const card = cardOf(['🍒', '🍒', '⭐', '❌', '❌', '❌', '❌', '❌', '❌'])
    expect(evaluateCard(card).mult).toBe(0)
    expect(winForTicket(card, 100)).toBe(0)
  })

  it('pays the best prize when several qualify', () => {
    const card = cardOf(['🍒', '🍒', '🍒', '💎', '💎', '💎', '❌', '❌', '❌'])
    expect(evaluateCard(card).glyph).toBe('💎')
    expect(evaluateCard(card).mult).toBe(prize('💎').mult)
  })

  it('blanks never pay even with three', () => {
    const card = cardOf(['❌', '❌', '❌', '❌', '❌', '❌', '❌', '❌', '❌'])
    expect(evaluateCard(card).mult).toBe(0)
  })

  it('has a fair RTP band with a house edge', () => {
    const rtp = theoreticalRtp(200000)
    expect(rtp).toBeGreaterThan(0.7)
    expect(rtp).toBeLessThan(0.95)
  })
})

describe('scratch settlement', () => {
  function neutralize() {
    useProgress.setState({
      xp: xpForLevel(90), winStreak: 0, bestStreak: 0, pending: [], pendingLevelUp: null,
      unlocked: ACHIEVEMENTS.map(a => ({ id: a.id, at: 0 })),
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    useWallet.getState().reset()
    neutralize()
    useScratch.setState({ phase: 'idle', card: null, win: 0, message: null })
  })

  it('charges the ticket on buy', () => {
    const before = useWallet.getState().balance
    const ticket = useScratch.getState().ticket
    useScratch.getState().buy()
    expect(useWallet.getState().balance).toBe(before - ticket)
    expect(useScratch.getState().phase).toBe('revealing')
  })

  it('settles via the fallback timer even without scratching', () => {
    useScratch.getState().buy()
    expect(useScratch.getState().phase).toBe('revealing')
    // Fire the ~9s fallback but stop before the 2.6s auto-return to idle.
    vi.advanceTimersByTime(9500)
    expect(useScratch.getState().phase).toBe('result')
  })

  it('pays exactly the card value and books stay balanced', () => {
    const before = useWallet.getState().balance
    const ticket = useScratch.getState().ticket
    useScratch.getState().buy()
    const card = useScratch.getState().card!
    const expected = winForTicket(card, ticket)
    vi.advanceTimersByTime(12000)
    expect(useScratch.getState().win).toBe(expected)
    expect(useWallet.getState().balance).toBe(before - ticket + expected)
  })

  it('never double-pays if reveal and timer both fire', () => {
    useScratch.getState().buy()
    const balanceMid = useWallet.getState().balance
    const ticket = useScratch.getState().ticket
    const card = useScratch.getState().card!
    useScratch.getState().revealAll() // settles now
    vi.advanceTimersByTime(12000) // timer must be a no-op
    expect(useWallet.getState().balance).toBe(balanceMid + winForTicket(card, ticket))
    expect(useWallet.getState().handsPlayed).toBe(1)
  })

  it('refuses to buy without enough chips', () => {
    useWallet.setState({ balance: 0 })
    useScratch.getState().buy()
    expect(useScratch.getState().phase).toBe('idle')
    expect(useScratch.getState().message).toBeTruthy()
  })
})
