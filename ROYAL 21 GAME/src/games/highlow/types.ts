import type { AvatarConfig } from '@/types';
import type { Card } from '@/games/blackjack/types';

export type { Card };

export const MAX_SEATS = 8;

/** `waiting` — fewer than 2 seated players; parks here until another joins.
 *  `betting` — lobby, host locks the ante, then starts the round.
 *  `guessing` — the live simultaneous higher/lower guess against the base card.
 *  `settled` — round over, pot paid, auto-continues to the next. */
export type HlPhase = 'waiting' | 'betting' | 'guessing' | 'settled';

/** `hidden` is the redacted placeholder every other seat's guess shows as while
 *  the guess window is open — the real value is only published on reveal. */
export type HlGuess = 'higher' | 'lower' | 'hidden' | null;

export interface HlSeat {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  title?: string | null;
  nameColor?: string | null;
  /** One of the marker colours, same palette as Roulette. */
  color: string;
  /** Still in the round — false once eliminated by a wrong guess or a timeout. */
  alive: boolean;
  guess: HlGuess;
  /** Ante paid into this round's pot. 0 before the round starts. */
  stake: number;
  net: number;
}

export interface HlState {
  /** Bumped on every applied action; lets clients drop stale realtime frames. */
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: HlPhase;
  seats: HlSeat[];
  /** Total antes collected this round — split per the survival rules. */
  pot: number;
  /** The face-up card every guess is measured against. */
  base: Card | null;
  /** The card just turned over this turn (kept for the reveal animation). */
  revealed: Card | null;
  /** 0 on the opening guess; increments every time the field advances a card. */
  turn: number;
  /** Epoch ms the current guess window closes; null outside `guessing`. */
  deadline: number | null;
  /** userIds who took (or split) the pot, once settled. */
  winners: string[];
  /** Game-night only: every seat antes the same host-set amount. */
  anteMode?: boolean;
  anteAmount?: number;
}

export type HlAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number; title?: string | null; nameColor?: string | null }
  | { type: 'leave'; userId: string }
  /** Host sets the uniform ante every seat pays. Locked once a round is under way. */
  | { type: 'nightAnte'; amount: number }
  /** Host opens the round: every seated player antes, the base card is dealt.
   *  `nonce` reseeds the shoe so upcoming cards can't be read off `seed`+`cursor`;
   *  `deadline` is the epoch ms the first guess window closes. */
  | { type: 'start'; nonce?: number; ante?: number; deadline?: number | null }
  /** A live player locks in higher / lower for the next card. */
  | { type: 'guess'; userId: string; guess: 'higher' | 'lower' }
  /** Host turns the next card over. Seats that never guessed are eliminated first.
   *  `deadline` arms the next window when the field keeps going. */
  | { type: 'reveal'; nonce?: number; deadline?: number | null }
  /** Host opens the next betting window after a round settles. */
  | { type: 'newRound' };
