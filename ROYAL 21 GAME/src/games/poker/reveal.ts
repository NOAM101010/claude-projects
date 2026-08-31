import type { PokerSeat, PokerState } from './types';

/**
 * The single source of truth for "may this viewer see this seat's hole cards?".
 *
 * A hole is public when any of:
 *  - it belongs to the viewer (`isMe`)
 *  - the seat reached showdown and did not fold (`revealed`)
 *  - we are in an all-in runout and the seat is a live contender with 2 cards
 *    (`runoutShow`) — everyone still in the hand flips face-up so the table can
 *    watch the board come out.
 *
 * This mirrors the reveal rule that used to live inline in
 * `PokerScene.SeatCard`. It reads the RAW authoritative state
 * (`state.showdown` / `state.allInEquity`) — NOT the staged `displayShowdown`
 * from `usePokerReveal`. It is meant for:
 *  - server-side redaction (step 2): the host publishes a copy of the state
 *    with every hidden seat's hole blanked, keeping only the seats for which
 *    `isHolePublic` is true for "the public".
 *  - any other place that needs the true rule rather than the UI's staged view.
 *
 * Pure: no side effects, no time, no React.
 */
export function isHolePublic(state: PokerState, seat: PokerSeat, viewerId: string): boolean {
  const isMe = seat.userId === viewerId;
  const inShowdown = state.showdown?.some((s) => s.userId === seat.userId) ?? false;
  return holeVisible({
    isMe,
    inShowdown,
    folded: seat.folded,
    runoutReveal: state.allInEquity !== null,
    holeLen: seat.hole.length,
  });
}

/**
 * The raw boolean shared by {@link isHolePublic} and the `SeatCard` UI.
 *
 * `SeatCard` feeds it the STAGED reveal view (`displayShowdown`,
 * `state.allInEquity !== null`) so hole cards flip in step with the theatrical
 * runout animation, while `isHolePublic` feeds it the authoritative state.
 * The two agree visually: they can only differ mid-runout, and mid-runout every
 * non-folded 2-card seat is already shown via `runoutShow` regardless of the
 * showdown flag, while folded seats are never shown either way.
 */
export function holeVisible(opts: {
  isMe: boolean;
  inShowdown: boolean;
  folded: boolean;
  runoutReveal: boolean;
  holeLen: number;
}): boolean {
  const revealed = opts.inShowdown && !opts.folded;
  const runoutShow = opts.runoutReveal && !opts.folded && opts.holeLen === 2;
  return opts.isMe || revealed || runoutShow;
}
