import { create } from 'zustand';
import { ACHIEVEMENTS } from '@/data/achievements';
import { itemById } from '@/data/items';
import {
  STREAK_REWARD, discountedPrice, nextStreakDay, COMEBACK_THRESHOLD_DAYS, COMEBACK_BONUS, daysSince,
} from '@/data/economy';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import { todayKey, fmt } from '@/lib/format';
import { applyXp, profileService } from '@/services/profileService';
import { shopService } from '@/services/shopService';
import { authService } from '@/services/authService';
import { adminService } from '@/services/adminService';
import { analytics } from '@/services/analyticsService';
import { isRemoteId } from '@/services/supabase';
import {
  localStore, emptySave, EMPTY_STATS, DEFAULT_EQUIPPED, type ActivityEntry, type SaveData,
} from '@/services/localStore';
import { useUI } from './useUI';
import { useSettings } from './useSettings';
import { shouldMarkEverVip } from '@/data/vip';
import type { AvatarConfig, GameKey, Profile, Stats } from '@/types';

interface PlayerState extends SaveData {
  ready: boolean;
  /** Chips currently committed to a hand, so the HUD can show them separately. */
  staked: number;

  hydrate: () => Promise<void>;
  /** Pull the authoritative chip balance from the server and stamp it locally.
   *  Called on tab-visible so a device that was in the background picks up
   *  what the same account earned/lost on another device. */
  refreshFromServer: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  setAvatar: (avatar: AvatarConfig) => void;
  addChips: (delta: number, opts?: { silent?: boolean; localOnly?: boolean }) => void;
  setChips: (value: number) => void;
  addXp: (gain: number) => void;
  recordResult: (game: GameKey, outcome: 'win' | 'lose' | 'push', net: number, extra?: Partial<Stats>) => void;
  bumpStat: (patch: Partial<Stats>) => void;
  /** Resolves with why it failed, so the shop can say something instead of nothing. */
  buy: (itemId: string) => Promise<{ ok: boolean; reason?: string; detail?: string }>;
  /** Records one settled round against everyone else at the table. */
  recordRivalry: (game: GameKey, myNet: number, opponents: { userId: string; net: number }[]) => void;
  equip: (itemId: string) => void;
  toggleFavorite: (itemId: string) => void;
  claimDaily: () => { chips: number; day: number; comeback: boolean } | null;
  /** Grants any level milestones (every 5 levels) reached but not yet claimed. */
  claimMilestones: () => Promise<void>;
  markWheelSpin: () => void;
  markIntroSeen: () => void;
  /** Ends the session and forgets the identity. Not the same as reset(). */
  signOut: () => Promise<void>;
  /** Wipes progress but stays signed in as the same player. */
  reset: () => void;
  persist: () => void;
}

/* An admin never runs out. `isAdmin` arrives from the profile row, so setting
   it locally buys nothing: the balance still has to survive `profiles_update_self`
   on the way up, and every real admin power re-checks the flag in the database. */
const ADMIN_FLOOR = 1_000_000;
const ADMIN_TOPUP = 999_999_999;
const withAdminFloor = (profile: Profile): Profile =>
  profile.isAdmin && profile.chips < ADMIN_FLOOR ? { ...profile, chips: ADMIN_TOPUP } : profile;

/*
 * Chips can no longer be pushed to the server as a raw column write (see
 * profileService.syncProfile) — a `security definer` trigger rejects it. Every
 * *other* mutation in this store (addChips, addXp, claimDaily,
 * checkAchievements) still updates `profile.chips` locally-only, the same way
 * it always has, for a UI that reacts instantly. This tracks the last balance
 * we know the server actually holds per profile, so persist() can push just
 * the difference through a chip RPC — adjust_chips() for a normal delta,
 * admin_set_chips() for an admin account's floor top-up, since that jump is
 * far bigger than adjust_chips' ±100,000 clamp allows in one call.
 *
 * A handful of actions (setChips, the remote branch of claimMilestones, a
 * confirmed shop purchase) already get an authoritative balance back from
 * their own RPC — those stamp this map directly instead of going through
 * adjustChips, so the balance they already confirmed is never pushed twice.
 */
const lastSyncedChips: Record<string, number> = {};

