import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { levelForXp, levelProgress, xpForRound } from './levels'
import { ACHIEVEMENTS, AchievementCtx, newlyUnlocked } from './achievements'
import { useWallet } from '../state/useWallet'
import { useDiamonds, diamondsForLevel } from '../state/useDiamonds'
import { usePiggyBank } from '../state/usePiggyBank'
import { usePowerups } from '../state/usePowerups'

export interface UnlockedAchievement {
  id: string
  at: number
}

/** Preset emoji avatars — no image assets needed. */
export const AVATARS = ['🤵', '👑', '💎', '🎩', '🃏', '🎰', '🦁', '🐉', '🌹', '⭐', '🍀', '🔥']

interface ProgressState {
  name: string
  avatar: string
  xp: number
  winStreak: number
  bestStreak: number
  unlocked: UnlockedAchievement[]
  /** Achievement ids waiting to be shown as a toast. */
  pending: string[]
  /** New level waiting to be celebrated, or null. */
  pendingLevelUp: number | null
  lastLevelReward: number
  lastLevelGems: number

  setName: (name: string) => void
  setAvatar: (avatar: string) => void
  /** Records a finished round: grants XP, updates streak, checks achievements. */
  recordRound: (wagered: number, netDelta: number) => void
  consumePending: () => string | null
  consumeLevelUp: () => { level: number; reward: number } | null
  level: () => number
  progress: () => ReturnType<typeof levelProgress>
  reset: () => void
}

function evaluateAchievements(get: () => ProgressState, set: (p: Partial<ProgressState>) => void) {
  const wallet = useWallet.getState()
  const ctx: AchievementCtx = {
    stats: {
      handsPlayed: wallet.handsPlayed,
      wins: wallet.wins,
      losses: wallet.losses,
      pushes: wallet.pushes,
      blackjacks: wallet.blackjacks,
      biggestWin: wallet.biggestWin,
      totalWagered: wallet.totalWagered,
    },
    balance: wallet.balance,
    level: get().level(),
    winStreak: get().winStreak,
  }

  const already = new Set(get().unlocked.map(u => u.id))
  const fresh = newlyUnlocked(ctx, already)
  if (fresh.length === 0) return

  const now = Date.now()
  set({
    unlocked: [...get().unlocked, ...fresh.map(a => ({ id: a.id, at: now }))],
    pending: [...get().pending, ...fresh.map(a => a.id)],
  })
  // Pay out achievement rewards.
  for (const a of fresh) {
    if (a.reward > 0) wallet.add(a.reward)
  }
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      name: '',
      avatar: AVATARS[0],
      xp: 0,
      winStreak: 0,
      bestStreak: 0,
      unlocked: [],
      pending: [],
      pendingLevelUp: null,
      lastLevelReward: 0,
      lastLevelGems: 0,

      setName: name => set({ name: name.slice(0, 16) }),
      setAvatar: avatar => set({ avatar }),

      recordRound: (wagered, netDelta) => {
        const beforeLevel = get().level()
        const streak = netDelta > 0 ? get().winStreak + 1 : 0
        // Savings pot fills passively; XP boost (if active) doubles the gain.
        usePiggyBank.getState().contribute(wagered)
        const xpGain = xpForRound(wagered, netDelta) * usePowerups.getState().consumeXpTick()
        set({
          xp: get().xp + xpGain,
          winStreak: streak,
          bestStreak: Math.max(get().bestStreak, streak),
        })
        const afterLevel = get().level()

        // Level-up rewards: each new level pays chips (scaling), and level gates
        // already unlock skins/packs, so this just celebrates + credits.
        if (afterLevel > beforeLevel) {
          let reward = 0
          let gems = 0
          for (let lvl = beforeLevel + 1; lvl <= afterLevel; lvl++) {
            reward += lvl * 250
            gems += diamondsForLevel(lvl)
          }
          useWallet.getState().add(reward)
          useDiamonds.getState().add(gems)
          set({ pendingLevelUp: afterLevel, lastLevelReward: reward, lastLevelGems: gems })
        }

        // Rare, rule-gated diamond drop on a winning round (min bet + cooldown +
        // daily cap + chance) — the steady way to earn diamonds through play.
        useDiamonds.getState().maybeDropOnWin(wagered, netDelta)

        evaluateAchievements(get, set)
      },

      consumePending: () => {
        const [next, ...rest] = get().pending
        if (next === undefined) return null
        set({ pending: rest })
        return next
      },

      consumeLevelUp: () => {
        const lvl = get().pendingLevelUp
        if (lvl === null) return null
        const reward = get().lastLevelReward
        set({ pendingLevelUp: null })
        return { level: lvl, reward }
      },

      level: () => levelForXp(get().xp),
      progress: () => levelProgress(get().xp),

      reset: () => set({ xp: 0, winStreak: 0, bestStreak: 0, unlocked: [], pending: [], pendingLevelUp: null }),
    }),
    { name: 'goldenace-progress' }
  )
)

export { ACHIEVEMENTS }
