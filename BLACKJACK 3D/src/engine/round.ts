import { Card, DEFAULT_RULES, Hand, Outcome, Phase, RulesConfig } from './types'
import { buildShoe, draw, needsReshuffle } from './deck'
import { canDouble, canSplit, createEmptyHand, isBust, isBlackjack, isTwentyOne, scoreHand } from './hand'
import { resolveHand, resolveInsurance } from './rules'

export interface RoundState {
  phase: Phase
  shoe: Card[]
  hands: Hand[]
  activeHandIndex: number
  dealer: Card[]
  rules: RulesConfig
  outcomes: Outcome[]
  totalDelta: number
}

export function newRound(bet: number, prev?: RoundState, rules: RulesConfig = DEFAULT_RULES): RoundState {
  let shoe = prev?.shoe ?? buildShoe(rules.decks)
  if (needsReshuffle(shoe, rules.decks)) shoe = buildShoe(rules.decks)
  return {
    phase: 'BETTING',
    shoe,
    hands: [createEmptyHand(bet)],
    activeHandIndex: 0,
    dealer: [],
    rules,
    outcomes: [],
    totalDelta: 0,
  }
}

export function dealInitial(state: RoundState): RoundState {
  let s = state.shoe
  const hand = { ...state.hands[0], cards: [] as Card[] }
  const d1 = draw(s, true); s = d1.shoe
  const p1 = draw(s, true); s = p1.shoe
  const d2 = draw(s, false); s = d2.shoe
  const p2 = draw(s, true); s = p2.shoe
  hand.cards = [p1.card, p2.card]
  const dealer: Card[] = [d1.card, d2.card]

  const dealerUp = dealer[0]
  const playerBJ = isBlackjack(hand)
  const nextPhase: Phase = dealerUp.rank === 'A' ? 'INSURANCE' : 'PLAYER'
  const newState: RoundState = { ...state, shoe: s, hands: [hand], dealer, phase: nextPhase, activeHandIndex: 0 }

  // Dealer peek. With a ten-value upcard the dealer checks the hole card before
  // the player acts; without this the player can double or split into a dealer
  // blackjack and lose the extra stake, which no casino would take.
  if (isTenValue(dealerUp) && scoreHand(dealer).total === 21) {
    return resolve({ ...newState, phase: 'RESOLVE' })
  }

  // Player blackjack with no possible dealer blackjack settles straight away.
  if (playerBJ && nextPhase === 'PLAYER') {
    return resolve({ ...newState, phase: 'RESOLVE' })
  }
  return newState
}

function isTenValue(card: Card): boolean {
  return card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K'
}

export function takeInsurance(state: RoundState, take: boolean): RoundState {
  const hand = { ...state.hands[0] }
  if (take) hand.insurance = hand.bet / 2
  const hands = [hand, ...state.hands.slice(1)]
  const playerBJ = isBlackjack(hand)
  const dealerBJ = scoreHand(state.dealer).total === 21
  if (dealerBJ || playerBJ) {
    return resolve({ ...state, hands, phase: 'RESOLVE' })
  }
  return { ...state, hands, phase: 'PLAYER' }
}

export function hit(state: RoundState): RoundState {
  const idx = state.activeHandIndex
  const hand = { ...state.hands[idx], cards: [...state.hands[idx].cards] }
  const { card, shoe } = draw(state.shoe, true)
  hand.cards.push(card)
  const hands = [...state.hands]
  hands[idx] = hand
  let next = { ...state, hands, shoe }
  if (isBust(hand) || isTwentyOne(hand)) return advanceHand(next)
  return next
}

export function stand(state: RoundState): RoundState {
  const idx = state.activeHandIndex
  const hand = { ...state.hands[idx], stood: true }
  const hands = [...state.hands]
  hands[idx] = hand
  return advanceHand({ ...state, hands })
}

export function double(state: RoundState): RoundState {
  const idx = state.activeHandIndex
  const hand = { ...state.hands[idx] }
  if (!canDouble(hand)) return state
  hand.bet *= 2
  hand.doubled = true
  const { card, shoe } = draw(state.shoe, true)
  hand.cards = [...hand.cards, card]
  hand.stood = true
  const hands = [...state.hands]
  hands[idx] = hand
  return advanceHand({ ...state, hands, shoe })
}

