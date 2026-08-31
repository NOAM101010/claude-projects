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

import { useRoulette } from '../src/games/roulette/useRoulette'
import { useWallet } from '../src/state/useWallet'
import { useProgress, ACHIEVEMENTS } from '../src/progression/useProgress'
import { xpForLevel } from '../src/progression/levels'
import { settleBets, totalStaked } from '../src/games/roulette/engine'

/**
 * Pre-unlock achievements AND park XP high so neither achievement nor level-up
 * rewards perturb the pure wager/payout accounting these tests check.
 */
function neutralizeRewards() {
  useProgress.setState({
    xp: xpForLevel(90), winStreak: 0, bestStreak: 0, pending: [], pendingLevelUp: null,
    unlocked: ACHIEVEMENTS.map(a => ({ id: a.id, at: 0 })),
  })
}

/**
 * Roulette settlement, like slots and blackjack, is store-timer driven so a
 * stalled render loop can never pocket the stake without resolving.
 */
describe('roulette settlement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useWallet.getState().reset()
    neutralizeRewards()
    useRoulette.setState({ bets: [], phase: 'betting', result: null, lastNet: 0, recent: [], message: null })
    // Parked at a high level → highest roulette tier is the VIP table, whose
    // minimum buy-in the chip must clear for a spin to be accepted.
    useRoulette.getState().syncBounds()
    useRoulette.getState().setChip(useRoulette.getState().minBet)
  })

  it('charges the full stake when the wheel is spun', () => {
    const before = useWallet.getState().balance
    useRoulette.getState().placeBet('red')
    useRoulette.getState().placeBet('straight', 7)
    const staked = totalStaked(useRoulette.getState().bets)
    useRoulette.getState().doSpin()
    expect(useWallet.getState().balance).toBe(before - staked)
    expect(useRoulette.getState().phase).toBe('spinning')
  })

  it('raises the bet ceiling after the player levels up', () => {
    // Fresh store cached the low-level bound; syncBounds must pick up the new
    // tier so the chip picker and limits reflect the current level.
    useProgress.setState({ xp: 999999 }) // well past every unlock
    useRoulette.getState().syncBounds()
    expect(useRoulette.getState().maxBet).toBeGreaterThan(10000)
  })

  it('accepts a single bet far above the old 1000 cap', () => {
    useProgress.setState({ xp: 5000 })
    useWallet.setState({ balance: 100000 })
    useRoulette.getState().syncBounds()
    useRoulette.getState().setChip(5000)
    useRoulette.getState().placeBet('red')
    useRoulette.getState().placeBet('red')
    expect(totalStaked(useRoulette.getState().bets)).toBe(10000)
    useRoulette.getState().doSpin()
    expect(useRoulette.getState().phase).toBe('spinning')
    // Resolve so no spin is left pending for the next test.
    vi.advanceTimersByTime(10000)
    useRoulette.getState().setChip(10)
  })

  it('will not spin with no bets down', () => {
    useRoulette.getState().doSpin()
    expect(useRoulette.getState().phase).toBe('betting')
    expect(useRoulette.getState().message).toBeTruthy()
  })

  it('resolves on its own timer and pays the correct net', () => {
    const before = useWallet.getState().balance
    useRoulette.getState().placeBet('red')
    useRoulette.getState().placeBet('dozen', 1)
    const bets = [...useRoulette.getState().bets]
    const staked = totalStaked(bets)

    useRoulette.getState().doSpin()
    const result = useRoulette.getState().result!
    const expectedNet = settleBets(bets, result)

    vi.advanceTimersByTime(10000)

    expect(useWallet.getState().balance).toBe(before - staked + staked + expectedNet)
    expect(useRoulette.getState().lastNet).toBe(expectedNet)
    expect(useRoulette.getState().phase).toBe('betting')
  })

  it('records one round per spin and remembers the result', () => {
    useRoulette.getState().placeBet('black')
    useRoulette.getState().doSpin()
    const result = useRoulette.getState().result!
    vi.advanceTimersByTime(10000)
    expect(useWallet.getState().handsPlayed).toBe(1)
    expect(useRoulette.getState().recent[0]).toBe(result)
  })

  it('stacks chips on the same bet rather than duplicating it', () => {
    useRoulette.getState().setChip(10)
    useRoulette.getState().placeBet('red')
    useRoulette.getState().placeBet('red')
    const reds = useRoulette.getState().bets.filter(b => b.kind === 'red')
    expect(reds).toHaveLength(1)
    expect(reds[0].amount).toBe(20)
  })

  it('keeps the books balanced across many spins', () => {
    const start = useWallet.getState().balance
    let staked = 0
    let net = 0
    for (let i = 0; i < 30; i++) {
      // Re-park XP each spin: high-stakes VIP bets earn enough XP to otherwise
      // cross a level and pay a level-up bonus, which would perturb the pure
      // wager/payout accounting this test checks.
      useProgress.setState({ xp: xpForLevel(90) })
      useRoulette.setState({ phase: 'betting', bets: [] })
      useRoulette.getState().setChip(useRoulette.getState().minBet)
      useRoulette.getState().placeBet('red')
      const s = totalStaked(useRoulette.getState().bets)
      if (s <= 0 || !useWallet.getState().canAfford(s)) break
      useRoulette.getState().doSpin()
      staked += s
      vi.advanceTimersByTime(10000)
      net += useRoulette.getState().lastNet
    }
    expect(useWallet.getState().balance).toBe(start - staked + staked + net)
  })
})
