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

import { CHIP_PACKS, cooldownRemaining, isReady, formatCooldown, useCashier } from '../src/state/useCashier'
import { useWallet } from '../src/state/useWallet'
import { useProgress } from '../src/progression/useProgress'

describe('cashier cooldown maths', () => {
  const pack = CHIP_PACKS[0] // 15 min cooldown

  it('is ready when never claimed', () => {
    expect(isReady(pack, 0, pack.cooldownMs + 1)).toBe(true)
  })

  it('reports the remaining time right after a claim', () => {
    const now = 1_000_000
    expect(cooldownRemaining(pack, now, now)).toBe(pack.cooldownMs)
    expect(isReady(pack, now, now)).toBe(false)
  })

  it('becomes ready exactly at the cooldown boundary', () => {
    const claimed = 1_000_000
    expect(isReady(pack, claimed, claimed + pack.cooldownMs - 1)).toBe(false)
    expect(isReady(pack, claimed, claimed + pack.cooldownMs)).toBe(true)
  })

  it('never reports negative remaining time', () => {
    expect(cooldownRemaining(pack, 0, 10 * pack.cooldownMs)).toBe(0)
  })

  it('formats durations as clock strings', () => {
    expect(formatCooldown(0)).toBe('00:00')
    expect(formatCooldown(65 * 1000)).toBe('01:05')
    expect(formatCooldown(3 * 3600 * 1000 + 4 * 60 * 1000 + 5 * 1000)).toBe('3:04:05')
  })
})

describe('cashier claiming', () => {
  beforeEach(() => {
    useWallet.getState().reset()
    useProgress.setState({ xp: 999999 }) // unlock every pack
    useCashier.setState({ claims: {} })
  })

  it('credits the wallet on a claim', () => {
    const before = useWallet.getState().balance
    const ok = useCashier.getState().claim('quick')
    expect(ok).toBe(true)
    expect(useWallet.getState().balance).toBe(before + CHIP_PACKS[0].amount)
  })

  it('blocks a second claim until the cooldown passes', () => {
    useCashier.getState().claim('quick')
    const balance = useWallet.getState().balance
    const second = useCashier.getState().claim('quick')
    expect(second).toBe(false)
    expect(useWallet.getState().balance).toBe(balance)
  })

  it('locks packs above the player level', () => {
    useProgress.setState({ xp: 0 }) // level 1
    // 'royal' needs level 20.
    expect(useCashier.getState().canClaim('royal')).toBe(false)
    expect(useCashier.getState().claim('royal')).toBe(false)
  })

  it('every pack has a positive amount and a cooldown', () => {
    for (const p of CHIP_PACKS) {
      expect(p.amount).toBeGreaterThan(0)
      expect(p.cooldownMs).toBeGreaterThan(0)
    }
  })
})
