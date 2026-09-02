/**
 * The economy, in one file.
 *
 * Chips cannot be bought. They are won at the table, and the free scratch card
 * at the counter is the only safety net. Every game therefore has a house edge
 * small enough that a good Blackjack player grinds upward, and every non-skill
 * game (scratch, coin flip) sits slightly below break-even so cosmetics stay
 * worth something.
 */

import type { Rarity } from '@/types';

export const STARTING_CHIPS = 5000;

/** Table stakes, offered as physical chips before every game. */
export const STAKES = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
export const BLACKJACK_BETS = [10, 25, 50, 100, 250, 500, 1000] as const;

/** Buy-ins for Blackjack vs friends. Everyone puts in, the winner takes the pot. */
export const DUEL_BUYINS = [100, 250, 500, 1000, 2500, 5000] as const;
export const DUEL_TARGETS = [5, 10, 15, 21] as const;
export const DUEL_BEST_OF = [3, 5, 7] as const;
/** In a best-of series every round runs to this many points. */
export const DUEL_ROUND_TARGET = 10;

/* -------------------------------------------------------------------------- */
/* Scratch cards: a small shop of physical cards on the counter.               */
/* Each tier lists its prize table as [prize, weight]; EV is printed by         */
/* `npm run test:economy` so the numbers can never quietly drift.               */
/* -------------------------------------------------------------------------- */
export interface ScratchTier {
  id: string;
  price: number;
  name: { he: string; en: string };
  accent: string;
  symbols: string[];
  /** prize (in chips) -> relative weight */
  table: [number, number][];
}

export const SCRATCH_TIERS: ScratchTier[] = [
  {
    id: 'house',
    price: 0,
    name: { he: 'כרטיס הבית', en: 'House Card' },
    accent: '#8b8f98',
    symbols: ['🪙', '🍀', '🔔', '⭐', '💎'],
    table: [[0, 52], [5, 22], [10, 14], [25, 8], [60, 4]],
  },
  {
    id: 'brass',
    price: 100,
    name: { he: 'פליז', en: 'Brass' },
    accent: '#c08a3e',
    symbols: ['🪙', '🍀', '🔔', '⭐', '💎', '👑'],
    table: [[0, 55], [50, 20], [120, 13], [300, 8], [600, 3], [1500, 1]],
  },
  {
    id: 'silver',
    price: 500,
    name: { he: 'כסף', en: 'Silver' },
    accent: '#b9c0cb',
    symbols: ['🪙', '🍀', '🔔', '⭐', '💎', '👑'],
    table: [[0, 54], [250, 21], [600, 13], [1500, 8], [3500, 3], [9000, 1]],
  },
  {
    id: 'gold',
    price: 2500,
    name: { he: 'זהב', en: 'Gold' },
    accent: '#e3b23c',
    symbols: ['🪙', '🍀', '🔔', '⭐', '💎', '👑'],
    table: [[0, 53], [1200, 21], [3000, 13], [7500, 9], [18000, 3], [45000, 1]],
  },
  {
    id: 'obsidian',
    price: 10000,
    name: { he: 'אובסידיאן', en: 'Obsidian' },
    accent: '#a878f0',
    symbols: ['🪙', '🍀', '🔔', '⭐', '💎', '👑'],
    table: [[0, 53], [5000, 21], [12000, 13], [28000, 9], [60000, 4], [150000, 1]],
  },
];

export const scratchById = (id: string) => SCRATCH_TIERS.find((tier) => tier.id === id);

/** Expected return per card, as a fraction of its price. */
export function scratchRTP(tier: ScratchTier) {
  const weight = tier.table.reduce((sum, [, w]) => sum + w, 0);
  const ev = tier.table.reduce((sum, [prize, w]) => sum + prize * w, 0) / weight;
  return { ev, rtp: tier.price === 0 ? Infinity : ev / tier.price };
}

/** Draws a prize from the weighted table. */
export function rollScratch(tier: ScratchTier, rng: () => number = Math.random) {
  const total = tier.table.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [prize, weight] of tier.table) {
    roll -= weight;
    if (roll <= 0) return prize;
  }
  return 0;
}

/* -------------------------------------------------------------------------- */
/* Shop pricing ladder. Cosmetics are priced in "sessions at the table", not    */
/* in arbitrary numbers: a rare is an evening, a mythic is a good month.        */
/* -------------------------------------------------------------------------- */
export const PRICE_BY_RARITY: Record<string, number> = {
  common: 0,
  rare: 2000,
  epic: 8000,
  legendary: 22000,
  mythic: 55000,
};

/** XP is background progression only (§96): you get it for playing, not grinding. */
export const XP_REWARDS = {
  handPlayed: 4,
  handWon: 12,
  blackjack: 25,
  gameWon: 20,
  duelWon: 60,
  scratchCard: 3,
};

