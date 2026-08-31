import { describe, it, expect, beforeEach } from 'vitest'

// localStorage shim so persisted zustand stores work under node.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size },
}

import { xpForLevel, levelForXp, levelProgress, xpForRound, MAX_LEVEL } from '../src/progression/levels'
import { useVip, VIP_CLUB, VIP_PASS_COST } from '../src/state/useVip'
import { useWallet } from '../src/state/useWallet'
import { useDiamonds } from '../src/state/useDiamonds'
import { useCosmetics } from '../src/state/useCosmetics'
import { useProgress } from '../src/progression/useProgress'

describe('leveling curve', () => {
  it('caps XP per round so bet size cannot buy levels', () => {
    // A tiny bet and a whale bet both stay in a small band.
    expect(xpForRound(50, 0)).toBeLessThanOrEqual(35)
    expect(xpForRound(50_000, 500_000)).toBeLessThanOrEqual(35)
    expect(xpForRound(50_000, 500_000)).toBeGreaterThan(xpForRound(50, 0))
  })

  it('never levels past MAX_LEVEL no matter the XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(xpForLevel(MAX_LEVEL))).toBe(MAX_LEVEL)
    expect(levelForXp(999_999_999)).toBe(MAX_LEVEL)
    expect(levelProgress(999_999_999)).toMatchObject({ level: MAX_LEVEL, frac: 1 })
  })

  it('keeps the mid-tier unlocks reachable at reasonable XP', () => {
    expect(xpForLevel(12)).toBeLessThan(3000) // top normal table tier
    expect(xpForLevel(20)).toBeLessThan(200_000) // cashier royal (level 20)
  })
})

describe('VIP club tiers', () => {
  beforeEach(() => {
    useWallet.getState().reset()
    useVip.setState({ hasPass: false })
    useDiamonds.setState({ diamonds: 100 })
  })

  it('steps up by lifetime wagered', () => {
    useWallet.setState({ totalWagered: 0 })
    expect(useVip.getState().tierIndex()).toBe(0)
    useWallet.setState({ totalWagered: VIP_CLUB[1].minWagered })
    expect(useVip.getState().tier().id).toBe('silver')
    useWallet.setState({ totalWagered: VIP_CLUB[3].minWagered })
    expect(useVip.getState().tier().id).toBe('platinum')
    useWallet.setState({ totalWagered: VIP_CLUB[4].minWagered })
    expect(useVip.getState().tier().id).toBe('diamond')
  })

  it('a diamond pass floors the tier at Silver', () => {
    useWallet.setState({ totalWagered: 0 })
    expect(useVip.getState().hasAccess()).toBe(false)
    expect(useVip.getState().buyPass()).toBe(true)
    expect(useVip.getState().tier().id).toBe('silver')
    expect(useVip.getState().hasAccess()).toBe(true)
    expect(useDiamonds.getState().diamonds).toBe(100 - VIP_PASS_COST)
  })

  it('higher tiers give bigger perks', () => {
    useWallet.setState({ totalWagered: VIP_CLUB[4].minWagered })
    expect(useVip.getState().diamondDropBonus()).toBeGreaterThan(1)
    expect(useVip.getState().cashierBonus()).toBeGreaterThan(0)
  })
})

describe('cosmetics — new categories', () => {
  beforeEach(() => {
    useProgress.setState({ xp: xpForLevel(MAX_LEVEL) }) // max level → nothing locked
    useWallet.getState().reset()
    useWallet.setState({ balance: 2_000_000 })
    useDiamonds.setState({ diamonds: 100 })
    useCosmetics.setState({
      cardBack: 'classic', avatarFrame: 'none', title: 'none',
      ownedBacks: ['classic'], ownedFrames: ['none'], ownedTitles: ['none'],
    })
  })

  it('buys a coin card back and auto-equips it', () => {
    const coins = useWallet.getState().balance
    expect(useCosmetics.getState().buyBack('navy')).toBe('ok')
    expect(useCosmetics.getState().ownsBack('navy')).toBe(true)
    expect(useCosmetics.getState().cardBack).toBe('navy')
    expect(useWallet.getState().balance).toBeLessThan(coins)
  })

  it('buys a diamond-only frame and title with gems', () => {
    const gems = useDiamonds.getState().diamonds
    expect(useCosmetics.getState().buyFrame('diamond-frame')).toBe('ok')
    expect(useCosmetics.getState().buyTitle('legend')).toBe('ok')
    expect(useDiamonds.getState().diamonds).toBeLessThan(gems)
    expect(useCosmetics.getState().avatarFrame).toBe('diamond-frame')
    expect(useCosmetics.getState().title).toBe('legend')
  })

  it('will not equip an unowned cosmetic', () => {
    useCosmetics.getState().setAvatarFrame('gold-frame') // not owned
    expect(useCosmetics.getState().avatarFrame).toBe('none')
    useCosmetics.getState().setTitle('shark') // not owned
    expect(useCosmetics.getState().title).toBe('none')
  })
})
