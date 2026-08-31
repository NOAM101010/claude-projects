import { GameId } from '../state/useApp'

/** The level ceiling — reaching it shows "MAX" and stops further level-ups. */
export const MAX_LEVEL = 30

/**
 * XP needed to reach a given level. A short curve (exponent 1.5) so climbing to
 * the level-30 cap is a reasonable ~few-hundred rounds rather than an endless
 * grind. Progression comes from rounds PLAYED, not bet size (see xpForRound).
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.round(60 * Math.pow(level - 1, 1.5))
}

/** Total level reached for a given cumulative XP, capped at MAX_LEVEL. */
export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++
  return level
}

/** Progress within the current level, 0..1, plus the raw XP bounds. */
export function levelProgress(xp: number): { level: number; into: number; span: number; frac: number } {
  const level = levelForXp(xp)
  if (level >= MAX_LEVEL) return { level, into: 0, span: 0, frac: 1 }
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const span = next - base
  const into = xp - base
  return { level, into, span, frac: span > 0 ? into / span : 1 }
}

export interface TableTier {
  id: string
  game: GameId
  name: string
  minBet: number
  maxBet: number
  /** Level required to unlock. */
  unlockLevel: number
}

/**
 * Every playable table across the games, gated by level. The lobby shows locked
 * tiers with their requirement; a game opens at the highest tier the player has
 * unlocked.
 */
export const TABLE_TIERS: TableTier[] = [
  { id: 'bj-bronze', game: 'blackjack', name: 'שולחן ברונזה', minBet: 10, maxBet: 2500, unlockLevel: 1 },
  { id: 'bj-silver', game: 'blackjack', name: 'שולחן כסף', minBet: 50, maxBet: 10000, unlockLevel: 5 },
  { id: 'bj-gold', game: 'blackjack', name: 'שולחן זהב', minBet: 200, maxBet: 50000, unlockLevel: 12 },

  { id: 'slots-classic', game: 'slots', name: 'מכונה קלאסית', minBet: 10, maxBet: 1000, unlockLevel: 1 },
  { id: 'slots-deluxe', game: 'slots', name: 'מכונת דלוקס', minBet: 50, maxBet: 10000, unlockLevel: 8 },

  { id: 'roul-euro', game: 'roulette', name: 'רולטה אירופית', minBet: 10, maxBet: 10000, unlockLevel: 3 },
  { id: 'roul-gold', game: 'roulette', name: 'רולטה זהב', minBet: 100, maxBet: 100000, unlockLevel: 12 },

  { id: 'scratch-basic', game: 'scratch', name: 'כרטיסי גירוד', minBet: 100, maxBet: 10000, unlockLevel: 2 },
]

/**
 * VIP high-roller tables. These are OPT-IN (entered only from the VIP salon), not
 * part of the normal auto-selected tier ladder — so reaching a high level never
 * traps a regular player at a steep minimum. Defined by a very high MINIMUM
 * buy-in (50K) with huge ceilings.
 */
export const VIP_TIERS: TableTier[] = [
  { id: 'roul-vip', game: 'roulette', name: 'רולטה VIP', minBet: 50000, maxBet: 5000000, unlockLevel: 20 },
  { id: 'slots-vip', game: 'slots', name: 'מכונת VIP', minBet: 50000, maxBet: 2000000, unlockLevel: 20 },
]

export function vipTiers(): TableTier[] {
  return VIP_TIERS
}

export function vipTierForGame(game: GameId): TableTier | null {
  return VIP_TIERS.find(t => t.game === game) ?? null
}

export function tiersForGame(game: GameId): TableTier[] {
  return TABLE_TIERS.filter(t => t.game === game)
}

/** The lowest level at which a game becomes playable at all. */
export function gameUnlockLevel(game: GameId): number {
  return Math.min(...tiersForGame(game).map(t => t.unlockLevel))
}

/** Highest tier the player may sit at right now. */
export function highestUnlockedTier(game: GameId, level: number): TableTier | null {
  const unlocked = tiersForGame(game).filter(t => t.unlockLevel <= level)
  if (unlocked.length === 0) return null
  return unlocked.reduce((a, b) => (b.unlockLevel > a.unlockLevel ? b : a))
}

/**
 * XP awarded for a round. Deliberately CAPPED and only weakly tied to the wager
 * so leveling depends on how many rounds you play, not how big you bet — a whale
 * betting 50K can't buy multiple levels in one spin.
 */
export function xpForRound(wagered: number, netDelta: number): number {
  const base = Math.min(20, 6 + Math.floor(wagered / 500))
  const winBonus = netDelta > 0 ? Math.min(15, Math.floor(netDelta / 1000)) : 0
  return base + winBonus
}
