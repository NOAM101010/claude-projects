/* ══════════════════════════════════════════════════════════════
   THE WALL — shared geometry helpers (imported by scene + climber)
   ══════════════════════════════════════════════════════════════ */

/** world width of the cliff face */
export const WALL_W = 7;
/** world height of the climbable surface */
export const WALL_H = 14;
/** hard cap on rendered climbers (perf) */
export const MAX_CLIMBERS = 12;

export type Range = { min: number; max: number };

/** map a P&L percent onto a world-Y on the cliff (range.min → 0, range.max → WALL_H) */
export function yFor(pct: number, range: Range): number {
  const span = range.max - range.min || 1;
  return ((pct - range.min) / span) * WALL_H;
}

/** spread climber index across the cliff width */
export function xFor(index: number, count: number): number {
  const span = WALL_W - 1.4;
  if (count <= 1) return 0;
  const step = span / (count - 1);
  return -span / 2 + index * step;
}

/** deterministic 32-bit hash of a string (FNV-1a) */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** stable hue 0-360 for a ticker */
export function tickerHue(ticker: string): number {
  return hashStr(ticker) % 360;
}

/** stable phase offset so climbers don't bob in unison */
export function tickerPhase(ticker: string): number {
  return (hashStr(ticker) % 628) / 100;
}

/** seeded deterministic PRNG (mulberry32) → () => float in [0,1) */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
