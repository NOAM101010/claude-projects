import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings, resolvedQuality } from '@/stores/useSettings';

/* ============================================================================
   AppBackdrop - the ambient layer behind every route.

   Rendered once in <App/>: `fixed inset-0`, z-index -10, pointer-events:none.
   Full-bleed game scenes paint their own opaque world on top, so this only
   shows on the lighter screens (hub, lobby, inventory, settings, profile).

   Deliberately cheap. An earlier version had a rotating blurred conic + blurred
   drifting suits - `filter: blur()` on an animated element repaints the whole
   layer every frame and made the whole site janky, game scenes included.
   Everything here is static or a cheap transform/opacity tween with NO blur:
     - deep room gradient        static
     - route-aware tint          static per zone, CSS crossfades `color`
     - four faint suit glyphs    very slow drift, transform+opacity, no blur
     - one slow bokeh orb        soft radial-gradient, transform only
     - a few dust motes          transform + opacity only
     - breathing vignette        opacity only

   The suit glyphs' colour follows the same `[data-zone]` scheme as the tint
   and crossfades on navigation. Reduced motion (`html[data-motion='reduced']`
   / `prefers-reduced-motion`) freezes every moving piece; quality 'low' drops
   the bokeh + dust and freezes the glyphs (they stay visible, just still).
   ========================================================================== */

const SUITS = ['♠', '♥', '♣', '♦'];

function zoneOf(pathname: string): 'gold' | 'warm' | 'teal' | 'neutral' {
  if (/^\/(vault|vip)/.test(pathname)) return 'warm';
  if (/^\/(lobby|rooms?|friends)/.test(pathname)) return 'teal';
  if (/^\/(inventory|settings|profile)/.test(pathname)) return 'neutral';
  return 'gold';
}

export function AppBackdrop() {
  const { pathname } = useLocation();
  const quality = useSettings((s) => resolvedQuality(s.quality));
  const reduced = useSettings((s) => s.reducedMotion);
  const zone = zoneOf(pathname);

  const dustCount = reduced || quality === 'low' ? 0 : 4;
  const dust = useMemo(
    () => Array.from({ length: dustCount }, (_, i) => ({
      id: i,
      left: 12 + Math.random() * 76,
      size: 2 + Math.random() * 2,
      duration: 20 + Math.random() * 14,
      delay: Math.random() * -30,
    })),
    [dustCount],
  );

  return (
    <div className="app-backdrop" data-zone={zone} aria-hidden="true">
      <div className="app-backdrop-base" />
      <div className="app-backdrop-tint" />
      {SUITS.map((glyph, i) => (
        <span key={glyph} className={`app-backdrop-suit s${i}`}>{glyph}</span>
      ))}
      {quality !== 'low' && <span className="app-backdrop-bokeh" />}
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
          }}
        />
      ))}
      <div className="app-backdrop-vignette" />
    </div>
  );
}
