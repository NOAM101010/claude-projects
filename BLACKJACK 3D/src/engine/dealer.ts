import { Card } from './types'
import { draw } from './deck'
import { scoreHand } from './hand'

export function playDealer(
  initial: Card[],
  shoe: Card[],
  hitsSoft17: boolean
): { cards: Card[]; shoe: Card[] } {
  let cards = initial.map(c => ({ ...c, faceUp: true }))
  let remaining = shoe
  while (true) {
    const { total, soft } = scoreHand(cards)
    if (total > 21) break
    if (remaining.length === 0) break
    if (total >= 18) break
    if (total === 17 && !(soft && hitsSoft17)) break
    if (total < 17 || (total === 17 && soft && hitsSoft17)) {
      const { card, shoe: rest } = draw(remaining, true)
      cards.push(card)
      remaining = rest
      continue
    }
    break
  }
  return { cards, shoe: remaining }
}

export function dealerUpcard(cards: Card[]): Card | null {
  return cards.find(c => c.faceUp) ?? null
}
