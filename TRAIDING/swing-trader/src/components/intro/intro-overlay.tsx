"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import CandleField from "./candle-field";
import "./intro.css";

/**
 * INTRO — "THE CINEMATIC TERMINAL"
 *
 * Two tall doors part on a warm amber seam → a candle field builds left→right
 * with a scanning reticle that snaps real detection boxes onto real patterns →
 * a serif headline converges out of an RGB split → CTA slams the doors shut
 * with a chromatic flash and hands over to the app.
 *
 * Shown once per browser session (sessionStorage). ESC / "דלג" close it.
 * Mount-gated → renders nothing on the server, so SSR/hydration stay untouched.
 */

const SEEN_KEY = "swing_intro_seen";

/** headline — serif display, revealed word by word */
const HEAD_A = ["כל", "נר", "—"];
const HEAD_B = ["החלטה."];
const SUBLINE = "מסחר · סריקה · יומן · לוח בקרה";

const TICKS: Array<[string, string, number]> = [
  ["NVDA", "184.22", 2.41],
  ["AAPL", "241.05", 0.63],
  ["SPY", "612.80", 0.31],
  ["MSFT", "438.19", -0.48],
  ["META", "702.44", 1.87],
  ["AMD", "162.37", -1.24],
  ["QQQ", "541.63", 0.52],
  ["TSLA", "356.90", 3.12],
  ["AVGO", "228.71", 1.06],
  ["NFLX", "912.35", -0.71],
  ["COIN", "298.14", 4.28],
  ["GOOGL", "197.62", 0.44],
  ["AMZN", "231.08", -0.29],
  ["PLTR", "84.55", 2.96],
  ["IWM", "238.41", -0.83],
];

export default function IntroOverlay() {
  const [cfg, setCfg] = useState<{ lite: boolean; reduced: boolean } | null>(null);
  const [closing, setClosing] = useState(false);
  const visible = cfg !== null;
  const lite = cfg?.lite ?? false;
  const reduced = cfg?.reduced ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  // ---- decide on the client only (no SSR output at all) ----
  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = window.innerWidth < 820;
    prevFocus.current = document.activeElement as HTMLElement | null;
    // mark immediately — a mid-intro reload shouldn't replay it
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode — just don't persist */
    }
    setCfg({
      lite: coarse || small,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, []);

  const close = useCallback(() => {
    setClosing(true);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode — just don't persist */
    }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setCfg(null);
      const prev = prevFocus.current;
      const usePrev = prev && prev !== document.body && document.contains(prev);
      const target = usePrev ? prev : (document.querySelector("main") as HTMLElement | null);
      target?.focus?.({ preventScroll: true });
    }, 900);
  }, []);

  // ---- scroll lock, ESC, focus, reduced-motion auto-dismiss ----
  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab") {
        // tiny focus trap: only skip + CTA are reachable
        const nodes = [skipRef.current, ctaRef.current].filter(Boolean) as HTMLElement[];
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === rootRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    const focusTimer = setTimeout(
      () => ctaRef.current?.focus({ preventScroll: true }),
      reduced ? 30 : 3100,
    );
    const autoTimer = reduced ? setTimeout(close, 1400) : null;

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
      if (autoTimer) clearTimeout(autoTimer);
    };
  }, [visible, reduced, close]);

  // ---- custom reticle cursor (desktop only, no state churn) ----
  useEffect(() => {
    if (!visible || lite || reduced) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      const el = cursorRef.current;
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const el = cursorRef.current;
      if (el && el.dataset.on !== "1") {
        el.dataset.on = "1";
        el.style.opacity = "1";
      }
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onDown = () => cursorRef.current?.classList.add("is-down");
    const onUp = () => cursorRef.current?.classList.remove("is-down");
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [visible, lite, reduced]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (!visible) return null;

  const flat = lite || reduced;

  return (
    <div
      ref={rootRef}
      className={`intro-root${closing ? " is-closing" : ""}${lite ? " is-lite" : ""}${
        reduced ? " is-reduced" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="מסך פתיחה — Swing Terminal"
      tabIndex={-1}
    >
      <CandleField
        running={!closing}
        lite={flat}
        compact={lite}
        still={reduced}
        veilRef={veilRef}
      />
      <div ref={veilRef} className={`intro-veil${flat ? " is-flat" : ""}`} aria-hidden />
      <div className="intro-bloom" aria-hidden />
      <div className="intro-vignette" aria-hidden />
      <div className="intro-aberration" aria-hidden />
      <div className="intro-grain" aria-hidden />

      <div className="intro-content">
        <div className="intro-hud">
          <span>
            <b>SWING TERMINAL</b>
            <span className="intro-hud-more">
              &nbsp;&nbsp;/&nbsp;&nbsp;PATTERN ENGINE · {new Date().getFullYear()}
            </span>
          </span>
          <span className="intro-hud-status">
            <i />
            LIVE FEED
          </span>
        </div>

        <div className="intro-block">
          <span className="intro-eyebrow">סורק תבניות · פעיל</span>

          <h1 className="intro-head display-serif">
            <span className="intro-head-a">
              {HEAD_A.map((word, i) => (
                <span key={word} className="hw" style={{ animationDelay: `${1.42 + i * 0.13}s` }}>
                  {word}
                  {i < HEAD_A.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
            <span className="intro-head-b">
              {HEAD_B.map((word) => (
                <span key={word} className="hw" style={{ animationDelay: "1.86s" }}>
                  {word}
                </span>
              ))}
            </span>
          </h1>

          <p className="intro-sub">{SUBLINE}</p>

          <div className="intro-cta-wrap">
            <button ref={ctaRef} type="button" className="intro-cta" onClick={close}>
              <span className="intro-cta-bg" aria-hidden />
              <span className="intro-cta-text">היכנס לטרמינל</span>
              <span className="intro-cta-circle" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M13 13L5 5M5 5H12M5 5V12"
                    stroke="#0a0805"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            {!lite && (
              <span className="intro-hint">
                <kbd>ESC</kbd> לדילוג
              </span>
            )}
          </div>
        </div>

        <div className="intro-ticker" aria-hidden>
          <div className="intro-ticker-track">
            {[0, 1].map((dup) => (
              <div key={dup} style={{ display: "flex" }}>
                {TICKS.map(([sym, price, chg]) => (
                  <span key={`${dup}-${sym}`} className="intro-tick">
                    <s>{sym}</s>
                    <u>{price}</u>
                    <span className={chg >= 0 ? "up" : "down"}>
                      {chg >= 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <button ref={skipRef} type="button" className="intro-skip" onClick={close}>
        דלג
      </button>

      {!reduced && (
        <>
          <div className="intro-doors" aria-hidden>
            <div className="intro-door intro-door-a">
              <span className="intro-door-rim" />
            </div>
            <div className="intro-door intro-door-b">
              <span className="intro-door-rim" />
            </div>
          </div>
          <div className="intro-seam" aria-hidden />
          <div className="intro-flash" aria-hidden />
          <div className="intro-boot" aria-hidden>
            LOADING PATTERN ENGINE
          </div>
        </>
      )}

      {!flat && (
        <div ref={cursorRef} className="intro-cursor" aria-hidden>
          <span className="c-box" />
          <span className="c-h" />
          <span className="c-v" />
        </div>
      )}
    </div>
  );
}
