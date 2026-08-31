import { Card, Rank, Suit } from './types'

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function buildShoe(decks = 6, seed = Date.now()): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        cards.push({ suit: s, rank: r, faceUp: false, id: `${d}-${s}${r}-${cards.length}` })
      }
    }
  }
  return shuffle(cards, seed)
}

export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = [...arr]
  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function draw(shoe: Card[], faceUp = true): { card: Card; shoe: Card[] } {
  if (shoe.length === 0) throw new Error('Shoe empty')
  const [card, ...rest] = shoe
  return { card: { ...card, faceUp }, shoe: rest }
}

export function needsReshuffle(shoe: Card[], decks = 6): boolean {
  return shoe.length < decks * 52 * 0.25
}
