import type { Card, BjState } from './types';

/**
 * Sentinel for the dealer's face-down hole card in the published state. The UI
 * always draws a card back for `dealer.cards[1]` while `dealer.hidden` is true,
 * so the value is never read — but blanking it stops the real card sitting in
 * every client's memory. Cast once, documented, rather than widening `Card`.
 */
export const HIDDEN_CARD = { r: '?', s: '?' } as unknown as Card;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The copy of a multiplayer Blackjack state that is safe to write to
 * `rooms.state`:
 *  - `seed`/`cursor` zeroed — the shoe is fully derived from them, so leaving
 *    them in lets any client read the dealer hole and every upcoming card.
 *  - while `dealer.hidden`, `dealer.cards[1]` becomes {@link HIDDEN_CARD}
 *    (length and `hidden` preserved). After `resolveDealer` flips `hidden` to
 *    false the real cards flow through untouched.
 * Player hands are already face-up to the whole table, so they're left as-is.
 */
export function redactBjState(state: BjState): BjState {
  const copy = deepClone(state);
  copy.seed = 0;
  copy.cursor = 0;
  if (copy.dealer.hidden && copy.dealer.cards.length >= 2) {
    copy.dealer.cards = copy.dealer.cards.map((card, i) => (i === 1 ? HIDDEN_CARD : card));
  }
  return copy;
}
