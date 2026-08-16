import { mulberry32 } from '@/lib/random';
import { SUITS, RANKS } from '@/games/blackjack/engine';
import { bestHand, compareScore, combinations } from './handEval';
import type { Card } from './types';

export interface EquityContender {
  userId: string;
  hole: Card[];
}

const MONTE_CARLO_SAMPLES = 600;

/**
 * Win probability per contender for a given (possibly partial) board — exact
 * enumeration once two or fewer community cards are still unknown, a seeded
 * Monte Carlo sample otherwise (preflop, where exhaustive enumeration is
 * ~1.4M boards). Shared by the engine's all-in snapshot and the live equity
 * readout the UI recomputes as each community card is revealed.
 */
export function computeEquity(contenders: EquityContender[], community: Card[], mcSeed: number): Record<string, number> {
  if (contenders.length === 0) return {};
  if (contenders.length === 1) return { [contenders[0].userId]: 1 };

  const need = Math.max(0, 5 - community.length);
  const used = new Set<string>();
  for (const c of contenders) for (const card of c.hole) used.add(card.r + card.s);
  for (const card of community) used.add(card.r + card.s);
  const remaining: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) { const key = r + s; if (!used.has(key)) remaining.push({ r, s }); }

  const wins = new Map<string, number>();
  contenders.forEach((c) => wins.set(c.userId, 0));
  let total = 0;
  const scoreRunout = (extra: Card[]) => {
    const board = [...community, ...extra];
    let best: number[] | null = null;
    let winners: string[] = [];
    for (const c of contenders) {
      const { score } = bestHand([...c.hole, ...board]);
      if (!best || compareScore(score, best) > 0) { best = score; winners = [c.userId]; }
      else if (compareScore(score, best) === 0) winners.push(c.userId);
    }
    winners.forEach((id) => wins.set(id, (wins.get(id) ?? 0) + 1 / winners.length));
    total += 1;
  };

  if (need <= 2) {
    for (const runout of combinations(remaining, need)) scoreRunout(runout);
  } else {
    const rng = mulberry32(mcSeed >>> 0);
    for (let i = 0; i < MONTE_CARLO_SAMPLES; i++) {
      const pool = [...remaining];
      const picked: Card[] = [];
      for (let k = 0; k < need; k++) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      scoreRunout(picked);
    }
  }

  const equity: Record<string, number> = {};
  contenders.forEach((c) => { equity[c.userId] = total > 0 ? (wins.get(c.userId) ?? 0) / total : 0; });
  return equity;
}
