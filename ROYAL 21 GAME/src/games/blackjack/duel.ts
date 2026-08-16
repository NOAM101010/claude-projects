import { handValue, isBlackjack } from './engine';
import type { BjHand, BjState } from './types';
import { DUEL_ROUND_TARGET } from '@/data/economy';

/**
 * Blackjack vs friends.
 *
 * Nobody plays against anybody's cards — everyone plays the same dealer, and
 * beating the dealer is what scores. That keeps the Blackjack rules untouched
 * and turns the table into a race.
 *
 *   beat the dealer .................. +1
 *   Blackjack ........................ +2
 *   Blackjack while the dealer also has Blackjack ... +1
 *   lose, bust or plain push ......... 0
 */
export type DuelFormat = 'race' | 'bestOf';

export interface DuelConfig {
  format: DuelFormat;
  /** race: points needed. bestOf: number of rounds (each round runs to 10). */
  target: number;
  buyIn: number;
}

export interface DuelScores {
  /** points in the round being played */
  points: Record<string, number>;
  /** rounds won, only used by the best-of format */
  rounds: Record<string, number>;
  round: number;
}

export const emptyScores = (userIds: string[]): DuelScores => ({
  points: Object.fromEntries(userIds.map((id) => [id, 0])),
  rounds: Object.fromEntries(userIds.map((id) => [id, 0])),
  round: 1,
});

export function pointsForHand(hand: BjHand, dealerCards: BjState['dealer']['cards']): number {
  const dealerTotal = handValue(dealerCards).total;
  const dealerBj = dealerCards.length === 2 && dealerTotal === 21;
  const total = handValue(hand.cards).total;

  if (total > 21) return 0;
  if (isBlackjack(hand)) return dealerBj ? 1 : 2;
  if (dealerBj) return 0;
  if (dealerTotal > 21) return 1;
  return total > dealerTotal ? 1 : 0;
}

/** Points a seat scored in the settled hand (split hands each count). */
export function pointsForSeat(state: BjState, userId: string): number {
  const seat = state.seats.find((s) => s.userId === userId);
  if (!seat) return 0;
  return seat.hands.reduce((sum, hand) => sum + pointsForHand(hand, state.dealer.cards), 0);
}

/** Applies a settled hand to the scoreboard. Pure. */
export function scoreHand(config: DuelConfig, scores: DuelScores, state: BjState): DuelScores {
  const next: DuelScores = {
    points: { ...scores.points },
    rounds: { ...scores.rounds },
    round: scores.round,
  };
  for (const seat of state.seats) {
    if (seat.spectator) continue;
    next.points[seat.userId] = (next.points[seat.userId] ?? 0) + pointsForSeat(state, seat.userId);
  }

  const roundTarget = config.format === 'race' ? config.target : DUEL_ROUND_TARGET;
  const leader = leaderOf(next.points);
  if (leader && next.points[leader] >= roundTarget && config.format === 'bestOf') {
    next.rounds[leader] = (next.rounds[leader] ?? 0) + 1;
    next.round += 1;
    Object.keys(next.points).forEach((id) => { next.points[id] = 0; });
  }
  return next;
}

function leaderOf(points: Record<string, number>): string | null {
  const entries = Object.entries(points).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null; // no ties
  return entries[0][0];
}

/** Returns the winning userId once the match is decided, otherwise null. */
export function duelWinner(config: DuelConfig, scores: DuelScores): string | null {
  if (config.format === 'race') {
    const leader = leaderOf(scores.points);
    return leader && scores.points[leader] >= config.target ? leader : null;
  }
  const needed = Math.floor(config.target / 2) + 1;
  const leader = leaderOf(scores.rounds);
  return leader && scores.rounds[leader] >= needed ? leader : null;
}

export const roundTargetOf = (config: DuelConfig) =>
  config.format === 'race' ? config.target : DUEL_ROUND_TARGET;

export const totalRoundsOf = (config: DuelConfig) => (config.format === 'race' ? 1 : config.target);

/** The pot every player has paid into. */
export const potOf = (config: DuelConfig, playerCount: number) => config.buyIn * playerCount;
