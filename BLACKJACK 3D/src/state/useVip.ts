import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDiamonds } from './useDiamonds'
import { useWallet } from './useWallet'

export const VIP_PASS_COST = 30 // diamonds → instant Silver access
/** A member's effective level floor — enough to unlock every non-VIP top tier. */
export const VIP_ACCESS_LEVEL = 12

export interface VipTier {
  id: 'none' | 'silver' | 'gold' | 'platinum' | 'diamond'
  name: string
  /** Total lifetime wagered needed to reach this tier. */
  minWagered: number
  /** Multiplier on the on-win diamond-drop chance + daily cap. */
  diamondBonus: number
  /** Fraction added to claimed cashier packs (0.25 = +25%). */
  cashierBonus: number
  /** Cosmetic ids granted for free at this tier. */
  exclusiveFelt?: string
  color: string
}

// The loyalty ladder, keyed on lifetime amount wagered (already tracked in the
// wallet). Higher tiers = better perks; a diamond pass floors you at Silver.
export const VIP_CLUB: VipTier[] = [
  { id: 'none',     name: 'ללא',     minWagered: 0,           diamondBonus: 1,    cashierBonus: 0,    color: '#8a8a8a' },
  { id: 'silver',   name: 'כסף',     minWagered: 250_000,     diamondBonus: 1.25, cashierBonus: 0.10, color: '#c4ccd6' },
  { id: 'gold',     name: 'זהב',     minWagered: 2_500_000,   diamondBonus: 1.5,  cashierBonus: 0.25, exclusiveFelt: 'vip',      color: '#e8c94a' },
  { id: 'platinum', name: 'פלטינה',  minWagered: 25_000_000,  diamondBonus: 2,    cashierBonus: 0.50, exclusiveFelt: 'aurora',   color: '#b9f2ff' },
  { id: 'diamond',  name: 'יהלום',   minWagered: 250_000_000, diamondBonus: 2.5,  cashierBonus: 1.0,  exclusiveFelt: 'sapphire', color: '#8ac6ff' },
]

interface VipState {
  /** A bought diamond pass floors the club tier at Silver. */
  hasPass: boolean
  buyPass: () => boolean
  /** Index into VIP_CLUB (0 = none). */
  tierIndex: () => number
  tier: () => VipTier
  /** The next tier up, or null at the top. */
  nextTier: () => VipTier | null
  /** VIP salon + member perks unlock at Silver and up. */
  hasAccess: () => boolean
  diamondDropBonus: () => number
  cashierBonus: () => number
}

export const useVip = create<VipState>()(
  persist(
    (set, get) => ({
      hasPass: false,

      buyPass: () => {
        if (get().hasPass) return true
        if (!useDiamonds.getState().spend(VIP_PASS_COST)) return false
        set({ hasPass: true })
        return true
      },

      tierIndex: () => {
        const wagered = useWallet.getState().totalWagered
        let idx = 0
        for (let i = VIP_CLUB.length - 1; i >= 1; i--) {
          if (wagered >= VIP_CLUB[i].minWagered) { idx = i; break }
        }
        if (get().hasPass && idx < 1) idx = 1 // pass floors at Silver
        return idx
      },

      tier: () => VIP_CLUB[get().tierIndex()],
      nextTier: () => VIP_CLUB[get().tierIndex() + 1] ?? null,
      hasAccess: () => get().tierIndex() >= 1,
      diamondDropBonus: () => get().tier().diamondBonus,
      cashierBonus: () => get().tier().cashierBonus,
    }),
    { name: 'goldenace-vip' }
  )
)

/** Effective level for tier gating — members unlock the top normal tiers early. */
export function vipEffectiveLevel(level: number): number {
  return useVip.getState().hasAccess() ? Math.max(level, VIP_ACCESS_LEVEL) : level
}
