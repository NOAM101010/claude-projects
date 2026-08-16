import type { Card } from './types';

export type HandCategory =
  | 'highCard' | 'pair' | 'twoPair' | 'threeKind' | 'straight'
  | 'flush' | 'fullHouse' | 'fourKind' | 'straightFlush' | 'royalFlush';

const CATEGORY_BY_SCORE: HandCategory[] = [
  'highCard', 'highCard', 'pair', 'twoPair', 'threeKind',
  'straight', 'flush', 'fullHouse', 'fourKind', 'straightFlush',
];

export const rankValue = (r: Card['r']) => (r === 'A' ? 14 : r === 'K' ? 13 : r === 'Q' ? 12 : r === 'J' ? 11 : Number(r));

/** Best 5-of-N evaluation. Higher score array (lexicographic) wins. */
export interface HandResult {
  score: number[];
  category: HandCategory;
  cards: Card[];
}

function evaluate5(cards: Card[]): number[] {
  const values = cards.map((c) => rankValue(c.r)).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.s === cards[0].s);
  const uniqueVals = Array.from(new Set(values)).sort((a, b) => b - a);

  let straightHigh = 0;
  if (uniqueVals.length === 5) {
    if (uniqueVals[0] - uniqueVals[4] === 4) straightHigh = uniqueVals[0];
    else if (uniqueVals.join(',') === '14,5,4,3,2') straightHigh = 5; // wheel: A-2-3-4-5, ace plays low
  }

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([v, c]) => ({ v, c }))
    .sort((a, b) => (b.c - a.c) || (b.v - a.v));

  if (straightHigh && isFlush) return [9, straightHigh];
  if (groups[0].c === 4) return [8, groups[0].v, groups[1].v];
  if (groups[0].c === 3 && groups[1].c === 2) return [7, groups[0].v, groups[1].v];
  if (isFlush) return [6, ...values];
  if (straightHigh) return [5, straightHigh];
  if (groups[0].c === 3) return [4, groups[0].v, ...groups.slice(1).map((g) => g.v)];
  if (groups[0].c === 2 && groups[1]?.c === 2) {
    const [hi, lo] = [groups[0].v, groups[1].v].sort((a, b) => b - a);
    return [3, hi, lo, groups[2].v];
  }
  if (groups[0].c === 2) return [2, groups[0].v, ...groups.slice(1).map((g) => g.v)];
  return [1, ...values];
}

export const compareScore = (a: number[], b: number[]): number => {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

export function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, k - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/** Best 5-card hand out of 5–7 cards (2 hole + up to 5 community). */
export function bestHand(cards: Card[]): HandResult {
  const pool = cards.length <= 5 ? [cards] : combinations(cards, 5);
  let best: HandResult | null = null;
  for (const five of pool) {
    const score = evaluate5(five);
    if (!best || compareScore(score, best.score) > 0) {
      const category = score[0] === 9 && score[1] === 14 ? 'royalFlush' : CATEGORY_BY_SCORE[score[0]];
      best = { score, category, cards: five };
    }
  }
  return best!;
}
