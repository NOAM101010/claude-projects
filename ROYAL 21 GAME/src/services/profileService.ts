import { db, isRemoteId } from './supabase';
import { localStore, type SaveData } from './localStore';
import { MILESTONE_EVERY, milestoneReward } from '@/data/economy';
import { ITEMS } from '@/data/items';
import type { Equipped, GameKey, Presence, Profile, Stats } from '@/types';

/** XP curve: gentle, background progression (§96) — not a grind. */
export const xpForLevel = (level: number) => 400 + level * 160;

export function applyXp(level: number, xp: number, gain: number) {
  let nextLevel = level;
  let nextXp = xp + gain;
  let levelsGained = 0;
  while (nextXp >= xpForLevel(nextLevel)) {
    nextXp -= xpForLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }
  return { level: nextLevel, xp: nextXp, levelsGained };
}

export const RANKS = [
  { key: 'bronze', he: 'ברונזה', en: 'Bronze', min: 1 },
  { key: 'silver', he: 'כסף', en: 'Silver', min: 8 },
  { key: 'gold', he: 'זהב', en: 'Gold', min: 16 },
  { key: 'platinum', he: 'פלטינה', en: 'Platinum', min: 26 },
  { key: 'diamond', he: 'יהלום', en: 'Diamond', min: 36 },
  { key: 'master', he: 'מאסטר', en: 'Master', min: 50 },
  { key: 'royal', he: 'רויאל', en: 'Royal', min: 70 },
];

export const rankOf = (level: number) =>
  [...RANKS].reverse().find((rank) => level >= rank.min) ?? RANKS[0];

