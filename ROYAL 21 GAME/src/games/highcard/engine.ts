import { buildShoe, cardValue } from '@/games/blackjack/engine';
import { PLAYER_COLORS } from '@/games/roulette/engine';
import type { AvatarConfig } from '@/types';
import type { Card } from '@/games/blackjack/types';
import type { HcAction, HcSeat, HcState } from './types';
import { MAX_SEATS } from './types';

export { MAX_SEATS };

export function createState(seed: number): HcState {
  return { version: 0, seed, cursor: 0, round: 0, phase: 'betting', seats: [], pot: 0, warRound: 0, winners: [], deadline: null };
}

function makeSeat(userId: string, username: string, avatar: AvatarConfig, level: number, color: string): HcSeat {
  return { userId, username, avatar, level, color, stake: 0, card: null, contending: false, net: 0 };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Ace-high rank, matching the solo table's own comparison. */
const rank = (card: Card) => (card.r === 'A' ? 14 : ['J', 'Q', 'K'].includes(card.r) ? 10 + ['J', 'Q', 'K'].indexOf(card.r) + 1 : cardValue(card.r));

/** Deterministic draw, derived from seed + cursor so every client can verify it. */
function draw(state: HcState): Card {
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

/**
 * The single source of truth for a round of High Card. Everyone who antes in
 * draws one card; the highest card takes the whole pot. A tie sends just the
 * tied seats back to a war re-draw — the pot doesn't grow further, war here
 * just keeps narrowing the field until one card stands alone.
 */
export function reduce(prev: HcState, action: HcAction): HcState {
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
    case 'ante': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting' || action.amount <= 0) return prev;
      seat.stake = action.amount;
      return state;
    }
    case 'clearAnte': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting') return prev;
      seat.stake = 0;
      return state;
    }
    case 'openBetting': {
      state.phase = 'betting';
      state.round += 1;
      state.pot = 0;
      state.warRound = 0;
      state.winners = [];
      state.deadline = action.deadline ?? null;
      for (const seat of state.seats) {
        seat.stake = 0;
        seat.card = null;
        seat.contending = false;
        seat.net = 0;
      }
      return state;
    }
    case 'draw': {
      if (state.phase === 'betting') {
        const ready = state.seats.filter((s) => s.stake > 0);
        if (ready.length < 2) return prev;
        state.pot = ready.reduce((sum, s) => sum + s.stake, 0);
        for (const seat of state.seats) {
          const inRound = seat.stake > 0;
          seat.card = inRound ? draw(state) : null;
          seat.contending = inRound;
        }
      } else if (state.phase === 'war') {
        const contenders = state.seats.filter((s) => s.contending);
        for (const seat of contenders) seat.card = draw(state);
      } else {
        return prev;
      }

      const contenders = state.seats.filter((s) => s.contending);
      let best = -1;
      for (const seat of contenders) if (seat.card && rank(seat.card) > best) best = rank(seat.card);
      const winners = contenders.filter((s) => s.card && rank(s.card) === best);

      if (winners.length === 1) {
        const winner = winners[0];
        for (const seat of contenders) seat.net = seat.userId === winner.userId ? state.pot - seat.stake : -seat.stake;
        state.winners = [winner.userId];
        state.phase = 'settled';
      } else {
        for (const seat of contenders) {
          if (!winners.includes(seat)) { seat.contending = false; seat.net = -seat.stake; }
        }
        state.phase = 'war';
        state.warRound += 1;
      }
      return state;
    }
    default:
      return prev;
  }
}

export const seatOf = (state: HcState, userId: string) => state.seats.find((s) => s.userId === userId);
