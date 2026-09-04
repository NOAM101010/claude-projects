import { useEffect, useState } from 'react';
import { db, isOnline } from '@/services/supabase';
import {
  GIFT_DAILY_LIMIT,
  MISSION_ALL_DONE_BONUS,
  MAX_MISSION_REWARD,
  WEEKLY_PODIUM,
  REFERRER_TIERS,
  STREAK_REWARD,
} from '@/data/economy';
import { VIP_TIER_PERKS } from '@/data/vip';

/**
 * Live economy constants (public.app_config), with the hard-coded values in
 * src/data/economy.ts as the fallback. An admin tunes these from the admin
 * panel; every server RPC that consumes them carries the same fallback, so a
 * missing table or an offline client just sees the shipped numbers.
 *
 * Fetched once per session and memoised — these move rarely and a stale value
 * for a few minutes is harmless (it's display only; the server is the truth).
 */

export interface AppConfig {
  giftDailyLimit: number;
  missionAllDoneBonus: number;
  maxMissionReward: number;
  weeklyPodium: readonly number[];
  referrerTiers: readonly number[];
  /** Baccarat Banker win multiplier (profit paid on a winning Banker bet).
   *  0.95 = classic 5% commission; 1.0 = no commission. Clamped to 0..1. */
  baccaratBankerPayout: number;
  /** Reward for a given streak day — reads the live ladder, else STREAK_REWARD. */
  streakReward: (day: number) => number;
  /** VIP daily bonus for a tier (1..4) — live `vip_daily`, else VIP_TIER_PERKS. */
  vipDaily: (tier: 1 | 2 | 3 | 4) => number;
  /** VIP weekly cashback fraction for a tier — live `vip_cashback_pct`, else perks. */
  vipCashbackPct: (tier: 1 | 2 | 3 | 4) => number;
  /** VIP weekly stipend for a tier — live `vip_stipend`, else VIP_TIER_PERKS. */
  vipStipend: (tier: 1 | 2 | 3 | 4) => number;
}

const DEFAULT_BANKER_PAYOUT = 0.95;

const FALLBACK: AppConfig = {
  giftDailyLimit: GIFT_DAILY_LIMIT,
  missionAllDoneBonus: MISSION_ALL_DONE_BONUS,
  maxMissionReward: MAX_MISSION_REWARD,
  weeklyPodium: WEEKLY_PODIUM,
  referrerTiers: REFERRER_TIERS,
  baccaratBankerPayout: DEFAULT_BANKER_PAYOUT,
  streakReward: STREAK_REWARD,
  vipDaily: (tier) => VIP_TIER_PERKS[tier].dailyBonus,
  vipCashbackPct: (tier) => VIP_TIER_PERKS[tier].cashbackPct,
  vipStipend: (tier) => VIP_TIER_PERKS[tier].weeklyStipend,
};

/** Read one numeric field of an object-valued config key ({"1": 10000, ...}). */
const objNum = (raw: unknown, key: string | number, fallback: number): number => {
  if (raw && typeof raw === 'object') {
    const v = (raw as Record<string, unknown>)[String(key)];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return fallback;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

let cache: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const arr = (v: unknown, fallback: readonly number[]): readonly number[] =>
  Array.isArray(v) && v.every((n) => typeof n === 'number') ? (v as number[]) : fallback;

function build(raw: Record<string, unknown>): AppConfig {
  const ladder = (raw.streak_rewards ?? null) as Record<string, number> | null;
  return {
    giftDailyLimit: num(raw.gift_daily_limit, FALLBACK.giftDailyLimit),
    missionAllDoneBonus: num(raw.mission_all_done_bonus, FALLBACK.missionAllDoneBonus),
    maxMissionReward: num(raw.max_mission_reward, FALLBACK.maxMissionReward),
    weeklyPodium: arr(raw.weekly_podium, FALLBACK.weeklyPodium),
    referrerTiers: arr(raw.referrer_tiers, FALLBACK.referrerTiers),
    baccaratBankerPayout: clamp01(num(raw.baccarat_banker_payout, FALLBACK.baccaratBankerPayout)),
    streakReward: (day: number) => {
      if (!ladder) return STREAK_REWARD(day);
      const key =
        day === 30 ? '30' : day === 14 ? '14' : day === 7 ? '7'
        : day <= 3 ? '1-3' : day <= 6 ? '4-6' : day <= 13 ? '8-13' : day <= 29 ? '15-29' : '31+';
      const v = ladder[key];
      return typeof v === 'number' ? v : STREAK_REWARD(day);
    },
    vipDaily: (tier) => objNum(raw.vip_daily, tier, VIP_TIER_PERKS[tier].dailyBonus),
    vipCashbackPct: (tier) => objNum(raw.vip_cashback_pct, tier, VIP_TIER_PERKS[tier].cashbackPct),
    vipStipend: (tier) => objNum(raw.vip_stipend, tier, VIP_TIER_PERKS[tier].weeklyStipend),
  };
}

async function fetchConfig(): Promise<AppConfig> {
  const client = db();
  if (!isOnline() || !client) return FALLBACK;
  try {
    const { data, error } = await client.rpc('get_app_config');
    if (error || !data || typeof data !== 'object') return FALLBACK;
    return build(data as Record<string, unknown>);
  } catch {
    return FALLBACK;
  }
}

/** Reactive access to the live economy config. Returns the fallback until the
 *  first fetch resolves, so it is always safe to read synchronously. */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(cache ?? FALLBACK);

  useEffect(() => {
    if (cache) return;
    inflight ??= fetchConfig();
    let alive = true;
    void inflight.then((c) => {
      cache = c;
      if (alive) setConfig(c);
    });
    return () => { alive = false; };
  }, []);

  return config;
}
