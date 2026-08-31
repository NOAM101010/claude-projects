import { useEffect, useRef, useState } from 'react';

/**
 * Balances count instead of jumping (§32).
 *
 * The tween always runs from whatever is *currently on screen* (`displayRef`)
 * toward the live `value`, and every run is guaranteed to land exactly on
 * `value` — even if it gets interrupted or throttled. Two failure modes this
 * guards against, both of which showed up as a "frozen" HUD balance that only
 * a scene change would fix:
 *
 *  1. Interrupted tweens. Rapidly changing the value (bet-spam then Clear)
 *     used to leave the internal "from" cursor out of sync with the rendered
 *     number, so the next run could compute a zero delta and bail — stranding
 *     the display at the wrong figure until the component remounted.
 *  2. Throttled rAF. In a backgrounded / unfocused tab `requestAnimationFrame`
 *     is paused entirely; the old tween simply never advanced. A `setTimeout`
 *     backstop now lands the real value regardless.
 */
export function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const raf = useRef<number>();
  const backstop = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const land = () => {
      displayRef.current = value;
      setDisplay(value);
    };

    if (value === displayRef.current) return;

    // Hidden tab: rAF won't fire, so don't even start a tween that would freeze.
    if (typeof document !== 'undefined' && document.hidden) {
      land();
      return;
    }

    const from = displayRef.current;
    const delta = value - from;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = p >= 1 ? value : Math.round(from + delta * eased);
      displayRef.current = next;
      setDisplay(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    backstop.current = setTimeout(() => {
      if (displayRef.current !== value) land();
    }, duration + 150);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (backstop.current) clearTimeout(backstop.current);
    };
  }, [value, duration]);

  return display;
}
