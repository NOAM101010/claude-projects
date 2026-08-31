import { mulberry32 } from '@/lib/random';
import { PLAYER_COLORS } from '@/games/roulette/engine';
import type { AvatarConfig } from '@/types';
import type { CfAction, CfSeat, CfSide, CfState } from './types';
import { MAX_SEATS } from './types';

export { MAX_SEATS };

export function createState(seed: number): CfState {
  return { version: 0, seed, cursor: 0, round: 0, phase: 'betting', seats: [], result: null, deadline: null, history: [] };
}

function makeSeat(userId: string, username: string, avatar: AvatarConfig, level: number, color: string): CfSeat {
  return { userId, username, avatar, level, color, pick: null, stake: 0, net: 0 };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Flips the coin. The host passes a fresh `nonce` minted at flip time so the
 * result can't be derived from the published `seed`+`cursor` (which every
 * client reads) — otherwise a player could precompute heads/tails and pick the
 * winning side. No nonce (solo, tests) falls back to the deterministic draw.
 */
function flipCoin(state: CfState, nonce?: number): CfSide {
  const basis = nonce !== undefined ? nonce : state.seed + state.cursor * 7919;
  const rng = mulberry32(basis >>> 0);
  state.cursor += 1;
  return rng() < 0.5 ? 'heads' : 'tails';
}

/**
 * The single source of truth for a round of Coin Flip. Everyone who picks a
 * side antes their own stake; one flip decides it; whoever called it right
 * splits the whole pot. If nobody called it right, the pot has no claimant —
 * that only happens when every picker guessed the same way, so it's returned
 * to them rather than vanishing.
 */
export function reduce(prev: CfState, action: CfAction): CfState {
  const state = clone(prev);
  state.version = prev.version + 1;
  const seatOf = (userId: string) => state.seats.find((s) => s.userId === userId);

  switch (action.type) {
    case 'join': {
      if (seatOf(action.userId) || state.seats.length >= MAX_SEATS) return prev;
      const used = new Set(state.seats.map((s) => s.color));
      const color = (PLAYER_COLORS.find((c) => !used.has(c.hex)) ?? PLAYER_COLORS[0]).hex;
      state.seats.push(makeSeat(action.userId, action.username, action.avatar, action.level, color));
      return state;
    }
    case 'leave': {
      state.seats = state.seats.filter((s) => s.userId !== action.userId);
      return state;
    }
    case 'pick': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting' || action.amount <= 0) return prev;
      seat.pick = action.side;
      seat.stake = action.amount;
      return state;
    }
    case 'clearPick': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting') return prev;
      seat.pick = null;
      seat.stake = 0;
      return state;
    }
    case 'openBetting': {
      state.phase = 'betting';
      state.round += 1;
      state.result = null;
      state.deadline = action.deadline ?? null;
      for (const seat of state.seats) { seat.pick = null; seat.stake = 0; seat.net = 0; }
      return state;
    }
    case 'flip': {
      if (state.phase !== 'betting') return prev;
      const picked = state.seats.filter((s) => s.pick);
      if (picked.length < 2) return prev;

      const result = flipCoin(state, action.nonce);
      state.result = result;
      state.history = [result, ...state.history].slice(0, 24);

      const pot = picked.reduce((sum, s) => sum + s.stake, 0);
      const winners = picked.filter((s) => s.pick === result);
      if (winners.length === 0) {
        for (const seat of picked) seat.net = 0; // nobody called it — refund the field
      } else {
        const share = Math.floor(pot / winners.length);
        let remainder = pot - share * winners.length;
        for (const seat of picked) {
          if (seat.pick !== result) { seat.net = -seat.stake; continue; }
          const extra = remainder > 0 ? 1 : 0;
          if (extra) remainder -= 1;
          seat.net = share + extra - seat.stake;
        }
      }
      state.phase = 'settled';
      return state;
    }
    default:
      return prev;
  }
}

export const seatOf = (state: CfState, userId: string) => state.seats.find((s) => s.userId === userId);
