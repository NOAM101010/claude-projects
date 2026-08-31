import { Stats } from '../state/useWallet'

export interface AchievementCtx {
  stats: Stats
  balance: number
  level: number
  /** Current consecutive-win streak. */
  winStreak: number
  /** Largest single win this session or ever (from stats.biggestWin). */
}

export interface Achievement {
  id: string
  name: string
  description: string
  /** Chips awarded on unlock. */
  reward: number
  xp: number
  test: (c: AchievementCtx) => boolean
}

/**
 * All achievements. `test` is a pure predicate over the player's aggregate
 * state, so evaluation is a single pass after any event and needs no history.
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-hand', name: 'צעד ראשון', description: 'שחק את היד הראשונה',
    reward: 100, xp: 20, test: c => c.stats.handsPlayed >= 1,
  },
  {
    id: 'first-blackjack', name: "בלאק ג'ק!", description: "עשה בלאק ג'ק ראשון",
    reward: 250, xp: 40, test: c => c.stats.blackjacks >= 1,
  },
  {
    id: 'streak-5', name: 'ברצף', description: 'נצח 5 ידיים ברצף',
    reward: 500, xp: 60, test: c => c.winStreak >= 5,
  },
  {
    id: 'big-win-10k', name: 'זכייה גדולה', description: 'זכה מעל 10,000 ביד אחת',
    reward: 1000, xp: 100, test: c => c.stats.biggestWin >= 10000,
  },
  {
    id: 'hands-100', name: 'ותיק', description: 'שחק 100 ידיים',
    reward: 500, xp: 80, test: c => c.stats.handsPlayed >= 100,
  },
  {
    id: 'rich-25k', name: 'עשיר', description: 'הגע ליתרה של 25,000',
    reward: 0, xp: 120, test: c => c.balance >= 25000,
  },
  {
    id: 'level-10', name: 'מקצוען', description: 'הגע לרמה 10',
    reward: 2000, xp: 0, test: c => c.level >= 10,
  },
  {
    id: 'wins-50', name: 'מנצח', description: 'נצח 50 ידיים',
    reward: 750, xp: 90, test: c => c.stats.wins >= 50,
  },
]

/** Achievements newly satisfied that are not already in `unlocked`. */
export function newlyUnlocked(ctx: AchievementCtx, unlocked: Set<string>): Achievement[] {
  return ACHIEVEMENTS.filter(a => !unlocked.has(a.id) && a.test(ctx))
}
