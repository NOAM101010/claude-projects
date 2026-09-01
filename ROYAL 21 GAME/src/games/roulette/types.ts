import type { AvatarConfig } from '@/types';

export type RouletteBetKind =
  | 'straight' | 'split' | 'street' | 'corner' | 'line'
  | 'column' | 'dozen' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high';

export interface RouletteBet {
  id: string;
  kind: RouletteBetKind;
  /** Numbers this bet covers. Empty for the outside bets that resolve directly
   *  against the winning number (red/black/even/odd/low/high). */
  numbers: number[];
  amount: number;
}

export type RoulettePhase = 'betting' | 'locked' | 'spinning' | 'settled';

export interface RouletteSeat {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  /** One of the 5 player marker colours, assigned on join. */
  color: string;
  bets: RouletteBet[];
  ready: boolean;
  /** Joined mid-round: watches until the next betting window. */
  spectator: boolean;
  net: number;
}

export interface RouletteState {
  /** Bumped on every applied action; lets clients drop stale realtime frames. */
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: RoulettePhase;
  seats: RouletteSeat[];
  winningNumber: number | null;
  /** What everyone staked last round, kept for "same bets again". */
  lastBets: Record<string, RouletteBet[]>;
  /** Epoch ms when the betting window closes (multiplayer only). */
  deadline: number | null;
  /** Epoch ms when the host applied the spin. Every client aligns its wheel
   *  animation + reveal to this instant so the outcome surfaces at the same
   *  wall-clock time for the host and remote players (no host-first leak). */
  spinAt: number | null;
  /** Recent winning numbers, most recent first. */
  history: number[];
}

export type RouletteAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number }
  | { type: 'leave'; userId: string }
  | { type: 'placeBet'; userId: string; kind: RouletteBetKind; numbers: number[]; amount: number }
  | { type: 'clearBets'; userId: string }
  | { type: 'ready'; userId: string }
  | { type: 'openBetting'; deadline?: number | null }
  /** Multiplayer only: the host arms the 10s betting window on a round that
   *  opened without one (first spin, or a second player joining). Applied only
   *  while the pot is still empty, so it can also refresh an expired window that
   *  nobody bet into — but never overrides a live window once bets are down. */
  | { type: 'armWindow'; deadline: number }
  /** Multiplayer only: the host closes the betting window at the deadline.
   *  betting → locked. Rejected on an empty table so a round nobody bet into
   *  is never stranded in `locked`. */
  | { type: 'lockBets' }
  /** `nonce` is fresh host randomness generated at spin time. Without it the
   *  outcome derives only from `seed`+`cursor`, both of which are published in
   *  the shared state — so any client could precompute the next winning number
   *  and bet on it before the wheel turns. The host mints a nonce the instant it
   *  spins (betting already closed), so nobody can predict the result. */
  | { type: 'spin'; nonce?: number };
