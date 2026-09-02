import { useMemo } from 'react';
import { useSettings, resolvedQuality } from '@/stores/useSettings';

export type Flight = 'full' | 'short' | 'instant';

/**
 * "Casino City" — a night flight over a neon skyline that dives down to the
 * doors of ROYAL 21. Everything here is CSS @keyframes with
 * `animation-fill-mode: both`, so reduced motion / the in-game toggle snap
 * straight to the final frame (see the `html[data-motion='reduced']` rule and
 * the `cc--instant` short-circuit in game.css). framer's `animate` is avoided
 * on purpose — it does not run headless.
 *
 *   full     ~5.5s cinematic, first visit
 *   short    ~1s soft fade, returning players (seenIntro)
 *   instant  no motion, reduced-motion / skip
 */
export function CasinoCity({ flight, className = '' }: { flight: Flight; className?: string }) {
  const quality = useSettings((s) => resolvedQuality(s.quality));
  const lite = quality === 'low';

  const starCount = flight !== 'full' ? 24 : lite ? 30 : quality === 'medium' ? 56 : 88;
  const stars = useMemo(
    () =>
      Array.from({ length: starCount }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 60,
        size: Math.random() < 0.86 ? 1 : 2,
        delay: Math.random() * -6,
        dur: 3 + Math.random() * 5,
      })),
    [starCount],
  );

  const far = useMemo(() => makeTowers(20, 14, 20), []);
  const near = useMemo(() => makeTowers(7, 46, 32), []);

  return (
    <div className={`cc cc--${flight} ${lite ? 'cc--lite' : ''} ${className}`} aria-hidden="true">
      <div className="cc-sky" />
      <div className="cc-aurora" />
      <div className="cc-moon" />
      <div className="cc-stars">
        {stars.map((s) => (
          <span
            key={s.id}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="cc-scene">
        <div className="cc-deck">
          <div className="cc-dome" />
          <div className="cc-skyline cc-skyline--far">
            {far.map((tower, i) => (
              <span key={i} style={{ height: `${tower.h}%`, width: tower.w, ['--lit' as string]: tower.lit }} />
            ))}
          </div>
          <div className="cc-skyline cc-skyline--near">
            {near.map((tower, i) => (
              <span key={i} style={{ height: `${tower.h}%`, width: tower.w, ['--lit' as string]: tower.lit }} />
            ))}
          </div>
          <div className="cc-street" />
        </div>
      </div>

      <div className="cc-gate">
        <div className="cc-cornice" />
        <div className="cc-gate-facade" />
        <div className="cc-gate-door" />
        {!lite && flight === 'full' && (
          <>
            <span className="cc-holo h0" />
            <span className="cc-holo h1" />
            <span className="cc-holo h2" />
          </>
        )}
      </div>

      <div className="cc-flash" />
      <div className="cc-vig" />
    </div>
  );
}

function makeTowers(n: number, wBase: number, wVar: number) {
  const palette = ['#35e0c9', '#ff5fa2', '#e3b23c', '#5b8bff'];
  return Array.from({ length: n }, () => ({
    h: 28 + Math.random() * 68,
    w: wBase + Math.round(Math.random() * wVar),
    lit: palette[Math.floor(Math.random() * palette.length)],
  }));
}
