import type { Profile } from '@/types';

/**
 * VIP status.
 *
 * The bar is deliberately in two dimensions — you can't just farm streak
 * rewards or wait for daily login top-ups to squeak in. You need level AND
 * balance, so every VIP player has actually played their way there.
 */
export const VIP_MIN_LEVEL = 5;
export const VIP_MIN_CHIPS = 150_000;
export const VIP_DAILY_BONUS = 10_000;

/** High-stakes coin flip bets — VIP only. */
export const VIP_COINFLIP_STAKES = [5000, 10000, 25000, 50000, 100000] as const;
/** High-stakes high card bets — VIP only. */
export const VIP_HIGHCARD_STAKES = [5000, 10000, 25000, 50000, 100000] as const;
/** High-stakes blackjack bets — VIP only. Larger than the base BetRail options
 *  so a VIP has something to spend seven figures of chips on at the felt. */
export const VIP_BLACKJACK_BETS = [5000, 10000, 25000, 50000, 100000] as const;

/** VIP is sticky: once a player has qualified (level + chips at the same
 *  time), they stay VIP forever — losing chips at the tables shouldn't
 *  lock them out of the room they just qualified for. `everVip` on the
 *  profile is stamped the first time both thresholds are met. */
export function isVipEligible(profile: Profile): boolean {
  if (profile.everVip) return true;
  return profile.level >= VIP_MIN_LEVEL && profile.chips >= VIP_MIN_CHIPS;
}

/** True the moment a player crosses BOTH thresholds — call from anywhere
 *  the profile updates so we can flip `everVip` on. */
export function shouldMarkEverVip(profile: Profile): boolean {
  if (profile.everVip) return false;
  return profile.level >= VIP_MIN_LEVEL && profile.chips >= VIP_MIN_CHIPS;
}

/** How close a not-yet-VIP player is — used for the progress card. */
export interface VipProgress {
  eligible: boolean;
  level: { current: number; target: number; done: boolean };
  chips: { current: number; target: number; done: boolean };
}

export function vipProgress(profile: Profile): VipProgress {
  const levelDone = profile.level >= VIP_MIN_LEVEL;
  const chipsDone = profile.chips >= VIP_MIN_CHIPS;
  return {
    eligible: levelDone && chipsDone,
    level: { current: profile.level, target: VIP_MIN_LEVEL, done: levelDone },
    chips: { current: profile.chips, target: VIP_MIN_CHIPS, done: chipsDone },
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
