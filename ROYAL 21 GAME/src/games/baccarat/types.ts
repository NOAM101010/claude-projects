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

export interface BaccaratState {
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: BaccaratPhase;
  player: Card[];
  banker: Card[];
  /** The stakes for this round, once the deal has started. */
  bet: BaccaratBet;
  /** Set once the hand resolves. */
  outcome: BaccaratOutcome | null;
  /** Chip delta for the player: positive on a win, negative on a loss.
   *  Includes both the main bet and every side bet in one number. */
  net: number;
  /** Per-side payout breakdown, so the UI can highlight which side hit. */
  sideResults: Partial<Record<BaccaratSide, number>>;
  /** Recent outcomes, most recent first — displayed as the "road" trail. */
  history: BaccaratOutcome[];
  /** What we bet last round, for the one-tap "same again" button. */
  lastBet: BaccaratBet;
}

export type BaccaratAction =
  | { type: 'setMainBet'; side: BaccaratOutcome; amount: number }
  | { type: 'clearBet' }
  | { type: 'setSideBet'; side: BaccaratSide; amount: number }
  | { type: 'repeatLast' }
  | { type: 'deal' }
  | { type: 'newRound' };
