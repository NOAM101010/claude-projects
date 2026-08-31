import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SEED = 10000
/** Fraction of each slots bet added to the pool. */
const CONTRIB_RATE = 0.01

interface JackpotState {
  pool: number
  contribute: (bet: number) => void
  /** Pays out and reseeds; returns the amount won. */
  award: () => number
}

/**
 * Progressive jackpot for the slots — grows with every bet, won on three
 * diamonds (the rarest symbol), then reseeds. Persisted so it carries between
 * sessions.
 */
export const useJackpot = create<JackpotState>()(
  persist(
    (set, get) => ({
      pool: SEED,
      contribute: bet => set(s => ({ pool: Math.round(s.pool + bet * CONTRIB_RATE) })),
      award: () => {
        const won = get().pool
        set({ pool: SEED })
        return won
      },
    }),
    { name: 'goldenace-jackpot' }
  )
)

export const JACKPOT_SEED = SEED
