import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWallet } from './useWallet'
import { useDiamonds } from './useDiamonds'
import { usePiggyBank } from './usePiggyBank'

export interface Powerup {
  id: string
  name: string
  emoji: string
  desc: string
  costChips: number
  costDiamonds: number
}

/**
 * Power-ups are deliberately limited to economy/XP boosts — nothing that changes
 * the odds of a hand — so the games stay fair.
 */
export const POWERUPS: Powerup[] = [
  { id: 'xp2x', name: 'מאיץ XP', emoji: '⚡', desc: 'XP כפול ל-10 סיבובים', costChips: 5000, costDiamonds: 0 },
  { id: 'piggyBoost', name: 'בוסט חיסכון', emoji: '🐷', desc: 'מוסיף 10,000 לקופת החיסכון', costChips: 8000, costDiamonds: 0 },
  { id: 'goldRush', name: 'בהלת זהב', emoji: '💰', desc: '25,000 צ\'יפים מיידית', costChips: 0, costDiamonds: 3 },
]

interface PowerupsState {
  /** Remaining rounds of the 2x XP boost. */
  xp2xRounds: number
  buy: (id: string) => boolean
  /** Returns the XP multiplier for this round and decrements the boost. */
  consumeXpTick: () => number
}

export const usePowerups = create<PowerupsState>()(
  persist(
    (set, get) => ({
      xp2xRounds: 0,

      buy: id => {
        const p = POWERUPS.find(x => x.id === id)
        if (!p) return false
        const wallet = useWallet.getState()
        const diamonds = useDiamonds.getState()
        if (p.costChips > 0 && !wallet.canAfford(p.costChips)) return false
        if (p.costDiamonds > 0 && !diamonds.canAfford(p.costDiamonds)) return false
        if (p.costChips > 0) wallet.wager(p.costChips) // deducts
        if (p.costDiamonds > 0) diamonds.spend(p.costDiamonds)

        switch (id) {
          case 'xp2x':
            set(s => ({ xp2xRounds: s.xp2xRounds + 10 }))
            break
          case 'piggyBoost':
            usePiggyBank.setState(s => ({ saved: s.saved + 10000 }))
            break
          case 'goldRush':
            wallet.add(25000)
            break
        }
        return true
      },

      consumeXpTick: () => {
        const rounds = get().xp2xRounds
        if (rounds <= 0) return 1
        set({ xp2xRounds: rounds - 1 })
        return 2
      },
    }),
    { name: 'goldenace-powerups' }
  )
)
