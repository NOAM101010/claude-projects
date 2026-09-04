import { buildShoe, cardValue } from '@/games/blackjack/engine';
import { PLAYER_COLORS } from '@/games/roulette/engine';
import type { AvatarConfig } from '@/types';
import type { Card } from '@/games/blackjack/types';
import type { HlAction, HlSeat, HlState } from './types';
import { MAX_SEATS } from './types';

export { MAX_SEATS };

/** A room round needs at least this many seated players. */
export const MIN_PLAYERS = 2;

/** How long the live guess window stays open, in ms — the scene arms deadlines with this. */
export const GUESS_MS = 8000;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Ace-high rank, matching the High Card table's own comparison. */
export const rank = (card: Card) =>
  card.r === 'A' ? 14 : ['J', 'Q', 'K'].includes(card.r) ? 10 + ['J', 'Q', 'K'].indexOf(card.r) + 1 : cardValue(card.r);

/** Deterministic draw, derived from seed + cursor so every client can verify it. */
function draw(state: HlState): Card {
  const shoe = buildShoe(state.seed);
  if (state.cursor >= shoe.length) {
    state.seed = (state.seed * 31 + state.round + 17) >>> 0;
    state.cursor = 0;
    return draw(state);
  }
  const card = shoe[state.cursor];
  state.cursor += 1;
  return card;
}

export function createState(seed: number): HlState {
  return {
    version: 0, seed, cursor: 0, round: 0, phase: 'betting', seats: [],
    pot: 0, base: null, revealed: null, turn: 0, deadline: null, winners: [],
  };
}

function makeSeat(
  userId: string, username: string, avatar: AvatarConfig, level: number, color: string,
  title: string | null, nameColor: string | null,
): HlSeat {
  return { userId, username, avatar, level, title, nameColor, color, alive: false, guess: null, stake: 0, net: 0 };
}

function resetSeats(state: HlState) {
  for (const seat of state.seats) {
    seat.stake = 0;
    seat.net = 0;
    seat.alive = false;
    seat.guess = null;
  }
}

/**
 * The single source of truth for a round of High / Low Survival. Every seated
 * player antes the same amount; the base card is dealt face-up, and each live
 * player calls the next card higher or lower before an 8s timer runs out.
 * Wrong call or no call → eliminated. A tie pushes everyone through. Last one
 * standing takes the whole pot; if the last card wipes everyone at once, the
 * pot splits evenly across that turn's guessers (odd chips go to the
 * lowest-seated one, keeping the table zero-sum). If nobody guessed at all,
 * the round is cancelled and every stake is refunded.
 */
