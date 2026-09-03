import type { AppNotification, Equipped, GameKey, Profile, Rivalry, Stats } from '@/types';
import { DEFAULT_OWNED } from '@/data/items';
import { DEFAULT_ROOM_BACKGROUND } from '@/data/roomThemes';

const KEY = 'royal21.save.v2';
/** Per-profile mirror of just the daily-gift state. See localStore.writeDaily. */
const DAILY_KEY_PREFIX = 'royal21.daily.v1.';

/* One-time migration to v2 (full-reset boundary — everyone starts fresh from the
 * server). We deliberately do NOT import the old v1 blob: chips / level / VIP /
 * items all come from the DB now. Just drop the stale local state so a leftover
 * blob can't "restore" pre-reset values. */
(function migrateToV2() {
  try {
    if (localStorage.getItem(KEY) || !hasLegacyState()) return;
    localStorage.removeItem('royal21.save.v1');
    localStorage.removeItem('royal21.ref');
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('royal21.daily.v1.')) localStorage.removeItem(k);
    }
  } catch {
    /* private mode / no storage — nothing to migrate */
  }
})();

function hasLegacyState(): boolean {
  if (localStorage.getItem('royal21.save.v1') || localStorage.getItem('royal21.ref')) return true;
  return Object.keys(localStorage).some((k) => k.startsWith('royal21.daily.v1.'));
}

export interface ActivityEntry {
  id: string;
  game: GameKey;
  outcome: 'win' | 'lose' | 'push';
  net: number;
  at: string;
}

/** Device-local daily/weekly mission counters. Rolls at the UTC day / week
 *  boundary. Not server-synced — progress is ephemeral; only the *claim* is
 *  authoritative (server RPC + `missionClaims` guest mirror). */
export interface MissionProgress {
  day: string;   // dateKey these daily counters belong to
  week: string;  // weekKey these weekly counters belong to
  counts: Record<string, number>;
  games: string[];
  weekCounts: Record<string, number>;
  weekGames: string[];
}

export interface SaveData {
  profile: Profile;
  stats: Stats;
  owned: string[];
  favorites: string[];
  achievements: string[];
  notifications: AppNotification[];
  activity: ActivityEntry[];
  rivalries: Rivalry[];
  daily: { lastClaim: string | null; day: number };
  wheel: { lastSpin: string | null };
  seenIntro: boolean;
  missionProgress: MissionProgress;
  /** `<periodKey>:<missionId>` -> true. Mirrors profiles.mission_claims. */
  missionClaims: Record<string, boolean>;
}

export const EMPTY_MISSION_PROGRESS: MissionProgress = {
  day: '', week: '', counts: {}, games: [], weekCounts: {}, weekGames: [],
};

export const DEFAULT_EQUIPPED: Equipped = {
  cardFace: 'cf-classic',
  cardBack: 'bk-crimson',
  chipSkin: 'ck-classic',
  table: 'tb-green',
  frame: null,
  victory: null,
  dealerSkin: 'dl-house',
  coinSkin: 'cn-classic',
  currencySkin: null,
  slotsTheme: 'sl-classic',
  roomBackground: DEFAULT_ROOM_BACKGROUND,
  roomDecor: [],
};

export const EMPTY_STATS: Stats = {
  games: 0, wins: 0, losses: 0, pushes: 0, chipsWon: 0, biggestBet: 0, biggestWin: 0,
  streak: 0, bestStreak: 0, bjHands: 0, bjWins: 0, bjLosses: 0, blackjacks: 0,
  doubleWins: 0, splitWins: 0, betTotal: 0, betCount: 0, cfGames: 0, cfWins: 0,
  cfLossStreak: 0, slSpins: 0, slWins: 0, scCards: 0, diceGames: 0, hcGames: 0,
  doubleOrNothing: 0, roomHands: 0, duelWins: 0, nightWins: 0,
  pokerChipsWon: 0, allInLongshotWins: 0, royalFlushes: 0, sngWinStreak: 0,
};

export const STARTING_CHIPS = 5000;

export function emptySave(profile: Profile): SaveData {
  return {
    profile,
    stats: { ...EMPTY_STATS },
    owned: [...DEFAULT_OWNED],
    favorites: [],
    achievements: [],
    notifications: [],
    activity: [],
    rivalries: [],
    daily: { lastClaim: null, day: 0 },
    wheel: { lastSpin: null },
    seenIntro: false,
    missionProgress: { ...EMPTY_MISSION_PROGRESS, counts: {}, games: [], weekCounts: {}, weekGames: [] },
    missionClaims: {},
  };
}

/** Device-local persistence. Used for guests and as a cache for signed-in play. */
export const localStore = {
  read(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch {
      return null;
    }
  },
  write(data: SaveData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* quota or private mode — the session still works, it just won't persist */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },

  /* -----------------------------------------------------------------------
   * Per-profile daily-gift mirror.
   *
   * The main save is a whole-tree JSON dump, so if any single field in it
   * ever fails to serialize or is overwritten by an older hydrate pass, the
   * daily state can silently roll back and the player can re-claim today's
   * gift on the next boot. This tiny separate key isolates the "did I claim
   * today?" answer so it survives even that. claimDaily consults it before
   * granting.
   * --------------------------------------------------------------------- */
  writeDaily(profileId: string, daily: { lastClaim: string | null; day: number }) {
    if (!profileId) return;
    try {
      localStorage.setItem(DAILY_KEY_PREFIX + profileId, JSON.stringify(daily));
    } catch {
      /* ignore */
    }
  },
  readDaily(profileId: string): { lastClaim: string | null; day: number } | null {
    if (!profileId) return null;
    try {
      const raw = localStorage.getItem(DAILY_KEY_PREFIX + profileId);
      return raw ? (JSON.parse(raw) as { lastClaim: string | null; day: number }) : null;
    } catch {
      return null;
    }
  },
};