export const profileService = {
  /** Writes the whole device snapshot; cheap and keeps guests working offline. */
  saveLocal(save: SaveData) {
    localStore.write(save);
  },

  /**
   * Pushes the device's view of the player up.
   *
   * Returns whether it landed. This used to be fire-and-forget with the result
   * dropped on the floor, which mattered most in the one place it was awaited:
   * the shop pushes the balance up and then asks the server to charge it. When
   * the update was refused — an expired session, a row that does not exist —
   * `buy_item` went on to charge a stale balance and answered "insufficient
   * chips" to a player looking at a balance ten times the price.
   *
   * Deliberately excludes `chips` and `is_admin`: a `security definer` trigger
   * (`protect_chip_column`, supabase/setup.sql + admin.sql) now rejects any
   * direct write to either column from the `authenticated` role — this used to
   * write `chips` straight through, which meant any signed-in player could open
   * devtools and set their own balance to anything. Chip changes now only ever
   * happen through a chip RPC (`adjustChips` below, `buy_item`,
   * `claim_blackjack_payout`, etc.), which the trigger recognizes because it
   * runs as the function's owner rather than as the client's own role.
   */
  async syncProfile(profile: Profile, stats: Stats): Promise<{ ok: boolean; detail?: string }> {
    const client = db();
    if (!client || !isRemoteId(profile.id)) return { ok: true };
    const { data, error } = await client.from('profiles').update({
      username: profile.username,
      avatar: profile.avatar,
      xp: profile.xp,
      level: profile.level,
      equipped: profile.equipped,
      favorite_game: profile.favoriteGame,
    }).eq('id', profile.id).select('id');
    if (error) return { ok: false, detail: error.message };
    // An update that matches no row is refused RLS or a missing profile; both
    // come back as a silent success from PostgREST.
    if (!data?.length) return { ok: false, detail: 'profile row not writable' };
    await client.from('player_stats').upsert({ user_id: profile.id, ...toStatRow(stats) }, { onConflict: 'user_id' });
    return { ok: true };
  },

  /**
   * The only path a normal (non-admin) client has to move its own balance
   * server-side. Wraps `adjust_chips()`, which clamps the delta to ±100,000
   * and floors at 0 — see supabase/setup.sql. Returns the authoritative new
   * balance, or null if the call didn't land (offline, expired session).
   */
  async adjustChips(delta: number): Promise<number | null> {
    const client = db();
    if (!client || delta === 0) return null;
    const { data, error } = await client.rpc('adjust_chips', { p_delta: Math.round(delta) });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  /** Atomic achievement claim. Returns the new chip balance on first claim,
   *  null if already claimed (so no chips are given twice on a fresh device). */
  async claimAchievement(achievementId: string, reward: number): Promise<number | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('claim_achievement', {
      p_achievement_id: achievementId,
      p_reward: Math.round(reward),
    });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  /** Atomic mission claim, keyed by `<periodKey>:<missionId>`. Returns
   *  `{ granted, new_balance }` — `new_balance` is always the authoritative
   *  balance so the client can delta-correct its optimistic grant. */
  async claimMission(missionId: string, reward: number, periodKey: string): Promise<{ granted: boolean; new_balance: number } | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('claim_mission', {
      p_mission_id: missionId,
      p_reward: Math.round(reward),
      p_period_key: periodKey,
    });
    if (error || !data) return null;
    return data as { granted: boolean; new_balance: number };
  },

  /** Pull the server-authoritative list of already-earned achievement ids. */
  async fetchAchievements(): Promise<string[] | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('fetch_achievements');
    if (error) return null;
    return Array.isArray(data) ? (data as string[]) : null;
  },

  /** Atomic daily bonus claim. Server returns granted/chips/day/comeback. */
  async claimDailyBonus(streakReward: number, comebackBonus: number, comebackThreshold = 3): Promise<{
    granted: boolean; chips: number; day: number; comeback: boolean; new_balance: number;
  } | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('claim_daily_bonus', {
      p_streak_reward: Math.round(streakReward),
      p_comeback_bonus: Math.round(comebackBonus),
      p_comeback_threshold: comebackThreshold,
    });
    if (error || !data) return null;
    return data as { granted: boolean; chips: number; day: number; comeback: boolean; new_balance: number };
  },

  async fetchDailyState(): Promise<{ lastClaim: string | null; day: number } | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('fetch_daily_state');
    if (error || !data) return null;
    return data as { lastClaim: string | null; day: number };
  },

  async setPresence(userId: string, presence: Presence, game: GameKey | null) {
    const client = db();
    if (!client || !isRemoteId(userId)) return;
    await client.from('profiles').update({ presence, current_game: game, last_seen: new Date().toISOString() }).eq('id', userId);
  },

  async equip(userId: string, equipped: Equipped) {
    const client = db();
    if (!client || !isRemoteId(userId)) return;
    await client.from('profiles').update({ equipped }).eq('id', userId);
  },

  async fetchProfile(userId: string) {
    const client = db();
    if (!client || !isRemoteId(userId)) return null;
    const { data } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
    return data;
  },

  async fetchStats(userId: string): Promise<Partial<Stats> | null> {
    const client = db();
    if (!client || !isRemoteId(userId)) return null;
    const { data } = await client.from('player_stats').select('*').eq('user_id', userId).maybeSingle();
    return data ? fromStatRow(data) : null;
  },

  async leaderboard(kind: 'chips' | 'level' | 'bj_wins' | 'best_streak' | 'biggest_win', limit = 20) {
    const client = db();
    if (!client) return [];
    if (kind === 'chips' || kind === 'level') {
      const { data } = await client
        .from('profiles')
        .select('id, username, tag, avatar, level, chips')
        .order(kind === 'chips' ? 'chips' : 'level', { ascending: false })
        .limit(limit);
      return data ?? [];
    }
    const { data } = await client
      .from('leaderboard_view')
      .select('*')
      .order(kind, { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  /**
   * Grants every unclaimed multiple-of-5 level milestone up to `level`, one at
   * a time. Mirrors claim_level_milestone() in supabase/setup.sql exactly, so
   * a signed-in session and a local guest session pay out the same way — the
   * server call is authoritative when there is a server, the local formula
   * only runs for guests who have no row to check against.
   */
  async claimMilestones(userId: string, level: number, lastClaimed: number, owned: string[]): Promise<MilestoneClaim[]> {
    const client = db();
    const results: MilestoneClaim[] = [];

    if (client && isRemoteId(userId)) {
      for (;;) {
        const { data, error } = await client.rpc('claim_level_milestone');
        if (error || !data) break;
        const row = data as { claimed: boolean; level?: number; chips?: number; item?: string | null };
        if (!row.claimed) break;
        results.push({ level: row.level!, chips: row.chips!, item: row.item ?? undefined });
      }
      return results;
    }

    let claimed = lastClaimed;
    const ownedNow = [...owned];
    for (;;) {
      const next = (Math.floor(claimed / 5) + 1) * MILESTONE_EVERY;
      if (next > level) break;
      const { chips, cosmeticChance, rarityPool } = milestoneReward(next);
      let item: string | undefined;
      if (Math.random() < cosmeticChance) {
        const candidates = ITEMS.filter((entry) => rarityPool.includes(entry.rarity) && !ownedNow.includes(entry.id));
        if (candidates.length) {
          item = candidates[Math.floor(Math.random() * candidates.length)].id;
          ownedNow.push(item);
        }
      }
      results.push({ level: next, chips, item });
      claimed = next;
    }
    return results;
  },
};

export interface MilestoneClaim {
  level: number;
  chips: number;
  item?: string;
}

/* snake_case <-> camelCase for the stats table */
/* eslint-disable @typescript-eslint/no-explicit-any */
const toStatRow = (s: Stats) => ({
  games: s.games, wins: s.wins, losses: s.losses, pushes: s.pushes, chips_won: s.chipsWon,
  biggest_bet: s.biggestBet, biggest_win: s.biggestWin, streak: s.streak, best_streak: s.bestStreak,
  bj_hands: s.bjHands, bj_wins: s.bjWins, bj_losses: s.bjLosses, blackjacks: s.blackjacks,
  double_wins: s.doubleWins, split_wins: s.splitWins, bet_total: s.betTotal, bet_count: s.betCount,
  cf_games: s.cfGames, cf_wins: s.cfWins, cf_loss_streak: s.cfLossStreak, sl_spins: s.slSpins,
  sl_wins: s.slWins, sc_cards: s.scCards, dice_games: s.diceGames, hc_games: s.hcGames,
  double_or_nothing: s.doubleOrNothing,
});

const fromStatRow = (r: any): Partial<Stats> => ({
  games: r.games, wins: r.wins, losses: r.losses, pushes: r.pushes, chipsWon: r.chips_won,
  biggestBet: r.biggest_bet, biggestWin: r.biggest_win, streak: r.streak, bestStreak: r.best_streak,
  bjHands: r.bj_hands, bjWins: r.bj_wins, bjLosses: r.bj_losses, blackjacks: r.blackjacks,
  doubleWins: r.double_wins, splitWins: r.split_wins, betTotal: r.bet_total, betCount: r.bet_count,
  cfGames: r.cf_games, cfWins: r.cf_wins, cfLossStreak: r.cf_loss_streak, slSpins: r.sl_spins,
  slWins: r.sl_wins, scCards: r.sc_cards, diceGames: r.dice_games, hcGames: r.hc_games,
  doubleOrNothing: r.double_or_nothing,
});
