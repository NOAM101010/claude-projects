import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings, resolvedQuality } from '@/stores/useSettings';
import { useIsCompact } from '@/hooks/useMediaQuery';

/* ============================================================================
   AppBackdrop — the game's ambient layer, behind every route.

   Rendered once in <App/>: `fixed inset-0`, z-index -10, pointer-events:none.
   Full-bleed game scenes (blackjack, poker, roulette, vault, …) paint their
   own opaque world on top, so this only shows on the lighter screens
   (hub, lobby, inventory, settings, profile, leaderboard).

   ALL motion is pure CSS `@keyframes` (see game.css) — same reasoning as
   AmbientBackground: "costs nothing beyond paint" and, more importantly, it
   doesn't depend on framer's animation lifecycle, which was silently not
   running these loops. This component only decides *what* renders:
     · how many dust motes (quality / compact / reduced)
     · which zone tint is active — via `data-zone`, CSS crossfades it

   Reduced motion: `html[data-motion='reduced']` (set by useSettings) and the
   `prefers-reduced-motion` media query both freeze every layer in game.css.
   Quality low: `html[data-quality='low']` drops the two heaviest layers.
   ========================================================================== */

const SUITS = [
  { s: '♠', cls: 'is-spade' },
  { s: '♥', cls: 'is-heart' },
  { s: '♣', cls: 'is-club' },
  { s: '♦', cls: 'is-diamond' },
];

function zoneOf(pathname: string): 'gold' | 'warm' | 'teal' | 'neutral' {
  if (/^\/(vault|vip)/.test(pathname)) return 'warm';                        // the treasure rooms
  if (/^\/(lobby|rooms?|night|friends)/.test(pathname)) return 'teal';       // social spaces
  if (/^\/(inventory|settings|profile)/.test(pathname)) return 'neutral';    // utility screens
  return 'gold';                                                            // the hub / everywhere else
}

export function AppBackdrop() {
  const { pathname } = useLocation();
  const quality = useSettings((s) => resolvedQuality(s.quality));
  const reduced = useSettings((s) => s.reducedMotion);
  const compact = useIsCompact();
  const zone = zoneOf(pathname);

  const dustCount = reduced
    ? 0
    : compact
      ? 8
      : quality === 'low' ? 6 : quality === 'medium' ? 12 : 20;

  const dust = useMemo(
    () => Array.from({ length: dustCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 3.5,
      duration: 13 + Math.random() * 15,
      delay: Math.random() * -28,
      drift: `${Math.round((Math.random() - 0.5) * 60)}px`,
    })),
    [dustCount],
  );

  return (
    <div className="app-backdrop" data-zone={zone} aria-hidden="true">
      <div className="app-backdrop-base" />
      <div className="app-backdrop-tint" />
      <div className="app-backdrop-conic" />
      <div className="app-backdrop-sweep" />

      {SUITS.map((suit) => (
        <span key={suit.s} className={`app-backdrop-suit ${suit.cls}`}>{suit.s}</span>
      ))}

      <span className="app-backdrop-bokeh is-gold" />
      <span className="app-backdrop-bokeh is-teal" />

      {dust.map((d) => (
        <span
          key={d.id}
          className="app-backdrop-dust"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
            ['--drift' as string]: d.drift,
          }}
        />
      ))}

      <div className="app-backdrop-vignette" />
    </div>
  );
}
