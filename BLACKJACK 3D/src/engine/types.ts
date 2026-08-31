export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  rank: Rank
  faceUp: boolean
  id: string
}

export interface Hand {
  cards: Card[]
  bet: number
  doubled: boolean
  surrendered: boolean
  stood: boolean
  fromSplit: boolean
  insurance?: number
}

export type Phase = 'BETTING' | 'DEALING' | 'INSURANCE' | 'PLAYER' | 'DEALER' | 'RESOLVE' | 'PAYOUT'

export interface Outcome {
  handIndex: number
  result: 'WIN' | 'LOSE' | 'PUSH' | 'BLACKJACK' | 'SURRENDER' | 'BUST'
  delta: number
}

export interface RulesConfig {
  decks: number
  dealerHitsSoft17: boolean
  doubleAfterSplit: boolean
  maxSplits: number
  blackjackPayout: number
  insurancePayout: number
  surrenderAllowed: boolean
  resplitAces: boolean
  hitSplitAces: boolean
}

export const DEFAULT_RULES: RulesConfig = {
  decks: 6,
  dealerHitsSoft17: false,
  doubleAfterSplit: true,
  maxSplits: 3,
  blackjackPayout: 1.5,
  insurancePayout: 2,
  surrenderAllowed: false,
  resplitAces: false,
  hitSplitAces: false,
}
