import { create } from 'zustand'

export type GameId = 'blackjack' | 'slots' | 'roulette' | 'scratch'
export type Screen = 'splash' | 'lobby' | GameId

interface AppState {
  screen: Screen
  /** Which station the player last entered from, for the return camera. */
  lastGame: GameId | null
  /** True during a fade so scenes can hold input. */
  transitioning: boolean
  /** True when the current game was entered through the VIP salon (high-limit
   *  table with a steep minimum). Reset when leaving the game. */
  vipMode: boolean

  enterGame: (id: GameId, opts?: { vip?: boolean }) => void
  exitToLobby: () => void
  goToLobby: () => void
  dismissSplash: () => void
}

const FADE_MS = 320

export const useApp = create<AppState>((set, get) => ({
  screen: 'splash',
  lastGame: null,
  transitioning: false,
  vipMode: false,

  enterGame: (id, opts) => {
    if (get().transitioning) return
    const vip = opts?.vip ?? false
    set({ transitioning: true })
    setTimeout(() => set({ screen: id, lastGame: id, transitioning: false, vipMode: vip }), FADE_MS)
  },

  exitToLobby: () => {
    if (get().transitioning) return
    set({ transitioning: true })
    setTimeout(() => set({ screen: 'lobby', transitioning: false, vipMode: false }), FADE_MS)
  },

  goToLobby: () => set({ screen: 'lobby', vipMode: false }),

  dismissSplash: () => set({ screen: 'lobby' }),
}))

export const FADE_DURATION_MS = FADE_MS
