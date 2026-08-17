export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { r: Rank; s: Suit }

/** The three main outcomes at the table. */
export type BaccaratOutcome = 'player' | 'banker' | 'tie';

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
  /** How many chips on the main P/B/T pool. Only one of the three is non-zero. */
  main: { side: BaccaratOutcome; amount: number } | null;
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
  | { type: 'setMainBet'; side: BaccaratOutcome; amount: number; userId?: string }
  | { type: 'clearBet'; userId?: string }
  | { type: 'setSideBet'; side: BaccaratSide; amount: number; userId?: string }
  | { type: 'repeatLast'; userId?: string }
  | { type: 'setReady'; userId: string; ready: boolean }
  | { type: 'setDeadline'; deadline: number | null }
  | { type: 'deal' }
  | { type: 'newRound' }
  | { type: 'join'; userId: string; username: string; avatar: import('@/types').AvatarConfig; level: number }
  | { type: 'leave'; userId: string };
