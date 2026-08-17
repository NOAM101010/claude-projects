import type { AvatarConfig } from '@/types';
import type { DuelConfig, DuelScores } from './duel';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { r: Rank; s: Suit }

export type Outcome = 'win' | 'lose' | 'push' | 'bust' | 'blackjack';
export type Phase = 'betting' | 'dealing' | 'playing' | 'dealer' | 'settled';

export interface BjHand {
  cards: Card[];
  bet: number;
  done: boolean;
  doubled: boolean;
  fromSplit: boolean;
  outcome?: Outcome;
  payout?: number;
}

export interface BjSeat {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  /** Chips committed before the deal. */
  bet: number;
  ready: boolean;
  hands: BjHand[];
  /** Joined mid-hand: watches until the next round. */
  spectator: boolean;
  net: number;
  emote?: { id: string; at: number };
}

export interface BjState {
  /** Bumped on every applied action; lets clients drop stale realtime frames. */
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: Phase;
  dealer: { cards: Card[]; hidden: boolean };
  seats: BjSeat[];
  activeSeat: number;
  activeHand: number;
  /** What you staked last hand, so "same again" is one tap. */
  lastBet: number;
  /** Epoch ms when the betting window closes (multiplayer only). */
  deadline: number | null;
  /** Present only in "Blackjack vs friends": the match config and scoreboard. */
  duel?: { config: DuelConfig; scores: DuelScores; winner?: string | null } | null;
  /** `game` tags which table produced the entry — absent means an older Blackjack
   *  entry recorded before other games could report into the same night. */
  history: { round: number; userId: string; username?: string; game?: string; outcome: Outcome; net: number }[];
  /** The night's current shared table for a mini-game (coin flip, high card) —
   *  a separate `rooms` row, since room codes are unique across the whole app
   *  and can't reuse this room's own code. Whoever clicks the tile first
   *  creates it and publishes the pointer here; everyone after joins the same
   *  table instead of each spinning up their own. */
  activeMiniGame?: { game: string; code: string } | null;
}

export type BjAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number }
  | { type: 'leave'; userId: string }
  | { type: 'bet'; userId: string; amount: number }
  | { type: 'clearBet'; userId: string }
  | { type: 'ready'; userId: string }
  | { type: 'openBetting' }
  /** Host-only: stamp the betting-window deadline once someone is ready. Separate
   *  from openBetting so setting the clock doesn't reset everyone's bet/ready. */
  | { type: 'setDeadline'; deadline: number | null }
  | { type: 'deal' }
  | { type: 'hit'; userId: string }
  | { type: 'stand'; userId: string }
  | { type: 'double'; userId: string }
  | { type: 'split'; userId: string }
  | { type: 'resolveDealer' }
  | { type: 'emote'; userId: string; emote: string }
  /** A different table (slots, coin flip, high card, scratch) reporting a round's
   *  result into this night's shared scoreboard — no seat required. */
  | { type: 'reportResult'; userId: string; username: string; game: string; outcome: Outcome; net: number }
  /** Publishes which room a night's mini-game currently lives in, so the next
   *  person to click the tile joins the same table instead of creating a new one. */
  | { type: 'setActiveMiniGame'; game: string; code: string };