/*
 * Chip reconciliation MUST be serialised per profile.
 *
 * persist() fires reconcileChips() without awaiting it, and a single hand can
 * fire several addChips() in quick succession (place a bet, get paid, place
 * three bets on the felt…). If two reconciles run concurrently they both read
 * the same stale `known`, each computes a delta against it, and adjust_chips —
 * which ADDS a delta server-side — applies both. The two sides then drift: the
 * server total no longer matches the local one, and the "correct the HUD to the
 * server balance" step makes the on-screen number lurch down then up and lose
 * chips. That is the "money randomly goes up/down / vanishes in every game"
 * bug. Chaining every reconcile behind the previous one for that profile makes
 * each run read the *current* balance and the *current* `known`, so redundant
 * runs collapse to a no-op instead of double-pushing.
 */
const reconcileChain: Record<string, Promise<void>> = {};

function reconcileChips(profile: Profile): void {
  if (!isRemoteId(profile.id)) return;
  const id = profile.id;
  const prev = reconcileChain[id] ?? Promise.resolve();
  reconcileChain[id] = prev.then(() => runReconcile(id)).catch(() => {});
}

/* A single reconcile can only move ±100,000 (the adjust_chips clamp). A bigger
   true movement — a >100k bet, a VIP high-stakes payout, a large refund — is
   pushed in 100k slices, each slice chained behind the last on reconcileChain.
   This caps how many follow-up slices one movement may schedule: a safety valve
   against an ill-behaved server that never converges, never hit in normal play
   (a 20M swing would need every slice). */
const MAX_RECONCILE_SLICES = 200;

async function runReconcile(id: string, slice = 0): Promise<void> {
  // Read the CURRENT profile, never a snapshot taken when persist() ran — by
  // the time this dequeues, the balance may have moved again.
  const state = usePlayer.getState();
  if (state.profile.id !== id) return; // signed out or switched account
  const profile = state.profile;
  const known = lastSyncedChips[id];
  if (known === undefined) {
    lastSyncedChips[id] = profile.chips;
    return;
  }
  if (profile.chips === known) return;
  if (profile.isAdmin) {
    const balance = await adminService.setChips(profile.chips);
    if (typeof balance === 'number') lastSyncedChips[id] = balance;
    return;
  }
  // Clamp per adjust_chips' ±100,000 limit; a bigger true delta rides along on
  // the next queued reconcile, which reads the fresh remainder.
  const rawDelta = profile.chips - known;
  const delta = Math.max(-100000, Math.min(100000, rawDelta));
  const balance = await profileService.adjustChips(delta);
  if (typeof balance !== 'number') return;
  lastSyncedChips[id] = balance;
  // Only the *surprise* (server floor at 0, a change from another device) needs
  // to reach the HUD, and it's applied as a DELTA against the current balance —
  // never an overwrite. An overwrite would stomp any addChips() that landed
  // while this RPC was in flight; adding just the surprise preserves it, and
  // the queued follow-up reconcile pushes whatever remains.
  const surprise = balance - (known + delta);
  if (surprise !== 0) {
    const cur = usePlayer.getState();
    if (cur.profile.id === id) {
      usePlayer.setState({ profile: { ...cur.profile, chips: Math.max(0, Math.round(cur.profile.chips + surprise)) } });
    }
  }

  // The ±100,000 clamp only pushed a slice of a larger movement (a >100k bet, a
  // VIP-stakes payout, a big refund). Without this, the remainder sat unsynced
  // until some *unrelated* chip activity happened to trigger another reconcile —
  // and if the HUD meanwhile settled back so that profile.chips === known again,
  // runReconcile's early return dropped the remainder for good. Chain a
  // follow-up run on the SAME per-profile promise (never a parallel reconcile —
  // Round 10) so the balance converges in 100k steps in either direction.
  if (delta !== rawDelta) {
    const cur = usePlayer.getState();
    if (cur.profile.id !== id) return;
    const remaining = cur.profile.chips - lastSyncedChips[id];
    // Stop conditions: gap closed, gap no longer shrinking (server not keeping
    // up — let the next persist() retry instead of spinning), or slice cap hit.
    if (remaining === 0) return;
    if (Math.abs(remaining) >= Math.abs(rawDelta)) return;
    if (slice + 1 >= MAX_RECONCILE_SLICES) return;
    reconcileChain[id] = (reconcileChain[id] ?? Promise.resolve())
      .then(() => runReconcile(id, slice + 1))
      .catch(() => {});
  }
}

/**
 * Migrate ownership of any premium coin the player bought while it was a
 * client-only item (before it became a real server row). Such a coin sits in
 * the local save but is missing from user_items, so a sign-out — which clears
 * localStorage — used to lose it and the chips spent on it. On hydrate we push
 * each locally-owned-but-server-missing coin back up, best-effort. Fire and
 * forget: it must never block or fail the hydrate.
 */
