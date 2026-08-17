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

async function reconcileChips(profile: Profile) {
  if (!isRemoteId(profile.id)) return;
  const known = lastSyncedChips[profile.id];
  if (known === undefined) {
    // First tick this session: trust whatever we hydrated with as the
    // baseline rather than pushing a delta against a number we never saw
    // the server confirm.
    lastSyncedChips[profile.id] = profile.chips;
    return;
  }
  if (profile.chips === known) return;
  if (profile.isAdmin) {
    const balance = await adminService.setChips(profile.chips);
    if (typeof balance === 'number') lastSyncedChips[profile.id] = balance;
    return;
  }
  // Clamp per adjust_chips' ±100,000 limit; if the true delta is bigger, only
  // that much moves this call and the next persist() catches up with the
  // remainder. Use the RPC's returned balance (authoritative) as the baseline,
  // not `known + delta` — the server may floor at 0 or clamp differently and
  // trusting our own math there is how the two sides drift apart.
  const delta = Math.max(-100000, Math.min(100000, profile.chips - known));
  const balance = await profileService.adjustChips(delta);
  if (typeof balance === 'number') {
    lastSyncedChips[profile.id] = balance;
    // If the server ended up somewhere we did not expect (offline race with
    // another device, RPC floor at 0), correct the local profile too so the
    // HUD stops showing a ghost balance. The `set` runs outside a React tick,
    // so it's fine to call here.
    if (balance !== profile.chips) {
      const s = usePlayer.getState();
      if (s.profile.id === profile.id) {
        usePlayer.setState({ profile: { ...s.profile, chips: balance } });
      }
    }
  }
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
      const ownedRemote = await shopService.ownedIds(restored.id);
      if (ownedRemote?.length) set({ owned: Array.from(new Set([...get().owned, ...ownedRemote])) });
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
    const fresh = await authService.restore();
    if (!fresh || fresh.id !== s.profile.id) return;
    // Stamp the server balance as the baseline BEFORE writing profile, so the
    // reconcile pass triggered by persist() sees no delta to push. Otherwise a
    // pending local +N (still in memory) would race and re-apply.
    lastSyncedChips[fresh.id] = fresh.chips;
    set({ profile: { ...s.profile, chips: fresh.chips, level: fresh.level, xp: fresh.xp } });
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
    set((s) => ({
      profile: withAdminFloor({ ...s.profile, chips: Math.max(0, Math.round(s.profile.chips + delta)) }),
      stats: delta > 0 ? { ...s.stats, chipsWon: s.stats.chipsWon + delta } : s.stats,
    }));
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
    /* Trust the mirror over in-memory state — the mirror is the last line of
       defense against a stale hydrate handing us daily.lastClaim=null when
       the previous session actually did claim today's gift. */
    const mirror = s.profile.id ? localStore.readDaily(s.profile.id) : null;
    const effectiveDaily = mirror && mirror.lastClaim === today ? mirror : s.daily;
    if (effectiveDaily.lastClaim === today) {
      /* Mirror said we already claimed today but the store thought otherwise.
         Reconcile the in-memory state so the "gift ready" HUD dot goes away. */
      if (s.daily.lastClaim !== today) set({ daily: effectiveDaily });
      return null;
    }
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
  const unlocked = [...state.achievements];
  let rewarded = 0;
  ACHIEVEMENTS.forEach((achievement) => {
    if (unlocked.includes(achievement.id)) return;
    const value = achievement.stat === 'friendCount' ? friendCount : statValue(state, achievement.stat);
    if (value >= achievement.goal) {
      unlocked.push(achievement.id);
      rewarded += achievement.reward;
      const lang = useSettings.getState().lang;
      useUI.getState().toast(`${achievement.name[lang]} · +${achievement.reward}`, 'good', '🎖️');
      audio.play('win');
    }
  });
  if (unlocked.length !== state.achievements.length) {
    set({ achievements: unlocked, profile: { ...state.profile, chips: state.profile.chips + rewarded } });
  }
}
