import { useEffect, useRef, useState } from 'react';
import { useSettings, resolvedQuality } from '@/stores/useSettings';
import type { BaccaratMainSide, BaccaratState } from './types';

/** How long a passive player waits before the next un-flipped card on their
 *  side turns over on its own. Worst case (3 cards) ≈ 4.5s. */
const AUTO_FLIP_MS = 1500;

const EMPTY: ReadonlySet<string> = new Set();

interface Reveal {
  /** True while this card must be shown face-down (the bet side, not yet flipped). */
  faceDown: (side: BaccaratMainSide, index: number) => boolean;
  /** Turn a face-down bet-side card over. */
  flip: (side: BaccaratMainSide, index: number) => void;
  /** True once every card on the bet side has been revealed — the gate for
   *  showing the result / crediting chips. */
  revealComplete: boolean;
}

/**
 * Baccarat "squeeze" reveal, client-local (no engine/action changes — the
 * cards are already in the published state, this only holds the *display* back).
 *
 * The side you did NOT bet on is shown face-up immediately. The side you bet on
 * comes out face-down; you tap each card to flip it, or a fallback timer flips
 * the next one every ~1.5s so a passive player still gets a paced reveal. With
 * no main bet, reduced-motion, or low quality → everything is instant, nothing
 * face-down (the pre-squeeze behaviour).
 *
 * The flipped set is bound to `round` *synchronously* (not via an effect), so a
 * fresh round's very first render already sees an empty set — otherwise last
 * round's flips would make `revealComplete` briefly true and let the result
 * (and the chip credit) land before the player squeezes anything.
 */
export function useBaccaratReveal(
  state: BaccaratState | null | undefined,
  mainSide: BaccaratMainSide | null,
): Reveal {
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const quality = useSettings((s) => s.quality);
  const lowQuality = resolvedQuality(quality) === 'low';

  const round = state?.round ?? 0;
  const settled = state?.phase === 'settled';
  const instant = !mainSide || reducedMotion || lowQuality;

  const [flipState, setFlipState] = useState<{ round: number; set: Set<string> }>(
    () => ({ round, set: new Set() }),
  );
  const flipped: ReadonlySet<string> = flipState.round === round ? flipState.set : EMPTY;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const betCount = mainSide && state ? state[mainSide].length : 0;
  const key = (side: BaccaratMainSide, i: number) => `${side}:${i}`;

  const faceDown = (side: BaccaratMainSide, i: number): boolean => {
    if (instant || !settled) return false;
    if (side !== mainSide) return false;
    return !flipped.has(key(side, i));
  };

  const flip = (side: BaccaratMainSide, i: number) => {
    if (instant || side !== mainSide) return;
    setFlipState((prev) => {
      if (prev.round !== round) return { round, set: new Set([key(side, i)]) };
      if (prev.set.has(key(side, i))) return prev;
      const next = new Set(prev.set);
      next.add(key(side, i));
      return { round, set: next };
    });
  };

  const revealComplete = instant || !settled || flipped.size >= betCount;

  /* Fallback: flip the next still-hidden bet-side card on a timer. */
  useEffect(() => {
    if (instant || !settled || revealComplete || !mainSide) return;
    timer.current = setTimeout(() => {
      setFlipState((prev) => {
        const set = prev.round === round ? prev.set : EMPTY;
        for (let i = 0; i < betCount; i++) {
          if (!set.has(key(mainSide, i))) {
            const next = new Set(set);
            next.add(key(mainSide, i));
            return { round, set: next };
          }
        }
        return prev.round === round ? prev : { round, set: new Set() };
      });
    }, AUTO_FLIP_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [instant, settled, revealComplete, mainSide, betCount, round, flipped]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { faceDown, flip, revealComplete };
}
