import type { AvatarConfig } from '@/types';
import type { Card } from '@/games/blackjack/types';

export type { Card };

export type Street = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export const MAX_SEATS = 6;
export const MIN_TO_START = 2;

export interface PokerSeat {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  seat: number;
  /** Chips in front of the player — bought in from their balance, cashed out on leave. */
  stack: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  /** Not dealt into the current hand — just sat down, or ran out of chips. */
  sittingOut: boolean;
  /** Put in during the current street. */
  committed: number;
  /** Put in during the whole hand — what side pots are computed from. */
  totalCommitted: number;
  /** Has acted since the last bet/raise on this street. */
  hasActed: boolean;
  lastAction: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'post' | null;
  disconnected: boolean;
  /** Extra 60s extensions left on the decision clock. Two per player, never replenished. */
  timeBanksLeft: number;
  /** Cash-game: the seat has pressed "Ready" for the next hand. When every
   *  non-sitting-out seat is ready, the host auto-fires startHand so the table
   *  doesn't wait on a single click. Reset to false at the top of every hand. */
  ready: boolean;
}

export interface PotShare {
  amount: number;
  eligible: string[];
}

export interface ShowdownEntry {
  userId: string;
  hole: Card[];
  best: Card[];
  category: string;
  won: number;
  folded: boolean;
}

export interface PokerState {
  version: number;
  seed: number;
  cursor: number;
  handNumber: number;
  street: Street;
  seats: PokerSeat[];
  community: Card[];
  /** Seat index of the dealer button; -1 before the first hand. */
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  pot: number;
  pots: PotShare[];
  /** Seat index to act, or -1 when nobody needs to. */
  toAct: number;
  currentBet: number;
  minRaise: number;
  lastAggressorSeat: number;
  deadline: number | null;
  log: string[];
  showdown: ShowdownEntry[] | null;
  /** Net chip change per user for the hand that just finished, for rivalry/stat recording. */
  lastResult: { userId: string; net: number; longshot?: boolean }[] | null;
  /** Win probability per contender, snapshotted the instant the last betting action happens and
   *  everyone left is all-in — before the remaining community cards are known. Null once no such
   *  moment occurred this hand (a normal showdown with betting on every street). */
  allInEquity: Record<string, number> | null;
  /** Present only for Sit & Go tables — absent means an ordinary cash game. */
  tournament: TournamentInfo | null;
}

export interface BlindLevel {
  sb: number;
  bb: number;
  ante: number;
}

export interface TournamentInfo {
  buyIn: number;
  startingStack: number;
  levels: BlindLevel[];
  /** Level durations in ms, all equal — kept as one number rather than a schedule. */
  levelMs: number;
  /** Epoch ms the tournament's clock started — every level is derived from this, never stored separately. */
  startedAt: number;
  /** userIds in the order they busted, first-out first. Never rejoin — no rebuys. */
  eliminated: string[];
  finished: boolean;
  winnerId: string | null;
}

export type PokerAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number; buyIn: number }
  | { type: 'leave'; userId: string }
  | { type: 'topUp'; userId: string; amount: number }
  | { type: 'sitOut'; userId: string }
  | { type: 'sitIn'; userId: string }
  | { type: 'setReady'; userId: string; ready: boolean }
  | { type: 'startHand' }
  | { type: 'fold'; userId: string }
  | { type: 'check'; userId: string }
  | { type: 'call'; userId: string }
  | { type: 'bet'; userId: string; amount: number }
  | { type: 'raise'; userId: string; amount: number }
  | { type: 'allin'; userId: string }
  /** Host stamps the acting seat's decision clock after every action that hands play to someone new. */
  | { type: 'setDeadline'; deadline: number }
  /** The acting player spends one of their two 60s extensions. */
  | { type: 'useTimeBank'; userId: string }
  /** Host-only: the acting seat's clock (base + any banks) ran out. Always a fold. */
  | { type: 'timeout'; userId: string };
