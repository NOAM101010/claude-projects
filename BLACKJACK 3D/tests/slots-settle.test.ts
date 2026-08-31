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

import { useSlots } from '../src/games/slots/useSlots'
import { useWallet } from '../src/state/useWallet'
import { useProgress, ACHIEVEMENTS } from '../src/progression/useProgress'
import { xpForLevel } from '../src/progression/levels'
import { evaluate } from '../src/games/slots/engine'

/**
 * Pre-unlock achievements AND park XP on a high level so neither achievement
 * rewards nor level-up rewards perturb the pure wager/payout accounting.
 */
function neutralizeRewards() {
  useProgress.setState({
    xp: xpForLevel(90), winStreak: 0, bestStreak: 0, pending: [], pendingLevelUp: null,
    unlocked: ACHIEVEMENTS.map(a => ({ id: a.id, at: 0 })),
  })
}

/**
 * Slot resolution must be driven by the store's timer, never by the reel
 * animation. If it depended on the render loop, a backgrounded tab (rAF paused)
 * would charge the spin and never pay it — the same bug the blackjack payout
 * once had.
 */
describe('slots settlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useWallet.getState().reset()
    neutralizeRewards()
    useSlots.setState({ phase: 'idle', result: null, lastWin: 0, message: null })
  })

  it('charges the bet immediately on spin', () => {
    const before = useWallet.getState().balance
    const bet = useSlots.getState().bet
    useSlots.getState().doSpin()
    expect(useWallet.getState().balance).toBe(before - bet)
    expect(useSlots.getState().phase).toBe('spinning')
  })

  it('resolves on its own timer without any view interaction', () => {
    useSlots.getState().doSpin()
    expect(useSlots.getState().phase).toBe('spinning')
    // No reel ever rendered; the store timer alone must settle it.
    vi.advanceTimersByTime(5000)
    expect(useSlots.getState().phase).toBe('idle')
  })

  it('pays exactly the evaluated win and nothing more', () => {
    const before = useWallet.getState().balance
    const bet = useSlots.getState().bet
    useSlots.getState().doSpin()
    const result = useSlots.getState().result!
    const expectedWin = evaluate(result, bet).win

    vi.advanceTimersByTime(5000)

    expect(useWallet.getState().balance).toBe(before - bet + expectedWin)
    expect(useSlots.getState().lastWin).toBe(expectedWin)
  })

  it('records one round per spin', () => {
    useSlots.getState().doSpin()
    vi.advanceTimersByTime(5000)
    expect(useWallet.getState().handsPlayed).toBe(1)
  })

  it('cannot spin again while a spin is in flight', () => {
    useSlots.getState().doSpin()
    const balanceAfterOne = useWallet.getState().balance
    useSlots.getState().doSpin() // ignored
    expect(useWallet.getState().balance).toBe(balanceAfterOne)
  })

  it('refuses to spin without enough chips', () => {
    useWallet.setState({ balance: 0 })
    useSlots.getState().doSpin()
    expect(useSlots.getState().phase).toBe('idle')
    expect(useSlots.getState().message).toBeTruthy()
  })

  it('books stay balanced over many spins', () => {
    const start = useWallet.getState().balance
    let staked = 0
    let won = 0
    for (let i = 0; i < 40; i++) {
      if (useWallet.getState().balance < useSlots.getState().bet) break
      const bet = useSlots.getState().bet
      useSlots.getState().doSpin()
      staked += bet
      vi.advanceTimersByTime(5000)
      won += useSlots.getState().lastWin
    }
    expect(useWallet.getState().balance).toBe(start - staked + won)
  })
})
