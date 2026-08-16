import { useEffect, useRef, useState } from 'react';

/** Balances count instead of jumping (§32). */
export function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(origin + delta * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = value;
    };
  }, [value, duration]);

  return display;
}