export function reduce(prev: HlState, action: HlAction): HlState {
  const state = clone(prev);
  state.version = prev.version + 1;
  const seatOf = (userId: string) => state.seats.find((s) => s.userId === userId);

  switch (action.type) {
    case 'join': {
      if (seatOf(action.userId) || state.seats.length >= MAX_SEATS) return prev;
      const used = new Set(state.seats.map((s) => s.color));
      const color = (PLAYER_COLORS.find((c) => !used.has(c.hex)) ?? PLAYER_COLORS[0]).hex;
      state.seats.push(makeSeat(
        action.userId, action.username, action.avatar, action.level, color,
        action.title ?? null, action.nameColor ?? null,
      ));
      if (state.phase === 'waiting' && state.seats.length >= MIN_PLAYERS) state.phase = 'betting';
      return state;
    }
    case 'leave': {
      const midRound = state.phase === 'guessing';
      state.seats = state.seats.filter((s) => s.userId !== action.userId);
      if (state.seats.length < MIN_PLAYERS) {
        state.phase = 'waiting';
        state.pot = 0;
        state.base = null;
        state.revealed = null;
        state.turn = 0;
        state.deadline = null;
        state.winners = [];
        resetSeats(state);
        return state;
      }
      if (midRound) {
        // Abandon the live round rather than settle a partial pot; the host
        // opens a fresh betting window next.
        state.phase = 'betting';
        state.pot = 0;
        state.base = null;
        state.revealed = null;
        state.turn = 0;
        state.deadline = null;
        state.winners = [];
        resetSeats(state);
      }
      return state;
    }
    case 'nightAnte': {
      if (action.amount <= 0) return prev;
      // Locked once a round is under way so a mid-round change can't desync what
      // players already deducted client-side.
      if (state.phase !== 'betting' && state.phase !== 'waiting') return prev;
      if (state.seats.some((s) => s.stake > 0)) return prev;
      state.anteMode = true;
      state.anteAmount = action.amount;
      return state;
    }
    case 'start': {
      if (state.phase !== 'betting' && state.phase !== 'waiting') return prev;
      if (state.seats.length < MIN_PLAYERS) return prev;
      const ante = state.anteMode ? (state.anteAmount ?? 0) : (action.ante ?? 0);
      if (ante <= 0) return prev;
      if (action.nonce !== undefined) { state.seed = action.nonce >>> 0; state.cursor = 0; }
      state.round += 1;
      state.turn = 0;
      state.winners = [];
      state.revealed = null;
      for (const seat of state.seats) {
        seat.stake = ante;
        seat.net = 0;
        seat.alive = true;
        seat.guess = null;
      }
      state.pot = ante * state.seats.length;
      state.base = draw(state);
      state.phase = 'guessing';
      state.deadline = action.deadline ?? null;
      return state;
    }
    case 'guess': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'guessing' || !seat.alive) return prev;
      if (action.guess !== 'higher' && action.guess !== 'lower') return prev;
      seat.guess = action.guess;
      return state;
    }
    case 'reveal': {
      if (state.phase !== 'guessing' || !state.base) return prev;
      if (action.nonce !== undefined) { state.seed = action.nonce >>> 0; state.cursor = 0; }

      // No call by the time the card turns over → eliminated.
      for (const seat of state.seats) {
        if (seat.alive && (seat.guess === null || seat.guess === 'hidden')) {
          seat.alive = false;
          seat.net = -seat.stake;
        }
      }

      // Everyone still alive here made a real call this turn.
      const guessers = state.seats.filter((s) => s.alive);

      if (guessers.length === 0) {
        // Every remaining player let the timer run out at once — there's no one
        // to award the pot to, so the round is cancelled: every seat is made
        // whole (net 0) and the pot is cleared. Σ net stays exactly 0.
        for (const seat of state.seats) seat.net = 0;
        state.pot = 0;
        state.revealed = null;
        state.winners = [];
        state.phase = 'settled';
        state.deadline = null;
        return state;
      }

      const next = draw(state);
      state.revealed = next;
      const delta = rank(next) - rank(state.base);
      state.base = next;

      if (delta === 0) {
        // Push — the whole field survives, the new card becomes the base.
        for (const seat of guessers) seat.guess = null;
        state.turn += 1;
        state.deadline = action.deadline ?? null;
        return state;
      }

      const correct = delta > 0 ? 'higher' : 'lower';
      for (const seat of guessers) {
        if (seat.guess !== correct) {
          seat.alive = false;
          seat.net = -seat.stake;
        }
      }

      const survivors = state.seats.filter((s) => s.alive);
      if (survivors.length === 1) {
        survivors[0].net = state.pot - survivors[0].stake;
        state.winners = [survivors[0].userId];
        state.phase = 'settled';
        state.deadline = null;
      } else if (survivors.length === 0) {
        // The card wiped the field at once — split the pot evenly across the
        // seats that guessed this turn. Whatever doesn't divide evenly goes to
        // the lowest-seated guesser, so Σ net across the table is exactly 0.
        const share = Math.floor(state.pot / guessers.length);
        for (const seat of guessers) seat.net = share - seat.stake;
        const remainder = state.pot - share * guessers.length;
        if (remainder > 0) guessers[0].net += remainder;
        state.winners = guessers.map((s) => s.userId);
        state.phase = 'settled';
        state.deadline = null;
      } else {
        for (const seat of survivors) seat.guess = null;
        state.turn += 1;
        state.deadline = action.deadline ?? null;
      }
      return state;
    }
    case 'newRound': {
      if (state.phase !== 'settled' && state.phase !== 'waiting') return prev;
      state.phase = state.seats.length >= MIN_PLAYERS ? 'betting' : 'waiting';
      state.pot = 0;
      state.base = null;
      state.revealed = null;
      state.turn = 0;
      state.deadline = null;
      state.winners = [];
      resetSeats(state);
      return state;
    }
    default:
      return prev;
  }
}

export const seatOf = (state: HlState, userId: string) => state.seats.find((s) => s.userId === userId);
