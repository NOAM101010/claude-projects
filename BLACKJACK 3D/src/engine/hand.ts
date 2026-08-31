import { Card, Hand, Rank } from './types'

const CARD_VALUES: Record<Rank, number> = {
  A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 10, Q: 10, K: 10,
}

export function cardValue(rank: Rank): number {
  return CARD_VALUES[rank]
}

export function scoreHand(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += CARD_VALUES[c.rank]
    if (c.rank === 'A') aces++
  }
  let soft = aces > 0
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  soft = aces > 0 && total <= 21
  return { total, soft }
}

export function isBust(hand: Hand): boolean {
  return scoreHand(hand.cards).total > 21
}

export function isBlackjack(hand: Hand): boolean {
  return hand.cards.length === 2 && scoreHand(hand.cards).total === 21 && !hand.fromSplit
}

export function isTwentyOne(hand: Hand): boolean {
  return scoreHand(hand.cards).total === 21
}

export function canSplit(hand: Hand): boolean {
  if (hand.cards.length !== 2) return false
  return CARD_VALUES[hand.cards[0].rank] === CARD_VALUES[hand.cards[1].rank]
}

export function canDouble(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.doubled
}

export function createEmptyHand(bet = 0, fromSplit = false): Hand {
  return { cards: [], bet, doubled: false, surrendered: false, stood: false, fromSplit }
}