function healClientOnlyItems(userId: string, localOwned: string[], ownedRemote: string[] | null) {
  if (!isRemoteId(userId)) return;
  const remote = new Set(ownedRemote ?? []);
  const orphans = localOwned.filter((id) => {
    if (remote.has(id)) return false;
    return itemById(id)?.dailyRarityOnly === true;
  });
  for (const id of orphans) void shopService.grantOwned(userId, id);
}

/** Nobody, signed in nowhere. An empty id is what the router reads as "logged out". */
const blankProfile = (): Profile => ({
  id: '', username: '', tag: '#0000',
  avatar: { skin: 0, hair: 0, shirt: 'base' },
  chips: 0, xp: 0, level: 1, lastMilestoneClaimed: 0,
  joinedAt: new Date().toISOString(),
  presence: 'offline', currentGame: null, isGuest: true,
  equipped: { ...DEFAULT_EQUIPPED }, favoriteGame: null,
});

export const usePlayer = create<PlayerState>()((set, get) => ({
  // A complete, empty profile so nothing can read undefined before hydrate().
  ...emptySave(blankProfile()),
  ready: false,
  staked: 0,

  persist: () => {
    const s = get();
    // Signed out: there is nobody to save. Writing here would put the blank
    // profile back on disk and undo the sign-out on the next boot.
    if (!s.profile.id) return;
    const save: SaveData = {
      profile: s.profile, stats: s.stats, owned: s.owned, favorites: s.favorites,
      achievements: s.achievements, notifications: s.notifications, activity: s.activity,
      rivalries: s.rivalries, daily: s.daily, wheel: s.wheel, seenIntro: s.seenIntro,
    };
    localStore.write(save);
    /* Daily gift + streak also live under a per-profile mirror key so a wonky
       hydrate — or a corrupted main save — can never let the player claim the
       same day's reward twice. claimDaily reads this mirror before granting. */
    localStore.writeDaily(s.profile.id, s.daily);
    void profileService.syncProfile(s.profile, s.stats);
    void reconcileChips(s.profile);
  },

  hydrate: async () => {
    const saved = localStore.read();
    const restored = await authService.restore();

    /* Read the daily mirror alongside the main save. If it disagrees with what
       the save says, the mirror wins — it is the source of truth for whether
       today's gift was already collected. */
    const preferDaily = (profileId: string, fallback: SaveData['daily']) => {
      const mirror = localStore.readDaily(profileId);
      if (!mirror) return fallback;
      if (mirror.lastClaim && (!fallback.lastClaim || mirror.lastClaim > fallback.lastClaim)) return mirror;
      return fallback;
    };

    /* Merging `equipped` requires care: the DB row's `equipped` is authoritative
       for slots the server knows about, but any newer client-only slot (e.g.
       currencySkin, added after the schema was seeded) is still valid and only
       lives in the local save. Overwriting the whole object with the DB's copy
       silently strips those slots on every refresh. Merge shallowly instead. */
    const mergeEquipped = (
      remote: import('@/types').Equipped | undefined,
      local: import('@/types').Equipped | undefined,
    ): import('@/types').Equipped => ({ ...(remote ?? DEFAULT_EQUIPPED), ...(local ?? {}) });

    if (saved && restored && saved.profile.id === restored.id) {
      const daily = preferDaily(restored.id, saved.daily);
      const equipped = mergeEquipped(restored.equipped, saved.profile.equipped);
      set({ ...saved, daily, profile: { ...saved.profile, ...restored, equipped }, ready: true });
      analytics.setUser(restored.id);
      /* Server-authoritative reads for the three things a stale localStorage
         could otherwise let you re-claim: owned items, achievements, and the
         daily bonus. Merge (not replace) owned so client-only exclusives
         stick; adopt achievements outright — the server list is the truth
         of "already earned" and the client shouldn't be allowed to lose it;
         adopt daily too so a device that missed today can't grant the gift. */
      const [ownedRemote, achRemote, dailyRemote] = await Promise.all([
        shopService.ownedIds(restored.id),
        profileService.fetchAchievements(),
        profileService.fetchDailyState(),
      ]);
      healClientOnlyItems(restored.id, get().owned, ownedRemote);
      const patch: Partial<PlayerState> = {};
      if (ownedRemote?.length) patch.owned = Array.from(new Set([...get().owned, ...ownedRemote]));
      if (achRemote) patch.achievements = Array.from(new Set([...get().achievements, ...achRemote]));
      if (dailyRemote && dailyRemote.lastClaim) patch.daily = dailyRemote;
      if (Object.keys(patch).length > 0) set(patch);
      return;
    }

    if (restored) {
      const remoteStats = await profileService.fetchStats(restored.id);
      // A save belonging to a different player must not be carried into this
      // account — that is how one person's chips ended up on another's profile.
      const base = saved?.profile.id === restored.id ? saved : emptySave(restored);
      const daily = preferDaily(restored.id, base.daily);
      const equipped = mergeEquipped(restored.equipped, base.profile.equipped);
      set({
        ...base,
        daily,
        profile: { ...restored, equipped },
        stats: { ...EMPTY_STATS, ...base.stats, ...(remoteStats ?? {}) },
        ready: true,
      });
      analytics.setUser(restored.id);
      const [ownedRemote, achRemote, dailyRemote] = await Promise.all([
        shopService.ownedIds(restored.id),
        profileService.fetchAchievements(),
        profileService.fetchDailyState(),
      ]);
      healClientOnlyItems(restored.id, get().owned, ownedRemote);
      const patch: Partial<PlayerState> = {};
      if (ownedRemote?.length) patch.owned = Array.from(new Set([...get().owned, ...ownedRemote]));
      if (achRemote?.length) patch.achievements = Array.from(new Set([...get().achievements, ...achRemote]));
      if (dailyRemote && dailyRemote.lastClaim) patch.daily = dailyRemote;
      if (Object.keys(patch).length > 0) set(patch);
      return;
    }

    /* No session and nothing local to fall back on. restore() already refuses
       to hand back a signed-in account's save without its session, so anything
       still here is a device-local guest. Anything else is signed out, and the
       store has to say so — keeping the old id was what made "sign out" look
       like it had done nothing and made every later request 403. */
    if (saved && saved.profile.id.startsWith('guest_')) {
      const daily = preferDaily(saved.profile.id, saved.daily);
      set({ ...saved, daily, ready: true });
      return;
    }
    set({ ...emptySave(blankProfile()), ready: true });
  },

  refreshFromServer: async () => {
    const s = get();
    if (!s.profile.id || !isRemoteId(s.profile.id)) return;
    // Guard against clobbering an in-flight chip delta: if the local balance
    // differs from the last known-synced value, a reconcile push is either
    // in flight or pending. Adopting the server snapshot now would erase a
    // just-won hand. Skip this refresh; next persist() will settle the delta
    // and the next visibility flip will pick up the true value.
    const known = lastSyncedChips[s.profile.id];
    if (known !== undefined && s.profile.chips !== known) return;
    const fresh = await authService.restore();
    if (!fresh || fresh.id !== s.profile.id) return;
    lastSyncedChips[fresh.id] = fresh.chips;
    set({ profile: { ...s.profile, chips: fresh.chips, level: fresh.level, xp: fresh.xp } });
    // Also refresh owned items so a purchase made on another device shows up.
    // Merge with local — never drop items the client owns that server hasn't
    // seen yet (client-only exclusives, in-flight buys).
    const ownedRemote = await shopService.ownedIds(fresh.id);
    if (ownedRemote?.length) {
      set({ owned: Array.from(new Set([...get().owned, ...ownedRemote])) });
    }
  },

  /**
   * Leaves the account: ends the session, drops the device save and — the part
   * that was missing — forgets who was signed in.
   *
   * `reset()` deliberately keeps the identity, because "reset local progress"
   * means starting over as yourself. Sign-out reused it, so the store kept a
   * uuid with no session behind it: the router still saw a player, the HUD
   * still drew them, and every request went out as an id `auth.uid()` no longer
   * matched. The shop was the loudest symptom — `buy_item` charges
   * `auth.uid()`, which was null, so purchases failed while the balance on
   * screen looked fine.
   */
  signOut: async () => {
    analytics.track('sign_out');
    analytics.setUser(null);
    await authService.signOut();
    localStore.clear();
    set({ ...emptySave(blankProfile()), ready: true, staked: 0 });
  },

  setProfile: (profile) => {
    const existing = localStore.read();
    if (!existing || existing.profile.id !== profile.id) {
      set({ ...emptySave(profile), ready: true });
    } else {
      set({ profile, ready: true });
    }
    analytics.setUser(profile.id);
    analytics.track('sign_in', { isGuest: profile.isGuest });
    get().persist();
  },

  setAvatar: (avatar) => {
    set((s) => ({ profile: { ...s.profile, avatar } }));
    get().persist();
  },

  setChips: (value) => {
    // Every caller of setChips already has this value straight from a chip
    // RPC's return (claimPayout, admin_set_chips) — it's confirmed on the
    // server already, so stamp the baseline instead of pushing it again.
    const s = get();
    if (s.profile.id) lastSyncedChips[s.profile.id] = Math.max(0, Math.round(value));
    set({ profile: withAdminFloor({ ...s.profile, chips: Math.max(0, Math.round(value)) }) });
    get().persist();
  },

  addChips: (delta, opts) => {
    set((s) => {
      const chips = Math.max(0, Math.round(s.profile.chips + delta));
      const nextProfile = withAdminFloor({ ...s.profile, chips });
      // Sticky VIP: the moment both thresholds are met, flip everVip on and
      // keep it there. Loses no chips or level to demote them later.
      if (shouldMarkEverVip(nextProfile)) nextProfile.everVip = true;
      return {
        profile: nextProfile,
        stats: delta > 0 ? { ...s.stats, chipsWon: s.stats.chipsWon + delta } : s.stats,
      };
    });
    if (delta > 0 && !opts?.silent) {
      audio.play('chip');
      haptic('chip');
    }
    if (opts?.localOnly) {
      // Optimistic UI update only — caller owns the server sync (e.g. a room's
      // claim RPC will return the authoritative balance). Stamp lastSyncedChips
      // to the new local value so the next reconcile pass sees no delta to push
      // and doesn't double-count the change against the RPC.
      const s = get();
      if (s.profile.id) lastSyncedChips[s.profile.id] = s.profile.chips;
      return;
    }
    get().persist();
  },

  addXp: (gain) => {
    const s = get();
    const { level, xp, levelsGained } = applyXp(s.profile.level, s.profile.xp, gain);
    set({ profile: { ...s.profile, level, xp } });
    if (levelsGained > 0) {
      const reward = 400 + level * 60;
      set((state) => ({ profile: { ...state.profile, chips: state.profile.chips + reward } }));
      audio.duck(1600);
      audio.play('levelUp');
      haptic('win');
      useUI.getState().showMoment({
        kind: 'levelUp',
        title: 'moments.levelUp',
        subtitle: String(level),
        icon: '🎖️',
        duration: 2600,
      });
      void get().claimMilestones();
    }
    get().persist();
    checkAchievements(get, set);
  },

  claimMilestones: async () => {
    const s = get();
    if (!s.profile.id) return;
    const results = await profileService.claimMilestones(s.profile.id, s.profile.level, s.profile.lastMilestoneClaimed, s.owned);
    if (!results.length) return;

    const totalChips = results.reduce((sum, r) => sum + r.chips, 0);
    const newItems = results.map((r) => r.item).filter((id): id is string => !!id);
    const lastLevel = results[results.length - 1].level;

    // For a signed-in player, claim_level_milestone() already credited this
    // server-side (profileService.claimMilestones loops the real RPC) — bump
    // the known baseline by the same amount so persist() doesn't also push it
    // through adjust_chips and double-credit the account.
    if (isRemoteId(s.profile.id) && lastSyncedChips[s.profile.id] !== undefined) {
      lastSyncedChips[s.profile.id] += totalChips;
    }

    set((state) => ({
      profile: withAdminFloor({ ...state.profile, chips: state.profile.chips + totalChips, lastMilestoneClaimed: lastLevel }),
      owned: [...state.owned, ...newItems],
    }));

    audio.duck(1400);
    audio.play(newItems.length ? 'vault' : 'chip');
    const rewardItem = newItems.length ? itemById(newItems[newItems.length - 1]) : null;
    useUI.getState().showMoment({
      kind: rewardItem ? 'rareItem' : 'bigWin',
      title: 'moments.milestone',
      subtitle: rewardItem ? rewardItem.name[useSettings.getState().lang] : `+${fmt(totalChips)}`,
      icon: rewardItem ? rewardItem.icon : '🎁',
      duration: 2400,
    });
    get().persist();
  },

  /**
   * Head-to-head, recorded a round at a time.
   *
   * "Beating" someone at Blackjack is not a direct contest — you both play the
   * dealer — so a round counts for whoever came out further ahead on chips.
   * A tie advances neither. This is what makes a rivalry panel mean something
   * instead of comparing two unrelated lifetime win counts.
   */
  recordRivalry: (game, myNet, opponents) => {
    if (!opponents.length) return;
    set((s) => {
      const next = [...s.rivalries];
      for (const opponent of opponents) {
        const index = next.findIndex((entry) => entry.friendId === opponent.userId);
        const current = index >= 0
          ? next[index]
          : { friendId: opponent.userId, gamesTogether: 0, myWins: 0, theirWins: 0, byGame: {} };
        const iWon = myNet > opponent.net;
        const theyWon = opponent.net > myNet;
        const byGame = { ...current.byGame };
        const cell = byGame[game] ?? { me: 0, them: 0 };
        byGame[game] = { me: cell.me + (iWon ? 1 : 0), them: cell.them + (theyWon ? 1 : 0) };
        const updated = {
          ...current,
          gamesTogether: current.gamesTogether + 1,
          myWins: current.myWins + (iWon ? 1 : 0),
          theirWins: current.theirWins + (theyWon ? 1 : 0),
          byGame,
        };
        if (index >= 0) next[index] = updated; else next.push(updated);
      }
      return { rivalries: next };
    });
    get().persist();
  },

  bumpStat: (patch) => {
    set((s) => ({ stats: { ...s.stats, ...patch } }));
    get().persist();
    checkAchievements(get, set);
  },

  recordResult: (game, outcome, net, extra) => {
    const s = get();
    analytics.track('game_result', { game, outcome, net });
    const stats: Stats = { ...s.stats, ...extra };
    stats.games += 1;
    if (outcome === 'win') {
      stats.wins += 1;
      stats.streak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      stats.biggestWin = Math.max(stats.biggestWin, net);
    } else if (outcome === 'lose') {
      stats.losses += 1;
      stats.streak = 0;
    } else {
      stats.pushes += 1;
    }
    const entry: ActivityEntry = {
      id: Math.random().toString(36).slice(2),
      game, outcome, net, at: new Date().toISOString(),
    };
    // Favourite game = the one actually played most.
    const counts = [...s.activity, entry].reduce<Record<string, number>>((acc, item) => {
      acc[item.game] = (acc[item.game] ?? 0) + 1;
      return acc;
    }, {});
    const favorite = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as GameKey | null;

    set({
      stats,
      activity: [entry, ...s.activity].slice(0, 40),
      profile: { ...s.profile, favoriteGame: favorite },
    });
    get().persist();
    checkAchievements(get, set);
  },

  buy: async (itemId) => {
    const item = itemById(itemId);
    const s = get();
    if (!item) return { ok: false, reason: 'unknown-item' as const };
    if (s.owned.includes(itemId)) return { ok: false, reason: 'owned' as const };
    const price = discountedPrice(item.price, s.profile.level);
    if (s.profile.chips < price) {
      audio.play('error');
      return { ok: false, reason: 'insufficient' as const };
    }
    /* buy_item() charges the balance stored on the server, but every game in
       the room settles locally and only syncs afterwards, fire-and-forget. So
       the server could still be holding a balance from several hands ago and
       refuse a purchase the player can plainly afford. Push the current profile
       up and wait for it before asking to be charged. */
    const synced = await profileService.syncProfile(s.profile, s.stats);
    if (!synced.ok) {
      /* The balance on screen never reached the server, so charging would be
         against a stale number. Stop here and say so, rather than let the
         purchase fail further down as a confusing "insufficient chips". */
      audio.play('error');
      return { ok: false, reason: 'not-signed-in', detail: synced.detail };
    }

    const result = await shopService.buy(s.profile.id, itemId);
    if (!result.ok) {
      audio.play('error');
      return { ok: false, reason: result.reason ?? 'server', detail: result.detail };
    }
    // buy_item() already charged this server-side and handed back the real
    // balance — stamp it as the known baseline so persist() doesn't also
    // push the deduction through adjust_chips.
    if (typeof result.chips === 'number') lastSyncedChips[s.profile.id] = result.chips;
    set((state) => ({
      owned: [...state.owned, itemId],
      profile: { ...state.profile, chips: result.chips ?? state.profile.chips - price },
    }));
    audio.play('vault');
    if (item.rarity === 'legendary' || item.rarity === 'mythic') {
      audio.duck(1400);
      useUI.getState().showMoment({ kind: 'rareItem', title: 'moments.rareItem', subtitle: item.name[useSettings.getState().lang], icon: item.icon, duration: 2400 });
    }
    get().persist();
    checkAchievements(get, set);
    return { ok: true };
  },

  equip: (itemId) => {
    const item = itemById(itemId);
    const s = get();
    if (!item || !s.owned.includes(itemId)) return;
    const { emote, decorId, ...rest } = item.payload;
    if (emote || decorId) return; // emotes live in the inventory; decor toggles via toggleDecor
    const equippedKeys = ['cardFace', 'cardBack', 'chipSkin', 'table', 'frame', 'victory', 'dealerSkin', 'coinSkin', 'currencySkin', 'slotsTheme', 'roomBackground'] as const;
    const equipped = { ...s.profile.equipped };
    const avatar = { ...s.profile.avatar };
    Object.entries(rest).forEach(([key, value]) => {
      if ((equippedKeys as readonly string[]).includes(key)) {
        (equipped as Record<string, unknown>)[key] = value;
      } else {
        (avatar as Record<string, unknown>)[key] = value;
      }
    });
    set({ profile: { ...s.profile, equipped, avatar } });
    audio.play('click');
    void profileService.equip(s.profile.id, equipped);
    get().persist();
  },


  toggleFavorite: (itemId) => {
    const s = get();
    const next = s.favorites.includes(itemId)
      ? s.favorites.filter((id) => id !== itemId)
      : [...s.favorites, itemId];
    set({ favorites: next });
    void shopService.toggleFavorite(s.profile.id, itemId, next.includes(itemId));
    get().persist();
  },

  claimDaily: () => {
    const s = get();
    const today = todayKey();
    const mirror = s.profile.id ? localStore.readDaily(s.profile.id) : null;
    const effectiveDaily = mirror && mirror.lastClaim === today ? mirror : s.daily;
    if (effectiveDaily.lastClaim === today) {
      if (s.daily.lastClaim !== today) set({ daily: effectiveDaily });
      return null;
    }

    /* Signed-in players: fire-and-check the server RPC. The RPC is atomic,
       so opening the app on two devices within the same day only grants
       once. If the server says already-claimed, we still refresh the local
       mirror so the "gift" dot goes away. Guest / offline players fall
       through to the local grant. */
    if (isRemoteId(s.profile.id)) {
      const day = nextStreakDay(effectiveDaily);
      const comeback = effectiveDaily.lastClaim ? daysSince(effectiveDaily.lastClaim) >= COMEBACK_THRESHOLD_DAYS : false;
      const chips = STREAK_REWARD(day) + (comeback ? COMEBACK_BONUS : 0);

      void profileService
        .claimDailyBonus(STREAK_REWARD(day), comeback ? COMEBACK_BONUS : 0, COMEBACK_THRESHOLD_DAYS)
        .then((res) => {
          if (!res) return;
          const current = get();
          if (current.profile.id !== s.profile.id) return; // switched account mid-flight
          // The client passed the local guard (lastClaim !== today) but the
          // server says it was already claimed — another device / a stale
          // mirror beat us. Log it so we can see if this ever actually happens.
          if (!res.granted) analytics.track('daily_double_attempt', { day });
          // Correct the optimistic grant against the authoritative balance as a
          // DELTA — never an overwrite. `lastSyncedChips` here still holds the
          // optimistic baseline stamped below; the difference is exactly what
          // needs to change (a rollback when !granted, drift from another device
          // otherwise). An overwrite to res.new_balance would stomp any
          // bet/payout addChips() that landed while this RPC was in flight.
          const correction = res.new_balance - (lastSyncedChips[current.profile.id] ?? res.new_balance);
          lastSyncedChips[current.profile.id] = res.new_balance;
          set({
            daily: {
              lastClaim: today,
              day: res.granted ? res.day : (res.day || current.daily.day),
            },
            profile: correction !== 0
              ? { ...current.profile, chips: Math.max(0, Math.round(current.profile.chips + correction)) }
              : current.profile,
          });
          get().persist();
        });

      // Optimistic local grant so the UI feels instant. If the server rejects,
      // the callback above corrects it. Baseline is stamped so the reconcile
      // pass doesn't double-push the delta before the RPC returns.
      set({
        daily: { lastClaim: today, day },
        profile: { ...s.profile, chips: s.profile.chips + chips },
      });
      lastSyncedChips[s.profile.id] = s.profile.chips + chips;
      get().persist();
      return { chips, day, comeback };
    }

    // Guest / offline path unchanged.
    const day = nextStreakDay(effectiveDaily);
    const comeback = effectiveDaily.lastClaim ? daysSince(effectiveDaily.lastClaim) >= COMEBACK_THRESHOLD_DAYS : false;
    const chips = STREAK_REWARD(day) + (comeback ? COMEBACK_BONUS : 0);
    set({
      daily: { lastClaim: today, day },
      profile: { ...s.profile, chips: s.profile.chips + chips },
    });
    get().persist();
    return { chips, day, comeback };
  },

  markWheelSpin: () => {
    set({ wheel: { lastSpin: todayKey() } });
    get().persist();
  },

  markIntroSeen: () => {
    set({ seenIntro: true });
    get().persist();
  },

  reset: () => {
    localStore.clear();
    const profile = get().profile;
    set({ ...emptySave(profile), ready: true });
  },
}));

