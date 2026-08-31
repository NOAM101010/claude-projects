import { create } from 'zustand'
import { Card, CELLS, generateCard, evaluateCard, winForTicket } from './engine'
import { useWallet } from '../../state/useWallet'
import { useProgress } from '../../progression/useProgress'
import { useSettings } from '../../state/useSettings'
import { maybeCelebrate } from '../../state/useCelebration'
import { playSfx } from '../../audio/sfx'

export type ScratchPhase = 'idle' | 'revealing' | 'result'

export const TICKETS = [100, 500, 2500, 10000]

interface ScratchState {
  ticket: number
  phase: ScratchPhase
  card: Card | null
  revealed: boolean[]
  win: number
  winningCells: number[]
  message: string | null

  setTicket: (v: number) => void
  buy: () => void
  reveal: (i: number) => void
  revealAll: () => void
  settle: () => void
}

let fallbackTimer: ReturnType<typeof setTimeout> | null = null
let settled = true

export const useScratch = create<ScratchState>((set, get) => ({
  ticket: TICKETS[0],
  phase: 'idle',
  card: null,
  revealed: Array(CELLS).fill(false),
  win: 0,
  winningCells: [],
  message: null,

  setTicket: v => {
    if (get().phase !== 'idle') return
    set({ ticket: v })
  },

  buy: () => {
    if (get().phase !== 'idle') return
    const ticket = get().ticket
    if (!useWallet.getState().wager(ticket)) {
      set({ message: 'אין מספיק ציפים' })
      return
    }
    playSfx('chip')
    const card = generateCard((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
    settled = false
    set({
      phase: 'revealing',
      card,
      revealed: Array(CELLS).fill(false),
      win: 0,
      winningCells: [],
      message: null,
    })
    // Fallback: pay even if the player never finishes scratching.
    const factor = useSettings.getState().factor()
    fallbackTimer = setTimeout(() => get().settle(), 9000 * factor)
  },

  reveal: i => {
    if (get().phase !== 'revealing') return
    const revealed = [...get().revealed]
    if (revealed[i]) return
    revealed[i] = true
    playSfx('chip')
    set({ revealed })
    if (revealed.every(Boolean)) get().settle()
  },

  revealAll: () => {
    if (get().phase !== 'revealing') return
    set({ revealed: Array(CELLS).fill(true) })
    get().settle()
  },

  settle: () => {
    if (settled) return
    settled = true
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
    }
    const { card, ticket } = get()
    if (!card) return
    const result = evaluateCard(card)
    const win = winForTicket(card, ticket)

    if (win > 0) {
      useWallet.getState().add(win)
      playSfx('win')
    } else {
      playSfx('lose')
    }
    useWallet.getState().recordOutcome(win - ticket, false)
    useProgress.getState().recordRound(ticket, win - ticket)
    maybeCelebrate(win, ticket)

    set({
      phase: 'result',
      win,
      winningCells: result.winningCells,
      revealed: Array(CELLS).fill(true),
      message: win > 0 ? `זכית ${win.toLocaleString('he-IL')}!` : null,
    })

    setTimeout(() => {
      if (get().phase === 'result') set({ phase: 'idle', card: null, message: null })
    }, 2600)
  },
}))
