import { Card, Hand, RulesConfig } from './types'
import { cardValue, canDouble, canSplit, scoreHand } from './hand'

export type Move = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'SURRENDER'

/** Dealer upcard as a strategy column: 2-10, or 11 for an ace. */
function upcardValue(up: Card): number {
  return up.rank === 'A' ? 11 : cardValue(up.rank)
}

/**
 * Multi-deck S17 basic strategy. Each entry lists the dealer upcards (2..11) for
 * which the aggressive move applies; everything else falls through.
 */
const PAIR_SPLIT: Record<number, number[]> = {
  11: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // aces
  10: [],
  9: [2, 3, 4, 5, 6, 8, 9],
  8: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  7: [2, 3, 4, 5, 6, 7],
  6: [2, 3, 4, 5, 6],
  5: [],
  4: [5, 6],
  3: [2, 3, 4, 5, 6, 7],
  2: [2, 3, 4, 5, 6, 7],
}

const SOFT_DOUBLE: Record<number, number[]> = {
  13: [5, 6], 14: [5, 6], 15: [4, 5, 6], 16: [4, 5, 6],
  17: [3, 4, 5, 6], 18: [2, 3, 4, 5, 6], 19: [6],
}

const HARD_DOUBLE: Record<number, number[]> = {
  9: [3, 4, 5, 6],
  10: [2, 3, 4, 5, 6, 7, 8, 9],
  11: [2, 3, 4, 5, 6, 7, 8, 9, 10],
}

/**
 * Recommends the basic-strategy move for the hand against the dealer's upcard.
 * Returns the ideal move; the caller decides whether it is currently legal
 * (a double after three cards falls back to hit, and so on).
 */
export function bestMove(hand: Hand, upcard: Card, rules: RulesConfig): Move {
  const up = upcardValue(upcard)
  const { total, soft } = scoreHand(hand.cards)
  const twoCards = hand.cards.length === 2
  const canDbl = canDouble(hand) && (!hand.fromSplit || rules.doubleAfterSplit)

  if (twoCards && canSplit(hand) && hand.cards.length === 2) {
    const pairValue = hand.cards[0].rank === 'A' ? 11 : cardValue(hand.cards[0].rank)
    if (PAIR_SPLIT[pairValue]?.includes(up)) return 'SPLIT'
  }

  if (twoCards && !hand.fromSplit && rules.surrenderAllowed) {
    if (total === 16 && !soft && [9, 10, 11].includes(up)) return 'SURRENDER'
    if (total === 15 && !soft && up === 10) return 'SURRENDER'
  }

  if (soft) {
    if (canDbl && SOFT_DOUBLE[total]?.includes(up)) return 'DOUBLE'
    if (total >= 19) return 'STAND'
    if (total === 18) return up >= 9 ? 'HIT' : 'STAND'
    return 'HIT'
  }

  if (canDbl && HARD_DOUBLE[total]?.includes(up)) return 'DOUBLE'
  if (total >= 17) return 'STAND'
  if (total >= 13) return up >= 7 ? 'HIT' : 'STAND'
  if (total === 12) return up >= 4 && up <= 6 ? 'STAND' : 'HIT'
  return 'HIT'
}
