import { Card, Hand, Outcome, RulesConfig } from './types'
import { isBlackjack, scoreHand } from './hand'

export function resolveHand(
  hand: Hand,
  dealer: Card[],
  rules: RulesConfig,
  handIndex: number
): Outcome {
  if (hand.surrendered) {
    return { handIndex, result: 'SURRENDER', delta: -hand.bet / 2 }
  }
  const p = scoreHand(hand.cards).total
  const d = scoreHand(dealer).total
  const playerBJ = isBlackjack(hand)
  const dealerBJ = dealer.length === 2 && d === 21
  const bet = hand.bet

  if (p > 21) return { handIndex, result: 'BUST', delta: -bet }
  if (playerBJ && !dealerBJ) return { handIndex, result: 'BLACKJACK', delta: bet * rules.blackjackPayout }
  if (playerBJ && dealerBJ) return { handIndex, result: 'PUSH', delta: 0 }
  if (dealerBJ && !playerBJ) return { handIndex, result: 'LOSE', delta: -bet }
  if (d > 21) return { handIndex, result: 'WIN', delta: bet }
  if (p > d) return { handIndex, result: 'WIN', delta: bet }
  if (p < d) return { handIndex, result: 'LOSE', delta: -bet }
  return { handIndex, result: 'PUSH', delta: 0 }
}

export function resolveInsurance(hand: Hand, dealer: Card[], rules: RulesConfig): number {
  if (!hand.insurance) return 0
  const dealerBJ = dealer.length === 2 && scoreHand(dealer).total === 21
  return dealerBJ ? hand.insurance * rules.insurancePayout : -hand.insurance
}
