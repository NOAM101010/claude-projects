"use client";

import { useEffect, useRef } from "react";

/**
 * Fixed depth plate behind the dashboard: engineering grid, ghost candles,
 * a warm key light and a slow scanline.
 *
 * One rAF for the whole thing. Pointer position is written to refs, eased
 * inside the loop and pushed to CSS custom properties — no React state, so
 * nothing above this component ever re-renders while the mouse moves.
 * Disabled entirely on coarse pointers (CSS) and reduced motion (JS + CSS).
 */
export default function TerminalBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const mq = window.matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)"
    );
    if (!mq.matches) return;

    let raf = 0;
    let running = false;
    // target (from pointer) and eased current, in px of max travel
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const MAX = 14;

    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.setProperty("--px", `${cx.toFixed(2)}px`);
      el.style.setProperty("--py", `${cy.toFixed(2)}px`);
      // park once the eased position has caught up to the pointer
      if (Math.abs(tx - cx) < 0.05 && Math.abs(ty - cy) < 0.05) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -2 * MAX;
      ty = (e.clientY / window.innerHeight - 0.5) * -2 * MAX;
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    wake();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={rootRef} className="dash-backdrop" aria-hidden>
      <div className="dash-layer dash-layer--grid" />
      <div className="dash-layer dash-layer--candles" />
      <div className="dash-layer dash-layer--bloom" />
      <div className="dash-scan" />
      <div className="dash-vignette" />
    </div>
  );
}
