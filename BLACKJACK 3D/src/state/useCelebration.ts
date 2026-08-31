import { create } from 'zustand'

export type CelebrationKind = 'win' | 'jackpot'

interface Celebration {
  id: number
  amount: number
  kind: CelebrationKind
}

interface CelebrationState {
  active: Celebration | null
  celebrate: (amount: number, kind?: CelebrationKind) => void
  clear: () => void
}

let nextId = 0

/**
 * Fires a big-win celebration (coin shower + banner). Games call `maybeCelebrate`
 * so the threshold logic lives in one place.
 */
export const useCelebration = create<CelebrationState>((set) => ({
  active: null,
  celebrate: (amount, kind = 'win') => set({ active: { id: ++nextId, amount, kind } }),
  clear: () => set({ active: null }),
}))

/** Celebrate only wins that feel big: a jackpot, a large absolute win, or a
 *  high multiple of the wager. */
export function maybeCelebrate(win: number, wagered: number, kind: CelebrationKind = 'win') {
  if (win <= 0) return
  const big = kind === 'jackpot' || win >= 5000 || (wagered > 0 && win >= wagered * 10)
  if (big) useCelebration.getState().celebrate(win, kind)
}
