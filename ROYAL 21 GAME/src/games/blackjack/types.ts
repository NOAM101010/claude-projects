import type { AvatarConfig } from '@/types';
import type { DuelConfig, DuelScores } from './duel';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { r: Rank; s: Suit }

export type Outcome = 'win' | 'lose' | 'push' | 'bust' | 'blackjack';
export type Phase = 'betting' | 'dealing' | 'playing' | 'dealer' | 'settled';

/** Companion wagers placed alongside the main bet (solo and room, never duel):
 *  `pairs` = Perfect Pairs, `trio` = 21+3. */
export type BjSide = 'pairs' | 'trio';

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
  /** Equipped cosmetic title tag (e.g. "ttl-shark"), mirrored from the joining profile. */
  title?: string | null;
  /** Equipped name colour from the fixed palette, mirrored from the joining profile. */
  nameColor?: string | null;
  /** Chips committed before the deal. */
  bet: number;
  ready: boolean;
  hands: BjHand[];
  /** Joined mid-hand: watches until the next round. */
  spectator: boolean;
  net: number;
  emote?: { id: string; at: number };
  /** Side bets placed this round (chips staked per side), solo or room. */
  sideBets?: Partial<Record<BjSide, number>>;
  /** Signed net per side, written at deal time: win `+amount*mult`, loss `-amount`. */
  sideResults?: Partial<Record<BjSide, number>>;
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
  /** Present only in "Blackjack vs friends": the match config and scoreboard.
   *  `pot` is frozen at match start (buy-in × players who bought in) so a
   *  mid-match leaver can't shrink what the winner is paid. */
  duel?: { config: DuelConfig; scores: DuelScores; winner?: string | null; pot?: number } | null;
  /** `game` tags which table produced the entry — absent means an older entry
   *  recorded before this field existed. Always 'blackjack' today. */
  history: { round: number; userId: string; username?: string; game?: string; outcome: Outcome; net: number }[];
}

export type BjAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number; title?: string | null; nameColor?: string | null }
  | { type: 'leave'; userId: string }
  | { type: 'bet'; userId: string; amount: number }
  /** Companion wager (Perfect Pairs / 21+3), solo or room. Additive; `amount <= 0` clears the side. */
  | { type: 'sideBet'; userId: string; side: BjSide; amount: number }
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
  | { type: 'emote'; userId: string; emote: string };
