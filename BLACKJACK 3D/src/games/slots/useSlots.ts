import { create } from 'zustand'
import { spin, evaluate, Symbol, SpinResult } from './engine'
import { useWallet } from '../../state/useWallet'
import { useProgress } from '../../progression/useProgress'
import { useSettings } from '../../state/useSettings'
import { useJackpot } from '../../state/useJackpot'
import { maybeCelebrate } from '../../state/useCelebration'
import { playSfx } from '../../audio/sfx'
import { highestUnlockedTier, vipTierForGame } from '../../progression/levels'
import { vipEffectiveLevel } from '../../state/useVip'
import { useApp } from '../../state/useApp'

export type SlotsPhase = 'idle' | 'spinning' | 'result'

interface SlotsState {
  bet: number
  phase: SlotsPhase
  result: SpinResult | null
  lastWin: number
  /** Per-reel stop time (ms since spin start) so they land left-to-right. */
  reelStops: [number, number, number]
  spinStart: number
  message: string | null

  minBet: number
  maxBet: number

  /** Spins left in an auto-play run (0 = manual). */
  autoRemaining: number
  /** Size of the current auto-play run, for the UI. */
  autoTotal: number

  syncBounds: () => void
  setBet: (v: number) => void
  changeBet: (delta: number) => void
  setBetToMax: () => void
  setBetToMin: () => void
  doSpin: () => void
  /** Start an auto-play run of `count` spins at the current bet (faster reels). */
  startAuto: (count: number) => void
  /** Stop auto-play after the current spin. */
  stopAuto: () => void
  /** Called by the view when the last reel has visually settled. */
  finishSpin: () => void
}

export const AUTO_COUNTS = [10, 25, 50, 100]

const REEL_BASE = [900, 1250, 1650] as const

/** The single pending spin-resolution timer. */
let spinTimer: ReturnType<typeof setTimeout> | null = null

function tierBounds() {
  if (useApp.getState().vipMode) {
    const vip = vipTierForGame('slots')
    if (vip) return { min: vip.minBet, max: vip.maxBet }
  }
  const level = vipEffectiveLevel(useProgress.getState().level())
  const tier = highestUnlockedTier('slots', level)
  return { min: tier?.minBet ?? 10, max: tier?.maxBet ?? 200 }
}

