import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useVip } from './useVip'

/** A diamond win the HUD is waiting to toast (cleared after it's shown). */
export interface DiamondDrop {
  amount: number
  at: number
}

interface DiamondsState {
  diamonds: number
  /** Bookkeeping for the rare on-win drop (persisted so the rules survive reloads). */
  lastDropAt: number
  earnedToday: number
  dayStamp: number
  recentDrop: DiamondDrop | null

  add: (n: number) => void
  canAfford: (n: number) => boolean
  spend: (n: number) => boolean
  /** Rule-gated chance to drop diamonds on a winning round. Returns the amount. */
  maybeDropOnWin: (wagered: number, netDelta: number) => number
  consumeDrop: () => void
  reset: () => void
}

const START = 5

// ── On-win drop rules ────────────────────────────────────────────────────────
// Diamonds are NOT handed out on every win. A drop needs a real bet behind it,
// only happens once in a while (cooldown), is capped per day, and even then only
// lands on a dice roll. Bigger bets/wins nudge the odds and the payout up a bit.
/** Smallest bet that can ever trigger a drop. */
export const DIAMOND_MIN_BET = 500
/** No two drops closer together than this. */
const DROP_COOLDOWN_MS = 90_000
/** Ceiling on diamonds earned from play in a single day. */
const DROP_DAILY_CAP = 12
/** Base chance once the bet/cooldown gates are cleared. */
const DROP_BASE_CHANCE = 0.08
const DAY_MS = 86_400_000

function dayIndex(now: number): number {
  return Math.floor(now / DAY_MS)
}

/**
 * Premium currency. Earned slowly — level-ups, select achievements, and a rare
 * rule-gated drop on big winning rounds — and spent on exclusive skins, the VIP
 * pass and power-ups.
 */
export const useDiamonds = create<DiamondsState>()(
  persist(
    (set, get) => ({
      diamonds: START,
      lastDropAt: 0,
      earnedToday: 0,
      dayStamp: 0,
      recentDrop: null,

      add: n => set(s => ({ diamonds: s.diamonds + Math.max(0, Math.round(n)) })),
      canAfford: n => get().diamonds >= n,
      spend: n => {
        if (get().diamonds < n) return false
        set(s => ({ diamonds: s.diamonds - n }))
        return true
      },

      maybeDropOnWin: (wagered, netDelta) => {
        // Must be an actual win with a real bet behind it.
        if (netDelta <= 0 || wagered < DIAMOND_MIN_BET) return 0

        const now = Date.now()
        const today = dayIndex(now)
        const s = get()
        const earnedToday = s.dayStamp === today ? s.earnedToday : 0

        // VIP members get a boost to the odds and the daily ceiling.
        const vipBonus = useVip.getState().diamondDropBonus()
        const dailyCap = Math.round(DROP_DAILY_CAP * vipBonus)

        // Daily cap + cooldown gates ("once in a while", "not always").
        if (earnedToday >= dailyCap) return 0
        if (now - s.lastDropAt < DROP_COOLDOWN_MS) return 0

        // Chance scales gently with the size of the bet, capped so it stays rare.
        const betBoost = Math.min(0.12, (wagered / 5000) * 0.06)
        const chance = (DROP_BASE_CHANCE + betBoost) * vipBonus
        if (Math.random() > chance) return 0

        // Amount: usually 1; a hefty win (paid 8×+ the stake) can drop 2–3.
        let amount = 1
        if (netDelta >= wagered * 8) amount = 2 + (Math.random() < 0.25 ? 1 : 0)
        amount = Math.min(amount, dailyCap - earnedToday)
        if (amount <= 0) return 0

        set({
          diamonds: s.diamonds + amount,
          lastDropAt: now,
          earnedToday: earnedToday + amount,
          dayStamp: today,
          recentDrop: { amount, at: now },
        })
        return amount
      },

      consumeDrop: () => set({ recentDrop: null }),

      reset: () => set({ diamonds: START, lastDropAt: 0, earnedToday: 0, dayStamp: 0, recentDrop: null }),
    }),
    { name: 'goldenace-diamonds' }
  )
)

/** Diamonds granted when reaching a level (bigger milestone levels give more). */
export function diamondsForLevel(level: number): number {
  if (level % 10 === 0) return 25
  if (level % 5 === 0) return 10
  return 3
}
