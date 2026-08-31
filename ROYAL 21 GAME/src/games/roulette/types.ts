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

export type RoulettePhase = 'betting' | 'spinning' | 'settled';

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
  /** `nonce` is fresh host randomness generated at spin time. Without it the
   *  outcome derives only from `seed`+`cursor`, both of which are published in
   *  the shared state — so any client could precompute the next winning number
   *  and bet on it before the wheel turns. The host mints a nonce the instant it
   *  spins (betting already closed), so nobody can predict the result. */
  | { type: 'spin'; nonce?: number };