/* -------------------------------------------------------------------------- */
/* VIP tiers: built on the existing level/XP ladder, not a separate currency. */
/* Every tier is a permanent shop discount; buy_item() re-derives the same    */
/* thresholds server-side so the discount can never be spoofed client-side.   */
/* -------------------------------------------------------------------------- */
export interface VipTier {
  tier: 1 | 2 | 3;
  name: { he: string; en: string };
  minLevel: number;
  shopDiscount: number;
}

export const VIP_TIERS: VipTier[] = [
  { tier: 1, name: { he: 'VIP ברונזה', en: 'VIP Bronze' }, minLevel: 1, shopDiscount: 0.05 },
  { tier: 2, name: { he: 'VIP כסף', en: 'VIP Silver' }, minLevel: 16, shopDiscount: 0.10 },
  { tier: 3, name: { he: 'VIP זהב', en: 'VIP Gold' }, minLevel: 36, shopDiscount: 0.15 },
];

export const vipTierOf = (level: number): VipTier =>
  [...VIP_TIERS].reverse().find((t) => level >= t.minLevel) ?? VIP_TIERS[0];

/** Mirrors the discount buy_item() applies server-side — for display and affordability checks only. */
export const discountedPrice = (price: number, level: number) =>
  Math.floor(price * (1 - vipTierOf(level).shopDiscount));

/** Levels between one milestone reward and the next. */
export const MILESTONE_EVERY = 5;

/**
 * What the next unclaimed multiple-of-5 level pays out. Mirrors
 * claim_level_milestone() in supabase/setup.sql exactly — this copy is for
 * client-side display (e.g. "next reward in N levels") only; the server
 * computes and grants the real thing.
 */
export function milestoneReward(level: number) {
  const tier = vipTierOf(level).tier;
  const chips = level * 80;
  const cosmeticChance = tier === 1 ? 0.15 : tier === 2 ? 0.35 : 0.6;
  const rarityPool: Rarity[] = tier === 1 ? ['rare'] : tier === 2 ? ['rare', 'epic'] : ['epic', 'legendary'];
  return { chips, cosmeticChance, rarityPool };
}

/* -------------------------------------------------------------------------- */
/* Login streak: breaks the moment a day is missed, unlike the old fixed      */
/* 7-day ladder it replaces. Stored purely on-device (daily.lastClaim/day),   */
/* same as before — see claimDaily() in usePlayer.ts.                         */
/*                                                                            */
/* Reward ladder — front-loaded so a new user's first week is generous, then  */
/* long streaks unlock big weekly milestones so it is worth keeping the chain */
/* alive past day 30.                                                         */
/*                                                                            */
/*   day  1–3   :   50 base                                                   */
/*   day  4–6   :  100 base                                                   */
/*   day  7     :  500 (7-day milestone)                                      */
/*   day  8–13  :  250 base                                                   */
/*   day 14     : 1000 (2-week milestone)                                     */
/*   day 15–29  :  400 base                                                   */
/*   day 30     : 3000 (monthly milestone)                                    */
/*   day 30+    :  500 base                                                   */
/* -------------------------------------------------------------------------- */
export const STREAK_REWARD = (day: number): number => {
  if (day === 30) return 3000;
  if (day === 14) return 1000;
  if (day === 7) return 500;
  if (day <= 3) return 50;
  if (day <= 6) return 100;
  if (day <= 13) return 250;
  if (day <= 29) return 400;
  return 500;
};

/** Days on which the streak pays a milestone bonus instead of the base amount. */
export const STREAK_MILESTONES = [7, 14, 30] as const;
export const isStreakMilestone = (day: number): boolean =>
  (STREAK_MILESTONES as readonly number[]).includes(day);

/**
 * What claiming right now would pay: day+1 if the last claim was yesterday,
 * back to day 1 the moment a day is skipped. usePlayer.claimDaily() and the
 * Hub's pre-claim preview both call this, so the preview never lies.
 */
export function nextStreakDay(daily: { lastClaim: string | null; day: number }): number {
  if (!daily.lastClaim) return 1;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return daily.lastClaim === yesterday ? daily.day + 1 : 1;
}

/** Daily gift budget, chips/day — enforced server-side in send_gift().
 *  Keep this in sync with the `> 50000` check in supabase/setup.sql. */
export const GIFT_DAILY_LIMIT = 50_000;

/* -------------------------------------------------------------------------- */
/* Comeback bonus: a one-time top-up layered onto the day-1 streak reward     */
/* when the gap since the last claim was long enough to count as "away".      */
/* -------------------------------------------------------------------------- */
export const COMEBACK_THRESHOLD_DAYS = 3;
export const COMEBACK_BONUS = 300;

export const daysSince = (dateKey: string) =>
  Math.floor((Date.now() - new Date(dateKey).getTime()) / 86400000);

/* -------------------------------------------------------------------------- */
/* Weekly friends leaderboard: ranking is just current chip balance (live,    */
/* no snapshot needed) — only the prize cycle needs a server-checked cooldown.*/
/* Mirrors claim_weekly_prize() in supabase/setup.sql.                        */
/* -------------------------------------------------------------------------- */
export const WEEKLY_PRIZE_CHIPS = 1000;
