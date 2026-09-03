/** Shared domain model. Mirrors the Supabase schema in supabase/setup.sql. */

export type Lang = 'he' | 'en';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Presence = 'online' | 'hub' | 'blackjack' | 'duel' | 'roulette' | 'away' | 'offline';
export type GameKey = 'blackjack' | 'duel' | 'coinflip' | 'highcard' | 'scratch' | 'slots' | 'poker' | 'sng' | 'roulette' | 'baccarat';

export interface AvatarConfig {
  skin: number;
  hair: number;
  shirt: 'base' | 'gold' | 'royal' | 'neon' | 'crimson' | 'white';
  hat?: 'cap' | 'fedora' | 'crown' | null;
  glasses?: 'sun' | 'clear' | null;
  chain?: 'gold' | 'silver' | null;
  watch?: 'gold' | 'steel' | null;
}

export interface Equipped {
  cardFace: string;
  cardBack: string;
  chipSkin: string;
  table: string;
  frame: string | null;
  victory: string | null;
  dealerSkin: string | null;
  /** Coin Flip skin only — the game piece in that mini-game. Same odds either way. */
  coinSkin: string;
  /** The player's chosen "currency" — the emblem shown next to every balance,
   *  price, and pot in the game. Only Daily-Rarity coins live in this slot;
   *  null keeps the default 🪙 everywhere. Independent of coinSkin. */
  currencySkin: string | null;
  slotsTheme: string;
  roomBackground: string | null;
  /** Up to MAX_ROOM_DECOR ids at once — a multi-slot field, unlike everything else here. */
  roomDecor: string[];
}

export interface Profile {
  id: string;
  username: string;
  tag: string;              // short public id, e.g. "#4821"
  avatar: AvatarConfig;
  chips: number;
  xp: number;
  level: number;
  /** Highest multiple-of-5 level whose milestone reward has already been granted. */
  lastMilestoneClaimed: number;
  joinedAt: string;
  presence: Presence;
  currentGame: GameKey | null;
  isGuest: boolean;
  equipped: Equipped;
  favoriteGame: GameKey | null;
  /**
   * Set by the server, never by the client. The app reads it to decide what to
   * draw; every actual power re-checks it in the database, so a player who
   * edits this in local storage gets a badge and nothing else.
   */
  isAdmin?: boolean;
  /** Set once the player has qualified for VIP (level + chips at the same
   *  time). Sticky: dropping chips later doesn't lose them the VIP room. */
  everVip?: boolean;
  /* --- server-owned progression mirrors (read-only on the client) --------- */
  /** Consecutive-day login streak, server-authoritative (claim_daily_bonus). */
  dailyStreak?: number;
  /** Achievement ids the server has granted. The store keeps the working copy
   *  in `usePlayer.achievements`; this is just the row value at hydrate time. */
  achievements?: string[];
  /** `<periodKey>:<missionId>` -> true. Mirror of profiles.mission_claims. */
  missionClaims?: Record<string, boolean>;
  /** How many referrer-tier rewards this account has collected (0..3). */
  referrerTier?: number;
  /** When the player finished onboarding, or null if they never have. */
  onboardedAt?: string | null;
  /** Lifetime seconds spent in the game (foreground only), server-owned.
   *  Accumulated by add_playtime(); display only on the client. */
  playtimeSeconds?: number;
}

