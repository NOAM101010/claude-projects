export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { r: Rank; s: Suit }

/** The three possible outcomes of a hand — a tie still happens and pushes any
 *  Player/Banker bet, it just isn't a side you can bet ON. */
export type BaccaratOutcome = 'player' | 'banker' | 'tie';

/** The main bet: Player or Banker only (no Tie bet). */
export type BaccaratMainSide = 'player' | 'banker';

/** Side bets — the ones a Vegas/Macau table actually offers, not the
 *  homebrew ones. Each pays differently, listed in the paytable. */
export type BaccaratSide =
  | 'playerPair'   // player's first two cards are the same rank (11:1)
  | 'bankerPair'   // banker's first two cards are the same rank (11:1)
  | 'perfectPair'  // pair AND same suit; either side pays (25:1)
  | 'big'          // total of 5 or 6 cards dealt (0.54:1)
  | 'small';       // total of 4 cards dealt (1.5:1)

export type BaccaratPhase = 'betting' | 'dealing' | 'settled';

export interface BaccaratBet {
  /** Chips on the main bet — Player or Banker. */
  main: { side: BaccaratMainSide; amount: number } | null;
  /** How many chips on each side bet. */
  sides: Partial<Record<BaccaratSide, number>>;
}

/** One player at a multiplayer Baccarat table. Same shared cards; each seat
 *  places its own bets and settles into its own `net`. */
export interface BaccaratSeat {
  userId: string;
  username: string;
  avatar: import('@/types').AvatarConfig;
  level: number;
  bet: BaccaratBet;
  /** Set on settle so the per-seat "you won X" / "lost X" toast can fire. */
  net: number;
  sideResults: Partial<Record<BaccaratSide, number>>;
  /** Last round's bet, per player — used for their own 🔁 button. */
  lastBet: BaccaratBet;
  /** True once this seat is ready for the round to start. Auto-clears when
   *  a new betting window opens. */
  ready: boolean;
}

export interface BaccaratState {
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: BaccaratPhase;
  player: Card[];
  banker: Card[];
  /** Solo mode only: the single player's bets — kept for backwards compat
   *  with the existing solo scene. Multiplayer uses `seats` instead. */
  bet: BaccaratBet;
  outcome: BaccaratOutcome | null;
  /** Solo mode only: single-player net. Multiplayer uses per-seat net. */
  net: number;
  /** Solo mode only: single-player side results. Multiplayer uses per-seat. */
  sideResults: Partial<Record<BaccaratSide, number>>;
  history: BaccaratOutcome[];
  /** Solo mode only: single-player last bet. Multiplayer uses per-seat. */
  lastBet: BaccaratBet;
  /** Multiplayer: everyone at the table. Empty in solo. */
  seats: BaccaratSeat[];
  /** Multiplayer: epoch ms when the betting window auto-deals. Null in solo. */
  deadline: number | null;
}

export type BaccaratAction =
  | { type: 'setMainBet'; side: BaccaratMainSide; amount: number; userId?: string }
  | { type: 'clearBet'; userId?: string }
  | { type: 'setSideBet'; side: BaccaratSide; amount: number; userId?: string }
  | { type: 'repeatLast'; userId?: string }
  | { type: 'setReady'; userId: string; ready: boolean }
  | { type: 'setDeadline'; deadline: number | null }
  /** `nonce` is fresh host randomness minted the instant the deal fires (betting
   *  already closed). The engine seeds the shoe from it instead of the published
   *  seed/cursor, so no client can precompute the hand and bet on it. Absent in
   *  solo/tests → the existing deterministic shoe is used. */
  | { type: 'deal'; nonce?: number }
  | { type: 'newRound' }
  | { type: 'join'; userId: string; username: string; avatar: import('@/types').AvatarConfig; level: number }
  | { type: 'leave'; userId: string };
