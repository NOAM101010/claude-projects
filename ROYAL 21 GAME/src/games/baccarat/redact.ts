import type { BaccaratState } from './types';

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Defence-in-depth for the published Baccarat state: zero `seed`/`cursor` so a
 * client can't derive the shoe. The real fix is the deal-time `nonce` (the host
 * reseeds `cursor` only when the deal fires, betting already closed); this just
 * makes sure the pre-deal state carries nothing predictive. No gate, no SQL —
 * it only blanks two public fields.
 */
export function redactBaccaratState(state: BaccaratState): BaccaratState {
  const copy = deepClone(state);
  copy.seed = 0;
  copy.cursor = 0;
  return copy;
}
