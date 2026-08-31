import type { Card, PokerState } from './types';
import { isHolePublic } from './reveal';

/**
 * Sentinel that replaces a hidden seat's real hole cards in the published
 * state. Its rank/suit are deliberately non-real — the UI only ever draws a
 * card back for a hole it isn't allowed to see, so the value is never read,
 * but keeping a distinct constant makes "this is redacted, not a bug" obvious
 * in devtools. Cast once here, documented, rather than widening `Card`.
 */
export const HIDDEN_CARD = { r: '?', s: '?' } as unknown as Card;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Produce the copy of `state` that is safe to write to `rooms.state` for
 * `viewerId` (pass `null` for "the public row" everyone reads).
 *
 * - `seed`/`cursor` are zeroed: the deck is fully derived from them, so leaving
 *   them in lets any client rebuild every hole card. This is the real leak —
 *   blanking hole values alone is not enough.
 * - each seat keeps its hole only when the viewer is that seat, or the shared
 *   reveal rule ({@link isHolePublic}) already makes it public (showdown, all-in
 *   runout). Otherwise every card becomes {@link HIDDEN_CARD} while the array
 *   length is preserved (0 if not dealt, 2 if dealt) so the UI still draws the
 *   right number of card backs.
 * - `showdown` / `allInEquity` / `lastResult` are untouched — those ARE the
 *   authorised reveals.
 */
export function redactPokerState(state: PokerState, viewerId: string | null): PokerState {
  const copy = deepClone(state);
  copy.seed = 0;
  copy.cursor = 0;
  copy.seats = copy.seats.map((seat) => {
    const keep = viewerId !== null && seat.userId === viewerId
      ? true
      : isHolePublic(state, seat, viewerId ?? '');
    if (keep) return seat;
    return { ...seat, hole: seat.hole.map(() => HIDDEN_CARD) };
  });
  return copy;
}

/** The per-player hole deals the host stashes server-side for the current hand. */
export function pokerHoleDeals(state: PokerState): { userId: string; cards: Card[] }[] {
  return state.seats
    .filter((seat) => seat.hole.length === 2)
    .map((seat) => ({ userId: seat.userId, cards: seat.hole }));
}
