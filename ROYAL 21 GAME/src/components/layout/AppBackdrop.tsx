import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings, resolvedQuality } from '@/stores/useSettings';

/* ============================================================================
   AppBackdrop — the ambient layer behind every route.

   Rendered once in <App/>: `fixed inset-0`, z-index -10, pointer-events:none.
   Full-bleed game scenes paint their own opaque world on top, so this only
   shows on the lighter screens (hub, lobby, inventory, settings, profile).

   Deliberately almost entirely STATIC. An earlier version had a rotating
   blurred conic + blurred drifting suits — `filter: blur()` on an animated
   element repaints the whole layer every frame and made the whole site janky,
   game scenes included. Everything here now is either static or a cheap
   `transform` / `opacity` tween with NO blur:
     · deep room gradient        — static
     · route-aware tint          — static per zone, CSS crossfades `color`
     · one slow bokeh orb        — soft radial-gradient, `transform` only
     · a few dust motes          — `transform` + `opacity` only
     · breathing vignette        — `opacity` only

   Reduced motion (`html[data-motion='reduced']` / `prefers-reduced-motion`)
   freezes the three moving pieces; quality 'low' drops the bokeh + dust.
   ========================================================================== */

function zoneOf(pathname: string): 'gold' | 'warm' | 'teal' | 'neutral' {
  if (/^\/(vault|vip)/.test(pathname)) return 'warm';
  if (/^\/(lobby|rooms?|night|friends)/.test(pathname)) return 'teal';
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
