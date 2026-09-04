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
 *
 * Two ways a client meets an all-in showdown:
 *  - incrementally — it saw the betting, `displayCommunity` is still short, and
 *    the settled state arrives under the same handNumber.
 *  - cold — a non-host that missed every intermediate row (slow realtime, tab
 *    was backgrounded, just promoted to host) whose first frame of the new hand
 *    is already `street === 'waiting'` with a full board + showdown.
 * Both must stage the reveal; the cold case used to fall through the
 * hand-changed branch and dump the result instantly.
 */
export function usePokerReveal(state: PokerState | null | undefined) {
  const [handSeen, setHandSeen] = useState(state?.handNumber ?? 0);
  const [displayCommunity, setDisplayCommunity] = useState<Card[]>(state?.community ?? []);
  const [displayShowdown, setDisplayShowdown] = useState<ShowdownEntry[] | null>(state?.showdown ?? null);
  const [liveEquity, setLiveEquity] = useState<Record<string, number> | null>(null);
  const [revealing, setRevealing] = useState(false);
  const revealTimers = useRef<number[]>([]);
  /** handNumber whose staged reveal is currently running or already finished —
   *  stops a second publish under the same hand from restarting the timers. */
  const revealStartedFor = useRef(0);

  useEffect(() => {
    if (!state) return;
    const snap = state;

    /** Kick off the staged runout starting from `startLen` community cards. */
    const runStagedReveal = (startLen: number) => {
      revealStartedFor.current = snap.handNumber;
      revealTimers.current.forEach((id) => clearTimeout(id));
      revealTimers.current = [];
      setDisplayShowdown(null);
      setDisplayCommunity(snap.community.slice(0, startLen));
      setRevealing(true);

      const runoutContenders = snap.seats
        .filter((s) => !s.folded && s.hole.length === 2)
        .map((s) => ({ userId: s.userId, hole: s.hole }));
      const seed = snap.seed ^ snap.handNumber;
      setLiveEquity(computeEquity(runoutContenders, snap.community.slice(0, startLen), seed));

      const stages = [3, 4, 5].filter((n) => n > startLen && n <= snap.community.length);
      // No cards left to stage (river all-in): still hold everything for a beat
      // so the table sees the showdown flip before the banner / next hand.
      let delay = stages.length ? 0 : REVEAL_STEP_MS;
      stages.forEach((n) => {
        delay += REVEAL_STEP_MS;
        const id = window.setTimeout(() => {
          setDisplayCommunity(snap.community.slice(0, n));
          if (n < 5) setLiveEquity(computeEquity(runoutContenders, snap.community.slice(0, n), seed));
        }, delay);
        revealTimers.current.push(id);
      });

      delay += REVEAL_SHOWDOWN_DELAY_MS;
      const id = window.setTimeout(() => {
        setDisplayShowdown(snap.showdown);
        setLiveEquity(null);
        setRevealing(false);
      }, delay);
      revealTimers.current.push(id);
    };

    if (snap.handNumber !== handSeen) {
      revealTimers.current.forEach((id) => clearTimeout(id));
      revealTimers.current = [];
      setHandSeen(snap.handNumber);
      setLiveEquity(null);
      // Cold all-in showdown as the very first frame of this hand — stage it from
      // scratch instead of snapping straight to the result.
      const coldAllInShowdown = snap.allInEquity !== null && !!snap.showdown
        && snap.street === 'waiting' && snap.community.length === 5;
      if (coldAllInShowdown) { runStagedReveal(0); return; }
      setDisplayCommunity(snap.community);
      setDisplayShowdown(snap.showdown);
      setRevealing(false);
      return;
    }

    // Same hand — the staged reveal for it is already running or done.
    if (revealStartedFor.current === snap.handNumber) return;

    const isRunout = snap.allInEquity !== null;
    const caughtUp = displayCommunity.length === snap.community.length
      && (snap.showdown === null || displayShowdown !== null);
    if (!isRunout || caughtUp) {
      if (!isRunout) { setDisplayCommunity(snap.community); setDisplayShowdown(snap.showdown); }
      return;
    }

    runStagedReveal(displayCommunity.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.handNumber, state?.community.length, state?.showdown, state?.allInEquity]);

  useEffect(() => () => revealTimers.current.forEach((id) => clearTimeout(id)), []);

  /* Chip counts to render. The engine settles the pot (pays winners, zeroes
     busted seats) in the same synchronous step that begins the runout, so the
     raw `seat.stack` already shows the outcome. While the reveal is playing we
     back that out — `stack - winnings` is exactly what each seat had once all
     bets were in but before the pot was pushed — so nobody can read the result
     off the stacks before the last card lands. Works for side pots (a seat's
     `won` is its total across every pot it took) and the cold-showdown case. */
  const displayStacks = useMemo(() => {
    const out: Record<string, number> = {};
    const won = revealing && state?.showdown
      ? new Map(state.showdown.map((e) => [e.userId, e.won]))
      : null;
    for (const s of state?.seats ?? []) {
      out[s.userId] = s.stack - (won?.get(s.userId) ?? 0);
    }
    return out;
  }, [state?.seats, state?.showdown, revealing]);

  /* Same freeze as displayStacks: the engine zeroes `state.pot` in the same
     synchronous step that settles the hand, so the raw value would show an
     empty pot the instant the runout starts. While revealing, hold it at the
     sum of what the showdown paid out — the pot as it stood right before the
     push — so the chips visually land only once the reveal finishes. */
  const displayPot = useMemo(() => {
    if (revealing && state?.showdown) {
      return state.showdown.reduce((sum, e) => sum + e.won, 0);
    }
    if (!state) return 0;
    return state.pot || state.pots.reduce((s, p) => s + p.amount, 0);
  }, [state?.pot, state?.pots, state?.showdown, revealing]);

  return { displayCommunity, displayShowdown, liveEquity, revealing, displayStacks, displayPot };
}