export interface Stats {
  games: number;
  wins: number;
  losses: number;
  pushes: number;
  chipsWon: number;
  biggestBet: number;
  biggestWin: number;
  streak: number;
  bestStreak: number;
  bjHands: number;
  bjWins: number;
  bjLosses: number;
  blackjacks: number;
  doubleWins: number;
  splitWins: number;
  betTotal: number;
  betCount: number;
  cfGames: number;
  cfWins: number;
  cfLossStreak: number;
  slSpins: number;
  slWins: number;
  scCards: number;
  diceGames: number;
  hcGames: number;
  doubleOrNothing: number;
  /* --- played with other people, not against the house --- */
  /** Hands played at a table with at least one friend in it. */
  roomHands: number;
  /** "Blackjack vs friends" matches won. */
  duelWins: number;
  /** Game nights finished on top. */
  nightWins: number;
  /** Lifetime net winnings at the poker table (positive hands only). */
  pokerChipsWon: number;
  /** Showdowns won after going all-in as the mathematical underdog (≤10% equity at the time). */
  allInLongshotWins: number;
  /** Royal flushes made at showdown. */
  royalFlushes: number;
  /** Sit & Go tournaments won back-to-back — resets the moment one is lost. */
  sngWinStreak: number;
}

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface ShopItem {
  id: string;
  category:
    | 'cards' | 'backs' | 'chips' | 'tables' | 'avatars' | 'clothing'
    | 'glasses' | 'watches' | 'chains' | 'frames' | 'emotes' | 'victory' | 'dealers'
    | 'coins' | 'reels' | 'backgrounds' | 'decor';
  name: { he: string; en: string };
  desc?: { he: string; en: string };
  rarity: Rarity;
  price: number;
  icon: string;
  /** what equipping this item changes on the profile */
  payload: Partial<Equipped> & Partial<AvatarConfig> & { emote?: string; decorId?: string };
  /** Only obtainable through the Daily Rarity slot — hidden from normal shop lists. */
  dailyRarityOnly?: boolean;
  /** Only obtainable through the weekday Rare Rotation slot — hidden from normal shop lists. */
  rareRotationOnly?: boolean;
}

export interface Achievement {
  id: string;
  name: { he: string; en: string };
  desc: { he: string; en: string };
  /** `stat` (the default) trophies are earned automatically when a `Stats`
   *  counter reaches `goal` (checkAchievements). `event` trophies are granted
   *  explicitly at the moment they happen via `usePlayer.grantEvent(id)` — they
   *  carry no `stat` / `goal`. */
  kind?: 'stat' | 'event';
  stat?: keyof Stats | 'level' | 'itemCount' | 'friendCount';
  goal?: number;
  reward: number;
  /** How hard it is, and how the trophy is plated on the shelf. */
  tier: TrophyTier;
  /** The trophy itself — what stands on the shelf once it is earned. */
  trophy: string;
  /** Only earnable while playing with other people. */
  social?: boolean;
}

export interface Friend {
  id: string;
  username: string;
  tag: string;
  avatar: AvatarConfig;
  level: number;
  chips: number;
  presence: Presence;
  /** ISO timestamp of the last presence write — freshness gate, see lib/presence.ts */
  lastSeen?: string | null;
  currentGame: GameKey | null;
}

export interface DirectMessage {
  id: number;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface FriendRequest {
  id: string;
  from: Friend;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  kind: 'friend_request' | 'invite' | 'reward' | 'level' | 'achievement' | 'system' | 'gift' | 'podium_prize';
  title: string;
  body?: string;
  actorId?: string;
  payload?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar: AvatarConfig | null;
  body: string;
  createdAt: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  seat: number | null;
  isHost: boolean;
  presence: Presence;
  joinedAt: string;
}

/** Colors a private table can be dressed in — cosmetic only. */
export type TableColor = 'green' | 'red' | 'blue' | 'gold';

export interface RoomConfig {
  tableColor?: TableColor;
  smallBlind?: number;
  bigBlind?: number;
  maxSeats?: number;
  /** SHA-256 hash of the password. Empty/missing = public. */
  passwordHash?: string;
  /** VIP-only table. */
  isVip?: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  game: GameKey;
  createdAt: string;
  members: RoomMember[];
  config?: RoomConfig;
}

/** Rivalry / head-to-head record between two players. */
export interface Rivalry {
  friendId: string;
  gamesTogether: number;
  myWins: number;
  theirWins: number;
  byGame: Partial<Record<GameKey, { me: number; them: number }>>;
}