/* ---- achievements are evaluated centrally, never inside a component ---- */
type Getter = () => PlayerState;
type Setter = (partial: Partial<PlayerState>) => void;

function statValue(state: PlayerState, key: string): number {
  if (key === 'level') return state.profile.level;
  if (key === 'itemCount') return state.owned.length;
  if (key === 'friendCount') return 0; // supplied by useSocial via syncFriendCount()
  return (state.stats as unknown as Record<string, number>)[key] ?? 0;
}

export function checkAchievements(get: Getter, set: Setter, friendCount = 0) {
  const state = get();
  const alreadyLocal = new Set(state.achievements);
  const newlyEarned: typeof ACHIEVEMENTS = [];

  ACHIEVEMENTS.forEach((achievement) => {
    if (alreadyLocal.has(achievement.id)) return;
    const value = achievement.stat === 'friendCount' ? friendCount : statValue(state, achievement.stat);
    if (value >= achievement.goal) newlyEarned.push(achievement);
  });

  if (newlyEarned.length === 0) return;

  /* Guest / offline: no server to arbitrate — grant locally exactly like
     before. The duplication risk here is only "clear your own browser data
     to re-farm rewards" and guests don't survive that anyway. */
  if (!isRemoteId(state.profile.id)) {
    const unlocked = [...state.achievements, ...newlyEarned.map((a) => a.id)];
    const rewarded = newlyEarned.reduce((sum, a) => sum + a.reward, 0);
    const lang = useSettings.getState().lang;
    newlyEarned.forEach((a) => useUI.getState().toast(`${a.name[lang]} · +${a.reward}`, 'good', '🎖️'));
    if (rewarded > 0) audio.play('win');
    set({ achievements: unlocked, profile: { ...state.profile, chips: state.profile.chips + rewarded } });
    return;
  }

  /* Signed in: every claim goes through claim_achievement RPC, which is
     atomic and refuses a second grant. So a device with an empty local
     achievements list still cannot re-farm rewards after re-hydrating from
     a stale cache — the RPC will return null and no chips will be granted. */
  const lang = useSettings.getState().lang;
  const grantOne = async (achievement: typeof ACHIEVEMENTS[number]) => {
    const balance = await profileService.claimAchievement(achievement.id, achievement.reward);
    if (balance === null) {
      // Server said "already claimed" — just adopt the id locally so the
      // trophy shelf shows it and we stop asking on every tick.
      const s = get();
      if (!s.achievements.includes(achievement.id)) {
        set({ achievements: [...s.achievements, achievement.id] });
      }
      return;
    }
    // First-time grant. claim_achievement adds exactly `achievement.reward`
    // server-side. Apply that as a DELTA to the live balance and bump the
    // synced baseline by the same amount — plus any drift between the server
    // total and what we thought it was (another device). An overwrite to
    // `balance` would stomp a bet/payout addChips() still queued in
    // reconcileChain, silently losing those chips off the HUD.
    const s = get();
    const known = lastSyncedChips[s.profile.id];
    const drift = known === undefined ? 0 : balance - (known + achievement.reward);
    lastSyncedChips[s.profile.id] = balance;
    set({
      achievements: s.achievements.includes(achievement.id) ? s.achievements : [...s.achievements, achievement.id],
      profile: { ...s.profile, chips: Math.max(0, Math.round(s.profile.chips + achievement.reward + drift)) },
    });
    useUI.getState().toast(`${achievement.name[lang]} · +${achievement.reward}`, 'good', '🎖️');
    audio.play('win');
  };
  // Optimistically stamp all the newly-earned ids first so a re-entrant
  // checkAchievements this same tick doesn't double-fire RPCs.
  set({ achievements: [...state.achievements, ...newlyEarned.map((a) => a.id)] });
  newlyEarned.forEach((a) => void grantOne(a));
}
