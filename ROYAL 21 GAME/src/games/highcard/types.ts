import type { AvatarConfig } from '@/types';
import type { Card } from '@/games/blackjack/types';

export type { Card };

export const MAX_SEATS = 5;

/** `waiting` — fewer than 2 seated players; parks here until another joins.
 *  Solo never uses it. */
export type HcPhase = 'waiting' | 'betting' | 'war' | 'settled';

export interface HcSeat {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  /** One of the 5 player marker colours, same palette as Roulette. */
  color: string;
  /** 0 = not anted into the current round. */
  stake: number;
  card: Card | null;
  /** Still contesting — false once eliminated by an earlier draw this round. */
  contending: boolean;
  net: number;
}

export interface HcState {
  /** Bumped on every applied action; lets clients drop stale realtime frames. */
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: HcPhase;
  seats: HcSeat[];
  /** Total antes collected this round — the whole pot goes to whoever's left standing. */
  pot: number;
  /** 0 before the first draw; increments each time a tie sends contenders back to war. */
  warRound: number;
  /** userIds who took the pot, once settled. */
  winners: string[];
  deadline: number | null;
}

export type HcAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number }
  | { type: 'leave'; userId: string }
  | { type: 'ante'; userId: string; amount: number }
  | { type: 'clearAnte'; userId: string }
  | { type: 'openBetting'; deadline?: number | null }
  /** `nonce` is fresh host randomness minted at draw time; it reseeds the shoe
   *  so upcoming cards can't be read off the published `seed`+`cursor`. */
  | { type: 'draw'; nonce?: number };
