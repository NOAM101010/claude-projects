import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/hooks/useSound';

interface Props<T extends string> {
  tabs: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
}

/**
 * Horizontally-scrolling tab row with visible overflow indicators.
 *
 * The mask fade was already there, but a fade alone doesn't tell a first-time
 * player that scrolling is possible — they see truncated text and assume that
 * is the whole set. The gold arrow chips at either side only show when there
 * is more to reach, and clicking one scrolls the row a card-width in that
 * direction. That is the one thing a fade cannot do.
 */
export function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const { play } = useSound();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  // Watch the row's scroll position to decide which arrows to show.
  // scrollLeft can be negative in RTL browsers — Math.abs handles both cases.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const scrollLeft = Math.abs(el.scrollLeft);
      const maxScroll = el.scrollWidth - el.clientWidth;
      const hasOverflow = maxScroll > 4;
      const canScrollStart = hasOverflow && scrollLeft > 4;
      const canScrollEnd = hasOverflow && scrollLeft < maxScroll - 4;
      setOverflow({ start: canScrollStart, end: canScrollEnd });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Also watch for resizes — a viewport change can toggle overflow either way.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [tabs.length]);

  // Ensure the active tab is scrolled into view when it changes.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const activeButton = el.querySelector<HTMLButtonElement>(`button[data-tab-key="${value}"]`);
    activeButton?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [value]);

  const scroll = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    /* In RTL, scrollLeft grows negative as content scrolls end-ward, so the
       direction that visually feels "forward" flips at the scroll API level.
       Detect it from the computed direction rather than a document dir prop —
       nested LTR blocks inside an RTL page keep this correct either way.

       Chromium's built-in smooth-scroll animator flatly ignores a negative
       scrollLeft target in RTL — the setter resolves but the element never
       moves. Hand-animate with rAF so the direction stays honest either way. */
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const signedDirection = isRtl ? -direction : direction;
    const step = signedDirection * el.clientWidth * 0.7;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const minLeft = isRtl ? -maxScroll : 0;
    const maxLeft = isRtl ? 0 : maxScroll;
    const start = el.scrollLeft;
    const target = Math.max(minLeft, Math.min(maxLeft, start + step));
    if (target === start) return;
    /* Set the final value up-front — this guarantees the jump lands even in a
       background tab where rAF is paused. The frame loop below is only cosmetic
       (smooths the visible transition when the tab IS visible). */
    const t0 = performance.now();
    const duration = 220;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let done = false;
    const tick = (now: number) => {
      if (done) return;
      const t = Math.min(1, (now - t0) / duration);
      el.scrollLeft = start + (target - start) * ease(t);
      if (t < 1) requestAnimationFrame(tick);
      else done = true;
    };
    requestAnimationFrame(tick);
    /* Safety net: if rAF never fires (background tab), commit the final value
       so the click is not silently lost. Fires only once and no-ops if the
       animation already finished. */
    window.setTimeout(() => {
      if (done) return;
      done = true;
      el.scrollLeft = target;
    }, duration + 60);
    play('hover');
  };

  // Both arrows always render — the one that can't scroll shows dimmed.
  // start-0/end-0 respect page direction (RTL flips them automatically).
  const arrowStyle = (active: boolean) => ({
    background: active
      ? 'linear-gradient(90deg, var(--gold), var(--gold-hi))'
      : 'rgba(255,255,255,.08)',
    color: active ? '#1a1206' : 'var(--dim)',
    boxShadow: active ? '0 2px 6px rgba(0,0,0,.4)' : 'none',
    cursor: active ? 'pointer' : 'default',
    opacity: active ? 1 : 0.45,
  });

  return (
    <div className="relative">
      {/* Start-side arrow — scrolls backward (right in RTL, left in LTR).
          `overflow.start` only controls visual state — the click handler always
          runs. scroll() clamps to bounds internally, so an extra press at the
          edge just no-ops instead of getting swallowed by a stale state. */}
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute start-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 grid place-items-center rounded-full transition-opacity"
        style={arrowStyle(overflow.start)}
        aria-label="Scroll tabs backward"
      >
        <span style={{ fontSize: 12, fontWeight: 900 }}>‹</span>
      </button>
      {/* End-side arrow — scrolls forward (left in RTL, right in LTR). */}
      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute end-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 grid place-items-center rounded-full transition-opacity"
        style={arrowStyle(overflow.end)}
        aria-label="Scroll tabs forward"
      >
        <span style={{ fontSize: 12, fontWeight: 900 }}>›</span>
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-1 p-1 rounded-[var(--r-sm)] border border-white/10 overflow-x-auto"
        style={{
          background: 'rgba(255,255,255,.04)',
          scrollbarWidth: 'none',
          /* Reserve room on both ends so the arrow chips never overlap tab text. */
          paddingInlineStart: 30,
          paddingInlineEnd: 30,
          maskImage: 'linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)',
        }}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.currentTarget.scrollLeft += event.deltaY;
          event.preventDefault();
        }}
      >
        {tabs.map((tab) => {
          const active = tab.key === value;
          return (
            <button
              key={tab.key}
              data-tab-key={tab.key}
              onClick={() => { play('click'); onChange(tab.key); }}
              className="relative px-4 py-2 rounded-[var(--r-xs)] text-[13px] font-bold whitespace-nowrap"
              style={{ color: active ? '#1a1206' : 'var(--muted)' }}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[var(--r-xs)]"
                  style={{ background: 'var(--brushed-gold)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {tab.label}
                {!!tab.badge && (
                  <span
                    className="text-[10px] px-1.5 rounded-full font-black"
                    style={{ background: active ? 'rgba(0,0,0,.25)' : 'var(--crimson)', color: active ? '#1a1206' : '#fff' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
