import { mulberry32 } from '@/lib/random';
import type { AvatarConfig } from '@/types';
import type { RouletteAction, RouletteBet, RouletteBetKind, RouletteSeat, RouletteState } from './types';

export const MAX_SEATS = 5;
/** A room round needs at least this many seated players. */
export const MIN_PLAYERS = 2;

/** Wipe every seat's round state — used when a round is aborted or reopened. */
function resetSeatsForNewRound(state: RouletteState) {
  for (const seat of state.seats) {
    seat.bets = [];
    seat.ready = false;
    seat.spectator = false;
    seat.net = 0;
  }
}

/** European single-zero wheel, in physical pocket order (not numeric order). */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const isRed = (n: number) => n !== 0 && RED_NUMBERS.has(n);
export const isBlack = (n: number) => n !== 0 && !RED_NUMBERS.has(n);

/** Betting-grid layout: 3 rows x 12 columns, bottom row first like the real felt. */
export const GRID_ROWS: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

/** Payout is "to one": a winning stake returns itself plus this multiple. */
export const BET_PAYOUTS: Record<RouletteBetKind, number> = {
  straight: 35, split: 17, street: 11, corner: 8, line: 5,
  column: 2, dozen: 2, red: 1, black: 1, even: 1, odd: 1, low: 1, high: 1,
};

/** 5 seat marker colours — Red/Blue/Green/Yellow/Purple, built from the design tokens. */
export const PLAYER_COLORS = [
  { id: 'red', hex: 'var(--crimson-hi)' },
  { id: 'blue', hex: 'var(--social)' },
  { id: 'green', hex: 'var(--jade-hi)' },
  { id: 'yellow', hex: 'var(--gold-hi)' },
  { id: 'purple', hex: 'var(--violet)' },
] as const;

export function createState(seed: number): RouletteState {
  return {
    version: 0, seed, cursor: 0, round: 0, phase: 'betting',
    seats: [], winningNumber: null, lastBets: {}, deadline: null, spinAt: null, history: [],
  };
}

