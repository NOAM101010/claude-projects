import { describe, it, expect, beforeEach } from 'vitest'

const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size },
}

import { useJackpot, JACKPOT_SEED } from '../src/state/useJackpot'
import { useProgress } from '../src/progression/useProgress'
import { useWallet } from '../src/state/useWallet'
import { useCosmetics, FELT_THEMES, CHIP_SKINS } from '../src/state/useCosmetics'
import { useRoulette } from '../src/games/roulette/useRoulette'
import { xpForLevel } from '../src/progression/levels'

describe('progressive jackpot', () => {
  beforeEach(() => useJackpot.setState({ pool: JACKPOT_SEED }))

  it('grows by 1% of each bet', () => {
    useJackpot.getState().contribute(1000)
    expect(useJackpot.getState().pool).toBe(JACKPOT_SEED + 10)
  })

  it('awards the pool and reseeds', () => {
    useJackpot.getState().contribute(50000) // +500
    const pool = useJackpot.getState().pool
    const won = useJackpot.getState().award()
    expect(won).toBe(pool)
    expect(useJackpot.getState().pool).toBe(JACKPOT_SEED)
  })
})

describe('level-up rewards', () => {
  beforeEach(() => {
    useWallet.getState().reset()
    useProgress.setState({ xp: 0, pendingLevelUp: null, unlocked: [], pending: [] })
  })

  it('pays chips and queues a celebration on level up', () => {
    // Jump XP straight past level 2's threshold via a big wagered round.
    const need = xpForLevel(2)
    useProgress.setState({ xp: need - 1 })
    const balanceBefore = useWallet.getState().balance
    useProgress.getState().recordRound(400, 400) // grants enough XP to cross
    expect(useProgress.getState().level()).toBeGreaterThanOrEqual(2)
    expect(useProgress.getState().pendingLevelUp).not.toBeNull()
    expect(useWallet.getState().balance).toBeGreaterThan(balanceBefore)
  })

  it('consumeLevelUp returns the level and clears the flag', () => {
    useProgress.setState({ pendingLevelUp: 5, lastLevelReward: 1250 })
    const popped = useProgress.getState().consumeLevelUp()
    expect(popped).toEqual({ level: 5, reward: 1250 })
    expect(useProgress.getState().pendingLevelUp).toBeNull()
    expect(useProgress.getState().consumeLevelUp()).toBeNull()
  })
})

describe('cosmetics', () => {
  it('has classic unlocked at level 1 and others gated', () => {
    expect(FELT_THEMES[0].unlockLevel).toBe(1)
    expect(FELT_THEMES.some(t => t.unlockLevel > 1)).toBe(true)
    expect(CHIP_SKINS[0].unlockLevel).toBe(1)
  })

  it('equips an owned felt theme', () => {
    useCosmetics.getState().grantFelt('royal')
    useCosmetics.getState().setFeltTheme('royal')
    expect(useCosmetics.getState().currentFelt().id).toBe('royal')
  })

  it('will not equip a felt the player does not own', () => {
    useCosmetics.getState().setFeltTheme('classic')
    useCosmetics.getState().setFeltTheme('crimson') // not owned → ignored
    expect(useCosmetics.getState().feltTheme).toBe('classic')
  })

  it('ignores an unknown theme id', () => {
    useCosmetics.getState().setFeltTheme('classic')
    useCosmetics.getState().setFeltTheme('does-not-exist')
    expect(useCosmetics.getState().feltTheme).toBe('classic')
  })
})

describe('roulette repeat/save bets', () => {
  beforeEach(() => {
    useWallet.getState().reset()
    useWallet.setState({ balance: 100000 })
    useProgress.setState({ xp: 5000 })
    useRoulette.setState({ phase: 'betting', bets: [], lastBets: [], savedBets: [], chip: 100 })
  })

  it('repeats the previous round bets after a spin', () => {
    useRoulette.getState().setChip(100)
    useRoulette.getState().placeBet('red')
    useRoulette.getState().placeBet('straight', 7)
    useRoulette.getState().doSpin() // captures lastBets
    // Back to betting for the next round.
    useRoulette.setState({ phase: 'betting', bets: [] })
    useRoulette.getState().repeatLast()
    const kinds = useRoulette.getState().bets.map(b => b.kind).sort()
    expect(kinds).toEqual(['red', 'straight'])
  })

  it('saves and loads a favourite bet set', () => {
    useRoulette.getState().setChip(50)
    useRoulette.getState().placeBet('black')
    useRoulette.getState().saveFavorite()
    useRoulette.getState().clearBets()
    expect(useRoulette.getState().bets).toHaveLength(0)
    useRoulette.getState().loadFavorite()
    expect(useRoulette.getState().bets).toHaveLength(1)
    expect(useRoulette.getState().bets[0].kind).toBe('black')
  })
})
