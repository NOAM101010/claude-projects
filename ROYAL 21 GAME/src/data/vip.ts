import type { Profile } from '@/types';

/**
 * VIP club — a level-only ladder.
 *
 * Eligibility is a single dimension now: reach level 5 and you're in, for good.
 * Chips no longer gate it (you can't be locked out of the room you earned by
 * having a bad night at the tables), and there is no sticky `everVip` flag to
 * derive — level only ever goes up.
 *
 * Above the entry bar sit four tiers (Bronze/Silver/Gold/Diamond), each with a
 * bigger daily bonus, cashback, a weekly stipend and exclusive cosmetics. The
 * server (supabase/vip.sql) re-derives the tier from `profiles.level` on every
 * claim, so the perks can't be spoofed client-side.
 */
export const VIP_MIN_LEVEL = 5;

/** The four extra high-stakes chips appended to the base rail for VIP-eligible
 *  players — same set in every game, so `[...BASE, ...VIP_CHIP_EXTRA]` is the
 *  one pattern for a VIP rail everywhere. */
export const VIP_CHIP_EXTRA = [25000, 50000, 100000, 250000] as const;

/** VIP eligibility — level only. */
export function isVipEligible(profile: Profile): boolean {
  return profile.level >= VIP_MIN_LEVEL;
}

/* -------------------------------------------------------------------------- */
/* VIP tiers — 0 = not VIP, 1 Bronze, 2 Silver, 3 Gold, 4 Diamond.            */
/* Keep VIP_TIER_LEVELS + vipTier() in sync with vip_tier_of() in vip.sql.    */
/* -------------------------------------------------------------------------- */
export type VipTierId = 0 | 1 | 2 | 3 | 4;

/** Level at which each tier (1..4) begins. */
export const VIP_TIER_LEVELS = [5, 12, 22, 35] as const;

export function vipTier(level: number): VipTierId {
  if (level >= VIP_TIER_LEVELS[3]) return 4;
  if (level >= VIP_TIER_LEVELS[2]) return 3;
  if (level >= VIP_TIER_LEVELS[1]) return 2;
  if (level >= VIP_TIER_LEVELS[0]) return 1;
  return 0;
}

const TIER_NAMES = ['—', 'Bronze', 'Silver', 'Gold', 'Diamond'] as const;
export const vipTierName = (tier: VipTierId): string => TIER_NAMES[tier];
/** i18n key for a tier's display name — `vip.tier.bronze` etc. */
export const vipTierKey = (tier: VipTierId): string =>
  tier === 0 ? 'vip.tier.none' : `vip.tier.${TIER_NAMES[tier].toLowerCase()}`;

/** The next tier a player can reach and the level it unlocks at — null at max. */
export function nextVipTier(level: number): { tier: VipTierId; atLevel: number } | null {
  const current = vipTier(level);
  if (current >= 4) return null;
  const tier = (current + 1) as VipTierId;
  return { tier, atLevel: VIP_TIER_LEVELS[tier - 1] };
}

/* -------------------------------------------------------------------------- */
/* Per-tier perks. Amounts mirror supabase/vip.sql + app_config fallbacks.    */
/* -------------------------------------------------------------------------- */
export interface VipTierPerks {
  dailyBonus: number;
  cashbackPct: number;
  weeklyStipend: number;
  highStakes: boolean;
  exclusiveFrame: string;
  exclusiveTitle: string;
  exclusiveNameColor: string;
  /** Diamond only — a legendary table + victory effect on top of the rest. */
  exclusiveTable?: string;
  exclusiveVictory?: string;
}

export const VIP_TIER_PERKS: Record<1 | 2 | 3 | 4, VipTierPerks> = {
  1: {
    dailyBonus: 10000, cashbackPct: 0, weeklyStipend: 0, highStakes: true,
    exclusiveFrame: 'fr_vip_bronze', exclusiveTitle: 'ttl_vip_bronze', exclusiveNameColor: 'nc_vip_bronze',
  },
  2: {
    dailyBonus: 20000, cashbackPct: 0.03, weeklyStipend: 0, highStakes: true,
    exclusiveFrame: 'fr_vip_silver', exclusiveTitle: 'ttl_vip_silver', exclusiveNameColor: 'nc_vip_silver',
  },
  3: {
    dailyBonus: 40000, cashbackPct: 0.05, weeklyStipend: 25000, highStakes: true,
    exclusiveFrame: 'fr_vip_gold', exclusiveTitle: 'ttl_vip_gold', exclusiveNameColor: 'nc_vip_gold',
  },
  4: {
    dailyBonus: 80000, cashbackPct: 0.10, weeklyStipend: 75000, highStakes: true,
    exclusiveFrame: 'fr_vip_diamond', exclusiveTitle: 'ttl_vip_diamond', exclusiveNameColor: 'nc_vip_diamond',
    exclusiveTable: 'tb_vip_diamond', exclusiveVictory: 'vc_vip_diamond',
  },
};

export const vipPerksFor = (level: number): VipTierPerks | null => {
  const tier = vipTier(level);
  return tier === 0 ? null : VIP_TIER_PERKS[tier];
};

/** How close a not-yet-VIP player is — used for the lock-screen progress bar. */
export interface VipProgress {
  eligible: boolean;
  level: { current: number; target: number; done: boolean };
}

export function vipProgress(profile: Profile): VipProgress {
  const done = profile.level >= VIP_MIN_LEVEL;
  return {
    eligible: done,
    level: { current: profile.level, target: VIP_MIN_LEVEL, done },
  };
}

/** High Roller stakes only available to VIPs. */
export const VIP_HIGH_ROLLER_STAKES = [
  { sb: 500,   bb: 1000,  label: '500 / 1K' },
  { sb: 2500,  bb: 5000,  label: '2.5K / 5K' },
  { sb: 5000,  bb: 10000, label: '5K / 10K' },
] as const;

/** VIP-only tournament buy-ins. */
export const VIP_TOURNAMENT_BUYINS = [50_000, 100_000, 250_000] as const;
