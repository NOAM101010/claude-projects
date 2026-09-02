import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings, resolvedQuality } from '@/stores/useSettings';
import type { BaccaratMainSide, BaccaratState } from './types';

/** Fallback auto-reveal cadence — one card per second. Worst case (6 cards) ≈ 6s. */
const AUTO_FLIP_MS = 1000;

interface Reveal {
  /** True while this card must still be shown face-down (not yet reached in the
   *  deal-order reveal queue). */
  faceDown: (side: BaccaratMainSide, index: number) => boolean;
  /** True for the single card that is next up in the queue — gets the glow. */
  isNext: (side: BaccaratMainSide, index: number) => boolean;
  /** Reveal the next still-hidden card. Any tap advances the queue, so the
   *  arguments are ignored (kept for call-site symmetry). */
  flip: (side?: BaccaratMainSide, index?: number) => void;
  /** True once every dealt card (both sides) has been revealed — the gate for
   *  showing the result / crediting chips. */
  revealComplete: boolean;
}

type Key = `${BaccaratMainSide}:${number}`;

/**
 * Baccarat "squeeze" reveal, client-local (no engine/action changes — the cards
 * are already in the published state, this only holds the *display* back).
 *
 * Every card of BOTH hands is dealt face-down and turned over one at a time in
 * true dealing order — player 1, banker 1, player 2, banker 2, then a drawn
 * third card for player, then for banker. A tap anywhere flips the next one; a
 * fallback timer flips one per second so a passive player still gets a paced
 * reveal. Reduced motion / low quality → everything instant, nothing face-down.
 *
 * The revealed count is bound to `round` *synchronously* (not via an effect), so
 * a fresh round's first render already sees 0 — otherwise last round's progress
 * would make `revealComplete` briefly true and let the result (and the chip
 * credit) land before the player squeezes anything.
 */
export function useBaccaratReveal(
  state: BaccaratState | null | undefined,
  _mainSide: BaccaratMainSide | null,
): Reveal {
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const quality = useSettings((s) => s.quality);
  const lowQuality = resolvedQuality(quality) === 'low';

  const round = state?.round ?? 0;
  const settled = state?.phase === 'settled';
  const instant = reducedMotion || lowQuality;

  const playerLen = state?.player.length ?? 0;
  const bankerLen = state?.banker.length ?? 0;

  /* The reveal order for the cards currently on the felt. */
  const seq = useMemo<Key[]>(() => {
    const out: Key[] = [];
    for (let i = 0; i < 2; i++) {
      if (i < playerLen) out.push(`player:${i}`);
      if (i < bankerLen) out.push(`banker:${i}`);
    }
    if (playerLen > 2) out.push('player:2');
    if (bankerLen > 2) out.push('banker:2');
    return out;
  }, [playerLen, bankerLen]);
  const total = seq.length;

  const [revealState, setRevealState] = useState<{ round: number; count: number }>(
    () => ({ round, count: 0 }),
  );
  const count = revealState.round === round ? revealState.count : 0;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderOf = (side: BaccaratMainSide, i: number) => seq.indexOf(`${side}:${i}` as Key);

  const faceDown = (side: BaccaratMainSide, i: number): boolean => {
    if (instant || !settled) return false;
    const k = orderOf(side, i);
    return k >= 0 && k >= count;
  };

  const isNext = (side: BaccaratMainSide, i: number): boolean => {
    if (instant || !settled) return false;
    return orderOf(side, i) === count;
  };

  const advance = () => {
    setRevealState((prev) => {
      const c = prev.round === round ? prev.count : 0;
      if (c >= total) return prev.round === round ? prev : { round, count: total };
      return { round, count: c + 1 };
    });
  };

  const flip = () => {
    if (instant || !settled) return;
    advance();
  };

  const revealComplete = instant || !settled || count >= total;

  /* Fallback: turn the next still-hidden card over on a timer. */
  useEffect(() => {
    if (instant || !settled || revealComplete) return;
    timer.current = setTimeout(advance, AUTO_FLIP_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant, settled, revealComplete, round, count, total]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { faceDown, isNext, flip, revealComplete };
}
