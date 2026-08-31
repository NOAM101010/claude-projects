import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWallet } from './useWallet'

const FILL_RATE = 0.02 // 2% of each wager
const CAP = 100000

interface PiggyState {
  saved: number
  /** Adds a slice of a wager to the pot, up to the cap. */
  contribute: (wagered: number) => void
  /** Breaks the bank: pays out to the wallet and resets. Returns the amount. */
  break: () => number
  isFull: () => boolean
}

/**
 * A savings pot that fills passively as you play. It can be broken any time to
 * collect — a gentle "come back and cash out" hook that also softens losses.
 */
export const usePiggyBank = create<PiggyState>()(
  persist(
    (set, get) => ({
      saved: 0,
      contribute: wagered =>
        set(s => ({ saved: Math.min(CAP, Math.round(s.saved + wagered * FILL_RATE)) })),
      break: () => {
        const amount = get().saved
        if (amount <= 0) return 0
        useWallet.getState().add(amount)
        set({ saved: 0 })
        return amount
      },
      isFull: () => get().saved >= CAP,
    }),
    { name: 'goldenace-piggy' }
  )
)

export const PIGGY_CAP = CAP
