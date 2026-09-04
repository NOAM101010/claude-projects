import type { HlState } from './types';

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The copy of `state` that is safe to write to `rooms.state` for everyone to
 * read. While the guess window is open, every seat that has locked in a call
 * shows as `hidden` instead of the real `higher` / `lower`, so nobody can copy
 * a neighbour before the timer runs out — the host keeps the true values in
 * memory and publishes them on reveal. `seed`/`cursor` are zeroed too: the shoe
 * is fully derived from them, and the host reseeds with a fresh nonce on every
 * reveal, so a leaked cursor must never let a client read the next card early.
 */
export function redactHighLow(state: HlState): HlState {
  const copy = deepClone(state);
  copy.seed = 0;
  copy.cursor = 0;
  if (copy.phase === 'guessing') {
    for (const seat of copy.seats) {
      if (seat.guess === 'higher' || seat.guess === 'lower') seat.guess = 'hidden';
    }
  }
  return copy;
}