export const useSlots = create<SlotsState>((set, get) => {
  const b = tierBounds()
  return {
    bet: b.min,
    phase: 'idle',
    result: null,
    lastWin: 0,
    reelStops: [...REEL_BASE] as [number, number, number],
    spinStart: 0,
    message: null,
    minBet: b.min,
    maxBet: b.max,
    autoRemaining: 0,
    autoTotal: 0,

    // Recompute bet limits (level may have changed since last visit).
    syncBounds: () => {
      const { min, max } = tierBounds()
      set(s => ({ minBet: min, maxBet: max, bet: Math.min(Math.max(s.bet, min), max) }))
    },

    setBet: v => {
      if (get().phase !== 'idle') return
      const { min, max } = tierBounds()
      set({ bet: Math.min(Math.max(v, min), max), minBet: min, maxBet: max })
    },

    // The step scales with the current bet's magnitude, so a few clicks span the
    // whole range instead of nudging by the (small) table minimum every time.
    changeBet: delta => {
      const { min, max } = tierBounds()
      const bet = get().bet
      // Basis for the magnitude: going down, use bet-1 so a round value like
      // 10000 steps down by 1000 (→9000), not by its own full magnitude (→min).
      const basis = delta > 0 ? bet : bet - 1
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(basis, min))))
      const step = Math.max(min, magnitude)
      // Snap to the step grid so values stay round as they grow.
      const next = delta > 0
        ? Math.floor(bet / step) * step + step
        : Math.ceil(bet / step) * step - step
      set({ bet: Math.min(Math.max(next, min), max), minBet: min, maxBet: max })
    },

    setBetToMax: () => {
      const { min, max } = tierBounds()
      set({ bet: max, minBet: min, maxBet: max })
    },
    setBetToMin: () => {
      const { min, max } = tierBounds()
      set({ bet: min, minBet: min, maxBet: max })
    },

    doSpin: () => {
      if (get().phase !== 'idle') return
      const bet = get().bet
      if (!useWallet.getState().wager(bet)) {
        set({ message: 'אין מספיק ציפים' })
        return
      }
      playSfx('chip')
      const factor = useSettings.getState().factor()
      // Auto-play spins run a bit faster than a manual spin.
      const speed = get().autoRemaining > 0 ? 0.6 : 1
      const result = spin((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
      const stops = REEL_BASE.map(t => t * factor * speed) as [number, number, number]
      set({
        phase: 'spinning',
        result,
        lastWin: 0,
        message: null,
        spinStart: performance.now(),
        reelStops: stops,
      })

      // Resolution is scheduled here, NOT driven by the reel animation. If the
      // render loop stalls (backgrounded tab) the win must still be paid — the
      // same lesson as the blackjack payout. The view only animates toward it.
      spinTimer = setTimeout(() => get().finishSpin(), Math.max(...stops) + 120)
    },

    startAuto: count => {
      if (get().phase !== 'idle') return
      if (!useWallet.getState().canAfford(get().bet)) { set({ message: 'אין מספיק ציפים' }); return }
      set({ autoRemaining: count, autoTotal: count })
      get().doSpin()
    },

    stopAuto: () => set({ autoRemaining: 0, autoTotal: 0 }),

    finishSpin: () => {
      const { result, bet, phase } = get()
      if (phase !== 'spinning' || !result) return
      if (spinTimer) {
        clearTimeout(spinTimer)
        spinTimer = null
      }
      const evalResult = evaluate(result, bet)

      // Progressive jackpot: every spin feeds the pool; three diamonds takes it.
      useJackpot.getState().contribute(bet)
      const isJackpot = result.symbols.every(s => s === 'diamond')
      const jackpotWin = isJackpot ? useJackpot.getState().award() : 0

      const totalWin = evalResult.win + jackpotWin
      if (totalWin > 0) {
        useWallet.getState().add(totalWin)
        playSfx('win')
        set({
          message: isJackpot
            ? `🎉 ג'קפוט! ${totalWin.toLocaleString('he-IL')}`
            : `זכית ${totalWin.toLocaleString('he-IL')}!`,
        })
      } else {
        playSfx('lose')
        set({ message: null })
      }
      useWallet.getState().recordOutcome(totalWin - bet, false)
      useProgress.getState().recordRound(bet, totalWin - bet)
      maybeCelebrate(totalWin, bet, isJackpot ? 'jackpot' : 'win')
      set({ phase: 'result', lastWin: totalWin })

      // Auto-play: chain the next spin after a short pause (shorter than manual);
      // stop when the run is done or the player can't afford the next bet.
      const remaining = get().autoRemaining
      if (remaining > 0) {
        const next = remaining - 1
        set({ autoRemaining: next })
        const factor = useSettings.getState().factor()
        setTimeout(() => {
          if (get().phase !== 'result') return
          set({ phase: 'idle' })
          if (next > 0) {
            if (useWallet.getState().canAfford(get().bet)) get().doSpin()
            else set({ autoRemaining: 0, autoTotal: 0, message: 'נגמרו הציפים' })
          } else {
            set({ autoTotal: 0 })
          }
        }, 400 * factor)
      } else {
        setTimeout(() => {
          if (get().phase === 'result') set({ phase: 'idle' })
        }, 900)
      }
    },
  }
})

/** Convenience for the view: the symbol each reel should display right now. */
export function reelTarget(state: SlotsState, reel: number): Symbol | null {
  return state.result ? state.result.symbols[reel] : null
}
