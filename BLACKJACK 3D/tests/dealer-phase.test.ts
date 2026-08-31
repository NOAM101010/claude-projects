import { describe, it, expect } from 'vitest'
import { Card, DEFAULT_RULES, Hand } from '../src/engine/types'
import { createEmptyHand, scoreHand } from '../src/engine/hand'
import { beginDealer, dealInitial, dealerNeedsCard, dealerDrawOne, finishDealer, RoundState } from '../src/engine/round'
import { bestMove } from '../src/engine/strategy'

const card = (rank: any, suit: any = 'S', faceUp = true): Card => ({
  rank, suit, faceUp, id: `${rank}${suit}${Math.random()}`,
})

function state(dealer: Card[], hands: Hand[], shoe: Card[] = []): RoundState {
  return {
    phase: 'PLAYER', shoe, hands, activeHandIndex: 0, dealer,
    rules: DEFAULT_RULES, outcomes: [], totalDelta: 0,
  }
}

const live = (cards: Card[]): Hand => ({ ...createEmptyHand(100), cards, stood: true })
const busted = (): Hand => ({ ...createEmptyHand(100), cards: [card('K'), card('Q'), card('5')], stood: true })

describe('beginDealer', () => {
  it('turns the hole card face up', () => {
    const s = beginDealer(state([card('K'), card('7', 'H', false)], [live([card('9'), card('9')])]))
    expect(s.dealer.every(c => c.faceUp)).toBe(true)
  })

  it('enters the DEALER phase when a live hand remains', () => {
    const s = beginDealer(state([card('K'), card('6', 'H', false)], [live([card('9'), card('9')])]))
    expect(s.phase).toBe('DEALER')
  })

  it('skips straight to payout when every hand is dead', () => {
    const s = beginDealer(state([card('K'), card('6', 'H', false)], [busted()]))
    expect(s.phase).toBe('PAYOUT')
    // The dealer must not draw against a table with nothing live on it.
    expect(s.dealer.length).toBe(2)
  })
})

describe('dealerNeedsCard', () => {
  const withDealer = (cards: Card[], shoe: Card[] = [card('5')]) =>
    beginDealer(state(cards, [live([card('9'), card('9')])], shoe))

  it('draws below 17', () => {
    expect(dealerNeedsCard(withDealer([card('K'), card('6')]))).toBe(true)
  })

  it('stands on hard 17', () => {
    expect(dealerNeedsCard(withDealer([card('K'), card('7')]))).toBe(false)
  })

  it('stands on soft 17 under S17', () => {
    expect(dealerNeedsCard(withDealer([card('A'), card('6')]))).toBe(false)
  })

  it('hits soft 17 under H17', () => {
    const s = withDealer([card('A'), card('6')])
    const h17 = { ...s, rules: { ...s.rules, dealerHitsSoft17: true } }
    expect(dealerNeedsCard(h17)).toBe(true)
  })

  it('stops when busted', () => {
    expect(dealerNeedsCard(withDealer([card('K'), card('Q'), card('5')]))).toBe(false)
  })

  it('stops when the shoe runs dry rather than looping forever', () => {
    expect(dealerNeedsCard(withDealer([card('2'), card('3')], []))).toBe(false)
  })

  it('is false outside the dealer phase', () => {
    expect(dealerNeedsCard(state([card('2'), card('3')], [live([card('9'), card('9')])], [card('5')]))).toBe(false)
  })
})

describe('dealerDrawOne', () => {
  it('adds exactly one face-up card and consumes the shoe', () => {
    const s = beginDealer(state([card('K'), card('6')], [live([card('9'), card('9')])], [card('4'), card('9')]))
    const next = dealerDrawOne(s)
    expect(next.dealer.length).toBe(3)
    expect(next.dealer[2].faceUp).toBe(true)
    expect(next.shoe.length).toBe(1)
  })

  it('is a no-op when no card is needed', () => {
    const s = beginDealer(state([card('K'), card('7')], [live([card('9'), card('9')])], [card('4')]))
    expect(dealerDrawOne(s)).toBe(s)
  })

  it('stepping to completion matches the rules', () => {
    let s = beginDealer(state([card('2'), card('3')], [live([card('K'), card('9')])], [card('4'), card('5'), card('9')]))
    let guard = 0
    while (dealerNeedsCard(s) && guard++ < 20) s = dealerDrawOne(s)
    expect(scoreHand(s.dealer).total).toBeGreaterThanOrEqual(17)
  })
})

describe('finishDealer', () => {
  it('settles into PAYOUT with outcomes', () => {
    const s = beginDealer(state([card('K'), card('7')], [live([card('K'), card('9')])], []))
    const done = finishDealer(s)
    expect(done.phase).toBe('PAYOUT')
    expect(done.outcomes).toHaveLength(1)
    expect(done.outcomes[0].result).toBe('WIN')
  })
})

