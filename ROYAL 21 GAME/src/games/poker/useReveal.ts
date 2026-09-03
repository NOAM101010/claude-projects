import { useEffect, useMemo, useRef, useState } from 'react';
import { computeEquity } from './equity';
import type { Card, PokerState, ShowdownEntry } from './types';

/** Spacing between staged community-card reveals during an all-in runout. */
const REVEAL_STEP_MS = 2200;
/** Extra pause after the board is fully out, before hole cards flip. */
const REVEAL_SHOWDOWN_DELAY_MS = 1500;

/**
 * Theatrical all-in reveal, shared by cash poker and Sit & Go.
 *
 * The engine resolves a full runout (flop through showdown) in one
 * synchronous reduce() — by the time any client sees the new state,
 * everything is already decided. So the suspense has to live entirely on the
 * client: hold the community cards/showdown back from what state actually
 * says, and step them forward on a timer, recomputing live equity at each
 * stage. Normal (non-all-in) hands mirror state instantly.
 */
export function usePokerReveal(state: PokerState | null | undefined) {
  const [handSeen, setHandSeen] = useState(state?.handNumber ?? 0);
  const [displayCommunity, setDisplayCommunity] = useState<Card[]>(state?.community ?? []);
  const [displayShowdown, setDisplayShowdown] = useState<ShowdownEntry[] | null>(state?.showdown ?? null);
  const [liveEquity, setLiveEquity] = useState<Record<string, number> | null>(null);
  const [revealing, setRevealing] = useState(false);
  const revealTimers = useRef<number[]>([]);
  /* Stacks as they stood the last frame before the engine settled the pot.
     The engine pays winners / zeroes losers in the same synchronous step that
     starts the runout, so the raw `seat.stack` jumps ahead of the theatrical
     reveal — showing who won before the last card lands. While `revealing`,
     seats render from this frozen snapshot instead. */
  const preSettleStacks = useRef<Record<string, number>>({});
  const revealDoneFor = useRef(0);

  useEffect(() => {
    if (state && state.street !== 'waiting') {
      preSettleStacks.current = Object.fromEntries(state.seats.map((s) => [s.userId, s.stack]));
    }
  }, [state?.version, state?.street]);

  useEffect(() => {
    if (!state) return;
    if (state.handNumber !== handSeen) {
      revealTimers.current.forEach((id) => clearTimeout(id));
      revealTimers.current = [];
      setHandSeen(state.handNumber);
      setDisplayCommunity(state.community);
      setDisplayShowdown(state.showdown);
      setLiveEquity(null);
      setRevealing(false);
      return;
    }

    const isRunout = state.allInEquity !== null;
    const caughtUp = displayCommunity.length === state.community.length
      && (state.showdown === null || displayShowdown !== null);
    if (!isRunout || caughtUp || revealDoneFor.current === state.handNumber) {
      if (!isRunout) { setDisplayCommunity(state.community); setDisplayShowdown(state.showdown); }
      return;
    }

    revealTimers.current.forEach((id) => clearTimeout(id));
    revealTimers.current = [];
    setRevealing(true);

    const runoutContenders = state.seats
      .filter((s) => !s.folded && s.hole.length === 2)
      .map((s) => ({ userId: s.userId, hole: s.hole }));
    const seed = state.seed ^ state.handNumber;
    setLiveEquity(computeEquity(runoutContenders, displayCommunity, seed));

    const stages = [3, 4, 5].filter((n) => n > displayCommunity.length && n <= state.community.length);
    // River all-in (or any all-in where the board is already fully out): there are
    // no cards left to stage, but we still hold everything back for a beat so the
    // table sees the showdown flip before the win banner / next hand.
    let delay = stages.length ? 0 : REVEAL_STEP_MS;
    stages.forEach((n) => {
      delay += REVEAL_STEP_MS;
      const id = window.setTimeout(() => {
        setDisplayCommunity(state.community.slice(0, n));
        if (n < 5) setLiveEquity(computeEquity(runoutContenders, state.community.slice(0, n), seed));
      }, delay);
      revealTimers.current.push(id);
    });

    if (state.showdown) {
      delay += REVEAL_SHOWDOWN_DELAY_MS;
      const id = window.setTimeout(() => {
        setDisplayShowdown(state.showdown);
        setLiveEquity(null);
        setRevealing(false);
        revealDoneFor.current = state.handNumber;
      }, delay);
      revealTimers.current.push(id);
    } else if (stages.length) {
      const id = window.setTimeout(() => {
        setRevealing(false);
        revealDoneFor.current = state.handNumber;
      }, delay);
      revealTimers.current.push(id);
    } else {
      setRevealing(false);
      revealDoneFor.current = state.handNumber;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.handNumber, state?.community.length, state?.showdown, state?.allInEquity]);

  useEffect(() => () => revealTimers.current.forEach((id) => clearTimeout(id)), []);

  /* What each seat's chip count should read as right now: the frozen pre-settle
     snapshot while the runout is playing out, the live value otherwise. */
  const displayStacks = useMemo(() => {
    const raw: Record<string, number> = {};
    for (const s of state?.seats ?? []) raw[s.userId] = s.stack;
    return revealing ? { ...raw, ...preSettleStacks.current } : raw;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.seats, revealing]);

  return { displayCommunity, displayShowdown, liveEquity, revealing, displayStacks };
}