export function makeSeat(userId: string, username: string, avatar: AvatarConfig, level: number, color: string): RouletteSeat {
  return { userId, username, avatar, level, color, bets: [], ready: false, spectator: false, net: 0 };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Draws a pocket. In a real multiplayer room the host passes a fresh `nonce`
 * minted at spin time, so the outcome cannot be derived from the published
 * `seed`+`cursor` (which every client can read) — closing the "compute the next
 * number and bet on it" exploit. With no nonce (solo play, tests) it falls back
 * to the seed+cursor draw so the sequence stays deterministic and verifiable.
 */
function spinWheel(state: RouletteState, nonce?: number): number {
  const basis = nonce !== undefined ? nonce : state.seed + state.cursor * 7919;
  const rng = mulberry32(basis >>> 0);
  state.cursor += 1;
  return WHEEL_ORDER[Math.floor(rng() * WHEEL_ORDER.length)];
}

const totalStake = (seat: RouletteSeat) => seat.bets.reduce((sum, b) => sum + b.amount, 0);

/**
 * How many distinct numbers each bet kind is allowed to cover. Payout odds
 * (BET_PAYOUTS) are only fair at this exact count — e.g. a "straight" bet is
 * priced at 35:1 assuming it covers exactly 1 number; nothing else stops a
 * crafted action from covering all 36 at that price, so this is load-bearing,
 * not just cosmetic validation.
 */
const BET_NUMBER_COUNT: Record<RouletteBetKind, number> = {
  straight: 1, split: 2, street: 3, corner: 4, line: 6, column: 12, dozen: 12,
  red: 0, black: 0, even: 0, odd: 0, low: 0, high: 0,
};

/** Rejects any bet whose shape doesn't match its kind — see BET_NUMBER_COUNT. */
function isValidBetShape(kind: RouletteBetKind, numbers: number[]): boolean {
  const expected = BET_NUMBER_COUNT[kind];
  if (expected === undefined || numbers.length !== expected) return false;
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return false;
  return numbers.every((n) => Number.isInteger(n) && n >= 0 && n <= 36);
}

/** Whether a single bet covers the winning number. */
function betWins(bet: RouletteBet, n: number): boolean {
  switch (bet.kind) {
    case 'red': return isRed(n);
    case 'black': return isBlack(n);
    case 'even': return n !== 0 && n % 2 === 0;
    case 'odd': return n !== 0 && n % 2 === 1;
    case 'low': return n >= 1 && n <= 18;
    case 'high': return n >= 19 && n <= 36;
    default: return bet.numbers.includes(n);
  }
}

function settle(state: RouletteState) {
  const n = state.winningNumber as number;
  for (const seat of state.seats) {
    let payout = 0;
    for (const bet of seat.bets) {
      if (betWins(bet, n)) payout += bet.amount * (BET_PAYOUTS[bet.kind] + 1);
    }
    seat.net = payout - totalStake(seat);
  }
  state.history = [n, ...state.history].slice(0, 24);
  state.phase = 'settled';
}

/**
 * The single source of truth for a round of Roulette.
 * Pure: same state + same action always produces the same next state, which is
 * what makes host-authoritative multiplayer verifiable by every client — same
 * discipline as the Blackjack engine.
 */
export function reduce(prev: RouletteState, action: RouletteAction): RouletteState {
  const state = clone(prev);
  state.version = prev.version + 1;
  const seatOf = (userId: string) => state.seats.find((s) => s.userId === userId);

  switch (action.type) {
    case 'join': {
      if (seatOf(action.userId) || state.seats.length >= MAX_SEATS) return prev;
      const used = new Set(state.seats.map((s) => s.color));
      const color = (PLAYER_COLORS.find((c) => !used.has(c.hex)) ?? PLAYER_COLORS[0]).hex;
      const seat = makeSeat(action.userId, action.username, action.avatar, action.level, color);
      // Land as a full player only if this round hasn't got going yet — a fresh
      // `betting` phase with no window armed (everyone's still placing bets), or
      // a parked `waiting` table. Joining once the window is ticking, or mid
      // spin/settle, watches this round out; the next `openBetting` clears
      // `spectator` and promotes them.
      seat.spectator = !(state.phase === 'waiting' || (state.phase === 'betting' && state.deadline === null));
      state.seats.push(seat);
      // A join that brings a parked table back up to strength opens a fresh
      // betting round for everyone.
      if (state.phase === 'waiting' && state.seats.length >= MIN_PLAYERS) {
        state.phase = 'betting';
        state.round += 1;
        state.deadline = null;
        state.spinAt = null;
        state.winningNumber = null;
        resetSeatsForNewRound(state);
      }
      return state;
    }
    case 'leave': {
      const wasMidRound = state.phase !== 'betting' && state.phase !== 'waiting';
      state.seats = state.seats.filter((s) => s.userId !== action.userId);
      if (state.seats.length < MIN_PLAYERS) {
        // Not enough players left to run a round — park the table; the scene
        // shows a "waiting for players" panel until someone else joins.
        state.phase = 'waiting';
        state.deadline = null;
        state.spinAt = null;
        state.winningNumber = null;
        resetSeatsForNewRound(state);
        return state;
      }
      if (wasMidRound) {
        // Enough players remain — abort the round the leaver walked out of and
        // deal a clean one rather than settling around the empty seat.
        state.phase = 'betting';
        state.round += 1;
        state.deadline = null;
        state.spinAt = null;
        state.winningNumber = null;
        resetSeatsForNewRound(state);
      }
      return state;
    }
    case 'placeBet': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting' || action.amount <= 0) return prev;
      if (!isValidBetShape(action.kind, action.numbers)) return prev;
      const key = `${action.kind}:${action.numbers.join(',')}`;
      const existing = seat.bets.find((b) => `${b.kind}:${b.numbers.join(',')}` === key);
      if (existing) existing.amount += action.amount;
      else seat.bets.push({ id: `${key}:${Math.random().toString(36).slice(2, 7)}`, kind: action.kind, numbers: action.numbers, amount: action.amount });
      seat.spectator = false;
      seat.ready = false;
      return state;
    }
    case 'clearBets': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting') return prev;
      seat.bets = [];
      seat.ready = false;
      return state;
    }
    case 'ready': {
      // "Done betting" — the player is finished for this round (they can still
      // un-ready by placing or clearing a bet, which both reset the flag). A
      // seat with no bets may still declare ready to sit the round out; the
      // round can't actually spin unless *someone* bet (see `spin`/`lockBets`).
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting' || seat.spectator) return prev;
      seat.ready = true;
      return state;
    }
    case 'openBetting': {
      // Guard: only accept a new round from a settled state. Without this,
      // a rogue openBetting during the betting phase itself resets every
      // seat's placed bets — chips deducted client-side, no winnings,
      // no refund. Silently dropping the intent leaves the bettors' round
      // intact.
      if (state.phase !== 'settled' && state.phase !== 'locked' && state.phase !== 'waiting') return prev;
      state.phase = 'betting';
      state.round += 1;
      state.winningNumber = null;
      state.deadline = action.deadline ?? null;
      state.spinAt = null;
      for (const seat of state.seats) {
        if (seat.bets.length) state.lastBets[seat.userId] = seat.bets;
        seat.bets = [];
        seat.ready = false;
        seat.spectator = false;
        seat.net = 0;
      }
      return state;
    }
    case 'armWindow': {
      // Only arm while the pot is still empty. That covers the normal case
      // (deadline == null on a fresh round) and lets the host refresh a window
      // that expired with nobody betting — but never move the goalposts once
      // a bet is down.
      if (state.phase !== 'betting') return prev;
      if (state.deadline != null && state.seats.some((s) => s.bets.length > 0)) return prev;
      state.deadline = action.deadline;
      return state;
    }
    case 'lockBets': {
      // Don't lock an empty table — a round nobody bet into must stay open so
      // it can't get stranded in `locked` with no way to reach `spin`.
      if (state.phase !== 'betting') return prev;
      if (!state.seats.some((s) => s.bets.length > 0)) return prev;
      state.phase = 'locked';
      return state;
    }
    case 'spin': {
      // In a multiplayer room the window is always armed, so the host can't
      // spin straight from `betting` — it must go through `lockBets` at the
      // deadline. Solo play leaves `deadline` null and spins directly.
      const canSpin = state.phase === 'locked' || (state.phase === 'betting' && state.deadline == null);
      if (!canSpin) return prev;
      if (!state.seats.some((s) => s.bets.length > 0)) return prev;
      state.phase = 'spinning';
      state.spinAt = Date.now();
      state.winningNumber = spinWheel(state, action.nonce);
      settle(state);
      return state;
    }
    default:
      return prev;
  }
}

export const seatOf = (state: RouletteState, userId: string) => state.seats.find((s) => s.userId === userId);
export const seatStake = (seat: RouletteSeat) => totalStake(seat);

/** Builders for grid-derived inside bets, used by the betting table UI. */
export const streetNumbers = (row: number[]): number[] => row;
export const columnNumbers = (col: 0 | 1 | 2): number[] => GRID_ROWS[col];
export const dozenNumbers = (dozen: 1 | 2 | 3): number[] => {
  const start = (dozen - 1) * 12 + 1;
  return Array.from({ length: 12 }, (_, i) => start + i);
};