export function split(state: RoundState): RoundState {
  const idx = state.activeHandIndex
  const src = state.hands[idx]
  if (!canSplit(src)) return state
  if (state.hands.length > state.rules.maxSplits) return state
  const [a, b] = src.cards
  let shoe = state.shoe
  const drawA = draw(shoe, true); shoe = drawA.shoe
  const drawB = draw(shoe, true); shoe = drawB.shoe
  const h1: Hand = { ...src, cards: [a, drawA.card], fromSplit: true }
  const h2: Hand = { ...createEmptyHand(src.bet, true), cards: [b, drawB.card] }
  const hands = [...state.hands]
  hands.splice(idx, 1, h1, h2)

  // Aces get one card each and auto-stand (unless rule allows hit split aces)
  if (a.rank === 'A' && !state.rules.hitSplitAces) {
    hands[idx].stood = true
    hands[idx + 1].stood = true
    return advanceHand({ ...state, hands, shoe })
  }
  return { ...state, hands, shoe }
}

export function surrender(state: RoundState): RoundState {
  const idx = state.activeHandIndex
  const hand = { ...state.hands[idx], surrendered: true, stood: true }
  if (hand.cards.length !== 2) return state
  if (!state.rules.surrenderAllowed) return state
  const hands = [...state.hands]
  hands[idx] = hand
  return advanceHand({ ...state, hands })
}

function advanceHand(state: RoundState): RoundState {
  let idx = state.activeHandIndex + 1
  while (idx < state.hands.length && state.hands[idx].stood) idx++
  if (idx >= state.hands.length) {
    return beginDealer(state)
  }
  return { ...state, activeHandIndex: idx }
}

/**
 * Player action is over. Turn the hole card face up and hand control to the
 * dealer phase, which the UI steps one card at a time so the reveal is watchable.
 * If every player hand is already dead the dealer never draws.
 */
export function beginDealer(state: RoundState): RoundState {
  const dealer = state.dealer.map(c => ({ ...c, faceUp: true }))
  const next = { ...state, dealer, phase: 'DEALER' as const }
  const anyLive = state.hands.some(h => !isBust(h) && !h.surrendered)
  if (!anyLive) return resolve({ ...next, phase: 'RESOLVE' })
  return next
}

/** Whether the dealer must take another card under the table rules. */
export function dealerNeedsCard(state: RoundState): boolean {
  if (state.phase !== 'DEALER') return false
  if (state.shoe.length === 0) return false
  const { total, soft } = scoreHand(state.dealer)
  if (total > 21) return false
  if (total < 17) return true
  return total === 17 && soft && state.rules.dealerHitsSoft17
}

/** Draws exactly one dealer card. Call only when dealerNeedsCard is true. */
export function dealerDrawOne(state: RoundState): RoundState {
  if (!dealerNeedsCard(state)) return state
  const { card, shoe } = draw(state.shoe, true)
  return { ...state, dealer: [...state.dealer, card], shoe }
}

/** Ends the dealer phase and settles every hand. */
export function finishDealer(state: RoundState): RoundState {
  if (state.phase !== 'DEALER') return state
  return resolve({ ...state, phase: 'RESOLVE' })
}

export function resolve(state: RoundState): RoundState {
  // The round is over, so nothing stays hidden.
  const dealer = state.dealer.map(c => (c.faceUp ? c : { ...c, faceUp: true }))
  state = { ...state, dealer }
  const outcomes: Outcome[] = state.hands.map((h, i) => resolveHand(h, state.dealer, state.rules, i))
  let totalDelta = outcomes.reduce((a, o) => a + o.delta, 0)
  for (const h of state.hands) {
    totalDelta += resolveInsurance(h, state.dealer, state.rules)
  }
  return { ...state, outcomes, totalDelta, phase: 'PAYOUT' }
}

export function activeHand(state: RoundState): Hand | undefined {
  return state.hands[state.activeHandIndex]
}