describe('dealer peek', () => {
  /**
   * A stacked shoe: dealt in the order dealer-up, player, dealer-hole, player.
   */
  const shoe = (cards: Card[]): RoundState => ({
    phase: 'BETTING', shoe: [...cards, ...Array.from({ length: 10 }, () => card('7'))],
    hands: [createEmptyHand(100)], activeHandIndex: 0, dealer: [],
    rules: DEFAULT_RULES, outcomes: [], totalDelta: 0,
  })

  it('settles at once when a ten-value upcard hides an ace', () => {
    // dealer K, player 9, dealer A (hole), player 8
    const s = dealInitial(shoe([card('K'), card('9'), card('A'), card('8')]))
    expect(s.phase).toBe('PAYOUT')
    expect(s.outcomes[0].result).toBe('LOSE')
    // The player never got to double, so only the original stake is lost.
    expect(s.outcomes[0].delta).toBe(-100)
  })

  it('lets play continue when the ten-value upcard hides no blackjack', () => {
    const s = dealInitial(shoe([card('K'), card('9'), card('5'), card('8')]))
    expect(s.phase).toBe('PLAYER')
  })

  it('offers insurance on an ace rather than peeking silently', () => {
    const s = dealInitial(shoe([card('A'), card('9'), card('K'), card('8')]))
    expect(s.phase).toBe('INSURANCE')
  })

  it('pushes when both have blackjack behind a ten', () => {
    const s = dealInitial(shoe([card('K'), card('A'), card('A'), card('Q')]))
    expect(s.phase).toBe('PAYOUT')
    expect(s.outcomes[0].result).toBe('PUSH')
  })
})

describe('basic strategy', () => {
  const hand = (cards: Card[], over: Partial<Hand> = {}): Hand => ({ ...createEmptyHand(100), cards, ...over })

  it('splits aces and eights against anything', () => {
    expect(bestMove(hand([card('A'), card('A', 'H')]), card('K'), DEFAULT_RULES)).toBe('SPLIT')
    expect(bestMove(hand([card('8'), card('8', 'H')]), card('K'), DEFAULT_RULES)).toBe('SPLIT')
  })

  it('never splits tens or fives', () => {
    expect(bestMove(hand([card('K'), card('Q')]), card('6'), DEFAULT_RULES)).toBe('STAND')
    expect(bestMove(hand([card('5'), card('5', 'H')]), card('6'), DEFAULT_RULES)).toBe('DOUBLE')
  })

  it('doubles 11 against a low upcard', () => {
    expect(bestMove(hand([card('6'), card('5')]), card('6'), DEFAULT_RULES)).toBe('DOUBLE')
  })

  it('stands on hard 17+', () => {
    expect(bestMove(hand([card('K'), card('7')]), card('A'), DEFAULT_RULES)).toBe('STAND')
  })

  it('hits hard 16 against a 7', () => {
    expect(bestMove(hand([card('K'), card('6')]), card('7'), DEFAULT_RULES)).toBe('HIT')
  })

  it('stands on hard 13 against a 5', () => {
    expect(bestMove(hand([card('K'), card('3')]), card('5'), DEFAULT_RULES)).toBe('STAND')
  })

  it('surrenders 16 against a 10 when the table allows it', () => {
    const withSurrender = { ...DEFAULT_RULES, surrenderAllowed: true }
    expect(bestMove(hand([card('K'), card('6')]), card('K'), withSurrender)).toBe('SURRENDER')
  })

  it('hits 16 against a 10 on our table, where surrender is off', () => {
    expect(DEFAULT_RULES.surrenderAllowed).toBe(false)
    expect(bestMove(hand([card('K'), card('6')]), card('K'), DEFAULT_RULES)).toBe('HIT')
  })

  it('hits soft 18 against a 9', () => {
    // Three cards so the double branch is out of the way: A+3+4 = soft 18.
    expect(bestMove(hand([card('A'), card('3'), card('4')]), card('9'), DEFAULT_RULES)).toBe('HIT')
  })

  it('stands on soft 18 against a 6 when it cannot double', () => {
    expect(bestMove(hand([card('A'), card('3'), card('4')]), card('6'), DEFAULT_RULES)).toBe('STAND')
  })

  it('doubles soft 18 against a 6 on two cards', () => {
    expect(bestMove(hand([card('A'), card('7')]), card('6'), DEFAULT_RULES)).toBe('DOUBLE')
  })

  it('stands on hard 18', () => {
    expect(bestMove(hand([card('A'), card('7'), card('K')]), card('9'), DEFAULT_RULES)).toBe('STAND')
  })

  it('stands on soft 19', () => {
    expect(bestMove(hand([card('A'), card('4'), card('4')]), card('5'), DEFAULT_RULES)).toBe('STAND')
  })

  it('does not recommend doubling a hand that cannot double', () => {
    const threeCards = hand([card('4'), card('3'), card('4')])
    expect(bestMove(threeCards, card('6'), DEFAULT_RULES)).not.toBe('DOUBLE')
  })
})
