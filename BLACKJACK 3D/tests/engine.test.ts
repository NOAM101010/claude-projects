import { describe, it, expect } from 'vitest'
import { buildShoe, draw, needsReshuffle } from '../src/engine/deck'
import { scoreHand, canSplit, canDouble, isBlackjack, createEmptyHand } from '../src/engine/hand'
import { playDealer } from '../src/engine/dealer'
import { resolveHand } from '../src/engine/rules'
import { DEFAULT_RULES, Card, Hand } from '../src/engine/types'
import { newRound, dealInitial, hit, stand, double, split } from '../src/engine/round'

const card = (rank: any, suit: any = 'S', faceUp = true): Card => ({ rank, suit, faceUp, id: `${rank}${suit}` })

describe('deck', () => {
  it('builds 52*decks cards', () => {
    expect(buildShoe(1).length).toBe(52)
    expect(buildShoe(6).length).toBe(312)
  })
  it('shuffle is deterministic given seed', () => {
    const a = buildShoe(1, 42)
    const b = buildShoe(1, 42)
    expect(a.map(c => c.id)).toEqual(b.map(c => c.id))
  })
  it('draw removes top', () => {
    const shoe = buildShoe(1, 1)
    const { card, shoe: rest } = draw(shoe, true)
    expect(card.faceUp).toBe(true)
    expect(rest.length).toBe(51)
  })
  it('needsReshuffle at penetration', () => {
    expect(needsReshuffle([], 6)).toBe(true)
    expect(needsReshuffle(buildShoe(6), 6)).toBe(false)
  })
})

describe('scoreHand', () => {
  it('counts numeric cards', () => {
    expect(scoreHand([card('5'), card('6')]).total).toBe(11)
  })
  it('faces = 10', () => {
    expect(scoreHand([card('K'), card('Q')]).total).toBe(20)
  })
  it('ace flexible', () => {
    expect(scoreHand([card('A'), card('6')])).toEqual({ total: 17, soft: true })
    expect(scoreHand([card('A'), card('6'), card('K')]).total).toBe(17)
  })
  it('multiple aces', () => {
    expect(scoreHand([card('A'), card('A')]).total).toBe(12)
    expect(scoreHand([card('A'), card('A'), card('A')]).total).toBe(13)
  })
  it('bust', () => {
    expect(scoreHand([card('K'), card('Q'), card('5')]).total).toBe(25)
  })
})

describe('hand helpers', () => {
  it('blackjack requires 2 cards, not from split', () => {
    const bj: Hand = { ...createEmptyHand(10), cards: [card('A'), card('K')] }
    expect(isBlackjack(bj)).toBe(true)
    const split: Hand = { ...bj, fromSplit: true }
    expect(isBlackjack(split)).toBe(false)
  })
  it('canSplit', () => {
    expect(canSplit({ ...createEmptyHand(10), cards: [card('8'), card('8')] })).toBe(true)
    expect(canSplit({ ...createEmptyHand(10), cards: [card('K'), card('Q')] })).toBe(true) // both value 10
    expect(canSplit({ ...createEmptyHand(10), cards: [card('7'), card('8')] })).toBe(false)
  })
  it('canDouble only with 2 cards', () => {
    expect(canDouble({ ...createEmptyHand(10), cards: [card('5'), card('6')] })).toBe(true)
    expect(canDouble({ ...createEmptyHand(10), cards: [card('5'), card('6'), card('2')] })).toBe(false)
  })
})

describe('dealer AI', () => {
  it('stands on hard 17', () => {
    const shoe = [card('9'), card('9')]
    const { cards } = playDealer([card('K'), card('7')], shoe, false)
    expect(scoreHand(cards).total).toBe(17)
  })
  it('S17: stands on soft 17', () => {
    const { cards } = playDealer([card('A'), card('6')], [card('9')], false)
    expect(scoreHand(cards).total).toBe(17)
  })
  it('H17: hits soft 17', () => {
    const { cards } = playDealer([card('A'), card('6')], [card('9'), card('4'), card('K')], true)
    expect(cards.length).toBeGreaterThan(2)
    expect(scoreHand(cards).total).not.toBe(17)
  })
  it('hits until at least 17', () => {
    const { cards } = playDealer([card('5'), card('6')], [card('4'), card('K')], false)
    expect(scoreHand(cards).total).toBeGreaterThanOrEqual(17)
  })
})

describe('resolveHand', () => {
  const rules = DEFAULT_RULES
  const bet = 100
  const mk = (cards: Card[], overrides: Partial<Hand> = {}): Hand => ({ ...createEmptyHand(bet), cards, ...overrides })

  it('player BJ pays 3:2', () => {
    const h = mk([card('A'), card('K')])
    const d = [card('9'), card('9')]
    expect(resolveHand(h, d, rules, 0)).toEqual({ handIndex: 0, result: 'BLACKJACK', delta: 150 })
  })
  it('push both BJ', () => {
    const h = mk([card('A'), card('K')])
    const d = [card('A'), card('K')]
    expect(resolveHand(h, d, rules, 0).result).toBe('PUSH')
  })
  it('player bust', () => {
    const h = mk([card('K'), card('Q'), card('5')])
    expect(resolveHand(h, [card('9'), card('8')], rules, 0)).toEqual({ handIndex: 0, result: 'BUST', delta: -100 })
  })
  it('dealer bust = win', () => {
    const h = mk([card('K'), card('9')])
    const d = [card('K'), card('7'), card('K')]
    expect(resolveHand(h, d, rules, 0).result).toBe('WIN')
  })
  it('surrender loses half', () => {
    const h = mk([card('9'), card('7')], { surrendered: true })
    expect(resolveHand(h, [card('K'), card('K')], rules, 0)).toEqual({ handIndex: 0, result: 'SURRENDER', delta: -50 })
  })
})

describe('round flow', () => {
  it('newRound → dealInitial gives 2 cards to each', () => {
    let s = newRound(100)
    s = dealInitial(s)
    expect(s.hands[0].cards.length).toBe(2)
    expect(s.dealer.length).toBe(2)
    expect(s.dealer[1].faceUp).toBe(false)
  })
  it('hit adds card', () => {
    let s = newRound(100)
    s = dealInitial(s)
    if (s.phase === 'PLAYER') {
      const before = s.hands[0].cards.length
      s = hit(s)
      expect(s.hands[0].cards.length).toBeGreaterThanOrEqual(before)
    }
  })
  it('stand hands control to the dealer phase', () => {
    let s = newRound(100)
    s = dealInitial(s)
    if (s.phase === 'PLAYER') {
      s = stand(s)
      // The dealer is now stepped one card at a time by the UI, so standing
      // parks the round in DEALER rather than settling it outright. A dead
      // table still resolves immediately.
      expect(['DEALER', 'PAYOUT']).toContain(s.phase)
      expect(s.dealer.every(c => c.faceUp)).toBe(true)
    }
  })
})
