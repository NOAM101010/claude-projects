import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const STARTING_BALANCE = 5000

export interface Stats {
  handsPlayed: number
  wins: number
  losses: number
  pushes: number
  blackjacks: number
  biggestWin: number
  totalWagered: number
}

interface WalletState extends Stats {
  balance: number
  add: (amount: number) => void
  canAfford: (amount: number) => boolean
  wager: (amount: number) => boolean
  recordOutcome: (net: number, hadBlackjack: boolean) => void
  reset: () => void
}

const EMPTY_STATS: Stats = {
  handsPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  biggestWin: 0,
  totalWagered: 0,
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: STARTING_BALANCE,
      ...EMPTY_STATS,

      add: amount => set(s => ({ balance: Math.round(s.balance + amount) })),
      canAfford: amount => get().balance >= amount,
      wager: amount => {
        if (get().balance < amount) return false
        set(s => ({ balance: s.balance - amount, totalWagered: s.totalWagered + amount }))
        return true
      },

      recordOutcome: (net, hadBlackjack) =>
        set(s => ({
          handsPlayed: s.handsPlayed + 1,
          wins: net > 0 ? s.wins + 1 : s.wins,
          losses: net < 0 ? s.losses + 1 : s.losses,
          pushes: net === 0 ? s.pushes + 1 : s.pushes,
          blackjacks: hadBlackjack ? s.blackjacks + 1 : s.blackjacks,
          biggestWin: Math.max(s.biggestWin, net),
        })),

      reset: () => set({ balance: STARTING_BALANCE, ...EMPTY_STATS }),
    }),
    { name: 'bj3d-wallet' }
  )
)
