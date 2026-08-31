import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWallet } from './useWallet'
import { useProgress } from '../progression/useProgress'
import { useVip } from './useVip'

export interface ChipPack {
  id: string
  name: string
  amount: number
  /** Cooldown between claims, in milliseconds. */
  cooldownMs: number
  unlockLevel: number
  emoji: string
}

const MIN = 60 * 1000
const HOUR = 60 * MIN

/**
 * Free chip packs on cooldowns — a social-casino cashier that doubles as the
 * safety net when you run out. No real money changes hands.
 */
export const CHIP_PACKS: ChipPack[] = [
  { id: 'quick', name: 'חבילה מהירה', amount: 2500, cooldownMs: 15 * MIN, unlockLevel: 1, emoji: '🪙' },
  { id: 'stack', name: 'ערימה', amount: 15000, cooldownMs: 3 * HOUR, unlockLevel: 1, emoji: '💰' },
  { id: 'vault', name: 'כספת', amount: 75000, cooldownMs: 24 * HOUR, unlockLevel: 5, emoji: '🏦' },
  { id: 'royal', name: 'חבילת מלכות', amount: 300000, cooldownMs: 24 * HOUR, unlockLevel: 20, emoji: '👑' },
]

/** Milliseconds left on a pack's cooldown, given the last-claim time. */
export function cooldownRemaining(pack: ChipPack, lastClaim: number, now: number): number {
  return Math.max(0, pack.cooldownMs - (now - lastClaim))
}

export function isReady(pack: ChipPack, lastClaim: number, now: number): boolean {
  return cooldownRemaining(pack, lastClaim, now) === 0
}

/** Formats a remaining duration as H:MM:SS / MM:SS. */
export function formatCooldown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

interface CashierState {
  /** packId → last claim epoch ms. */
  claims: Record<string, number>
  claim: (packId: string) => boolean
  canClaim: (packId: string) => boolean
  remaining: (packId: string) => number
}

export const useCashier = create<CashierState>()(
  persist(
    (set, get) => ({
      claims: {},

      canClaim: packId => {
        const pack = CHIP_PACKS.find(p => p.id === packId)
        if (!pack) return false
        if (useProgress.getState().level() < pack.unlockLevel) return false
        return isReady(pack, get().claims[packId] ?? 0, Date.now())
      },

      remaining: packId => {
        const pack = CHIP_PACKS.find(p => p.id === packId)
        if (!pack) return 0
        return cooldownRemaining(pack, get().claims[packId] ?? 0, Date.now())
      },

      claim: packId => {
        const pack = CHIP_PACKS.find(p => p.id === packId)
        if (!pack || !get().canClaim(packId)) return false
        // VIP members get a bonus on every claimed pack.
        const amount = Math.round(pack.amount * (1 + useVip.getState().cashierBonus()))
        useWallet.getState().add(amount)
        set(s => ({ claims: { ...s.claims, [packId]: Date.now() } }))
        return true
      },
    }),
    { name: 'goldenace-cashier' }
  )
)
