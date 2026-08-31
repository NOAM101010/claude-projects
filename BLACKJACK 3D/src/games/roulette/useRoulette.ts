import { create } from 'zustand'
import { Bet, BetKind, spin, settleBets, totalStaked, WHEEL_ORDER } from './engine'
import { useWallet } from '../../state/useWallet'
import { useProgress } from '../../progression/useProgress'
import { useSettings } from '../../state/useSettings'
import { maybeCelebrate } from '../../state/useCelebration'
import { playSfx } from '../../audio/sfx'
import { highestUnlockedTier, vipTierForGame } from '../../progression/levels'
import { vipEffectiveLevel } from '../../state/useVip'
import { useApp } from '../../state/useApp'

export type RoulettePhase = 'betting' | 'spinning' | 'result'

interface RouletteState {
  bets: Bet[]
  chip: number
  phase: RoulettePhase
  result: number | null
  lastNet: number
  spinStart: number
  spinDuration: number
  /** Index in WHEEL_ORDER the ball lands on, for the 3D animation. */
  targetIndex: number
  recent: number[]
  message: string | null
  /** The previous round's bets, for one-click repeat. */
  lastBets: Bet[]
  /** A saved favourite bet set. */
  savedBets: Bet[]

  minBet: number
  maxBet: number

  syncBounds: () => void
  setChip: (v: number) => void
  placeBet: (kind: BetKind, value?: number) => void
  clearBets: () => void
  applyBets: (bets: Bet[]) => void
  repeatLast: () => void
  saveFavorite: () => void
  loadFavorite: () => void
  doSpin: () => void
  finishSpin: () => void
}

let spinTimer: ReturnType<typeof setTimeout> | null = null

function tierBounds() {
  // In the VIP salon use the high-limit VIP table; otherwise the highest normal
  // tier the player has unlocked.
  if (useApp.getState().vipMode) {
    const vip = vipTierForGame('roulette')
    if (vip) return { min: vip.minBet, max: vip.maxBet }
  }
  const level = vipEffectiveLevel(useProgress.getState().level())
  const tier = highestUnlockedTier('roulette', level)
  return { min: tier?.minBet ?? 10, max: tier?.maxBet ?? 1000 }
}

export const useRoulette = create<RouletteState>((set, get) => {
  const b = tierBounds()
  return {
    bets: [],
    chip: b.min,
    phase: 'betting',
    result: null,
    lastNet: 0,
    spinStart: 0,
    spinDuration: 4200,
    targetIndex: 0,
    recent: [],
    message: null,
    lastBets: [],
    savedBets: [],
    minBet: b.min,
    maxBet: b.max,

    // Bet limits depend on the player's level, which can change between visits.
    // Recompute them (and re-clamp the selected chip) when the table is opened.
    syncBounds: () => {
      const { min, max } = tierBounds()
      set(s => ({ minBet: min, maxBet: max, chip: Math.min(Math.max(s.chip, min), max) }))
    },

    setChip: v => set({ chip: v }),

    // Replaces the current bets with a saved/previous set, capped by affordability
    // and the table max.
    applyBets: bets => {
      if (get().phase !== 'betting' || bets.length === 0) return
      const { max } = tierBounds()
      let staked = 0
      const applied: Bet[] = []
      for (const bet of bets) {
        if (staked + bet.amount > max) continue
        if (!useWallet.getState().canAfford(staked + bet.amount)) break
        applied.push({ ...bet })
        staked += bet.amount
      }
      if (applied.length === 0) {
        set({ message: 'אין מספיק ציפים' })
        return
      }
      playSfx('chip')
      set({ bets: applied, message: null })
    },

    repeatLast: () => get().applyBets(get().lastBets),
    saveFavorite: () => {
      if (get().bets.length > 0) set({ savedBets: get().bets.map(x => ({ ...x })) })
    },
    loadFavorite: () => get().applyBets(get().savedBets),

    placeBet: (kind, value) => {
      if (get().phase !== 'betting') return
      const chip = get().chip
      const staked = totalStaked(get().bets)
      const { max } = tierBounds()
      if (staked + chip > max) {
        set({ message: `הימור מקסימלי ${max.toLocaleString('he-IL')}` })
        return
      }
      if (!useWallet.getState().canAfford(staked + chip)) {
        set({ message: 'אין מספיק ציפים' })
        return
      }
      playSfx('chip')

      // Merge into an existing identical bet so chips stack.
      const bets = [...get().bets]
      const idx = bets.findIndex(x => x.kind === kind && x.value === value)
      if (idx >= 0) bets[idx] = { ...bets[idx], amount: bets[idx].amount + chip }
      else bets.push({ kind, value, amount: chip })
      set({ bets, message: null })
    },

    clearBets: () => {
      if (get().phase !== 'betting') return
      set({ bets: [] })
    },

    doSpin: () => {
      if (get().phase !== 'betting') return
      const bets = get().bets
      const staked = totalStaked(bets)
      if (staked <= 0) {
        set({ message: 'הנח הימור קודם' })
        return
      }
      const { min } = tierBounds()
      if (staked < min) {
        set({ message: `מינימום הימור בשולחן זה ${min.toLocaleString('he-IL')}` })
        return
      }
      if (!useWallet.getState().wager(staked)) {
        set({ message: 'אין מספיק ציפים' })
        return
      }
      playSfx('deal')

      const result = spin((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
      const targetIndex = WHEEL_ORDER.indexOf(result)
      const factor = useSettings.getState().factor()
      const duration = 4200 * factor
      set({
        phase: 'spinning',
        result,
        lastNet: 0,
        message: null,
        spinStart: performance.now(),
        spinDuration: duration,
        targetIndex,
        lastBets: get().bets.map(x => ({ ...x })), // remember for one-click repeat
      })

      // Store-timer resolution — never depends on the wheel animation, so a
      // stalled render loop can't strip the payout.
      spinTimer = setTimeout(() => get().finishSpin(), duration + 150)
    },

    finishSpin: () => {
      const { phase, bets, result } = get()
      if (phase !== 'spinning' || result === null) return
      if (spinTimer) {
        clearTimeout(spinTimer)
        spinTimer = null
      }

      const net = settleBets(bets, result)
      const staked = totalStaked(bets)
      // Return winnings + the stake on winning bets. Net already accounts for
      // losers; add back the staked amount for the portion that won.
      const returned = staked + net
      if (returned > 0) useWallet.getState().add(returned)

      useWallet.getState().recordOutcome(net, false)
      useProgress.getState().recordRound(staked, net)

      if (net > 0) playSfx('win')
      else if (net < 0) playSfx('lose')

      // Celebrate a big net win (roulette straight-ups can pay 35:1).
      maybeCelebrate(net, staked)

      set({
        phase: 'result',
        lastNet: net,
        recent: [result, ...get().recent].slice(0, 12),
        message:
          net > 0 ? `זכית ${net.toLocaleString('he-IL')}!`
            : net < 0 ? `הפסדת ${Math.abs(net).toLocaleString('he-IL')}`
            : 'תיקו',
      })

      setTimeout(() => {
        if (get().phase === 'result') set({ phase: 'betting', bets: [] })
      }, 2200)
    },
  }
})
