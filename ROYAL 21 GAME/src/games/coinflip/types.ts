import type { AvatarConfig } from '@/types';

export const MAX_SEATS = 5;

export type CfSide = 'heads' | 'tails';
export type CfPhase = 'betting' | 'settled';

export interface CfSeat {
  userId: string;
  username: string;
  avatar: AvatarConfig;
  level: number;
  color: string;
  pick: CfSide | null;
  stake: number;
  net: number;
}

export interface CfState {
  /** Bumped on every applied action; lets clients drop stale realtime frames. */
  version: number;
  seed: number;
  cursor: number;
  round: number;
  phase: CfPhase;
  seats: CfSeat[];
  result: CfSide | null;
  deadline: number | null;
  /** Recent results, most recent first — mirrors Roulette's history strip. */
  history: CfSide[];
}

export type CfAction =
  | { type: 'join'; userId: string; username: string; avatar: AvatarConfig; level: number }
  | { type: 'leave'; userId: string }
  | { type: 'pick'; userId: string; side: CfSide; amount: number }
  | { type: 'clearPick'; userId: string }
  | { type: 'openBetting'; deadline?: number | null }
  /** `nonce` is fresh host randomness minted at flip time, so the heads/tails
   *  result can't be precomputed from the published `seed`+`cursor`. */
  | { type: 'flip'; nonce?: number };
