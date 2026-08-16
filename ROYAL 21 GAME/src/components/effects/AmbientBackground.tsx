import { useEffect, useMemo, useRef } from 'react';
import { useSettings, resolvedQuality } from '@/stores/useSettings';

const GLYPHS = ['♠', '♥', '♦', '♣', '🂡', '🪙'] as const;

/**
 * Site-wide ambient layer: drifting cards/chips + a soft glow that trails the
 * cursor. Pure CSS animation (not framer) so it costs nothing beyond paint,
 * and a raf-throttled ref write for the cursor glow so mouse movement never
 * triggers a React re-render.
 */
export function AmbientBackground() {
  const quality = useSettings((s) => resolvedQuality(s.quality));
  const reduced = useSettings((s) => s.reducedMotion);
  const glowRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const count = reduced ? 0 : quality === 'low' ? 5 : quality === 'medium' ? 9 : 14;
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      id: i,
      glyph: GLYPHS[i % GLYPHS.length],
      x: Math.random() * 100,
      size: 14 + Math.random() * 20,
      duration: 22 + Math.random() * 26,
      delay: Math.random() * -40,
      drift: (Math.random() - 0.5) * 60,
      spin: Math.random() > 0.5,
    })),
    [count],
  );

  useEffect(() => {
    if (reduced) return;
    const move = (e: PointerEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        glowRef.current?.style.setProperty('--gx', `${e.clientX}px`);
        glowRef.current?.style.setProperty('--gy', `${e.clientY}px`);
      });
    };
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointermove', move);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reduced]);

  return (
    <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none" aria-hidden="true">
      {!reduced && (
        <div
          ref={glowRef}
          className="ambient-cursor-glow"
          style={{ '--gx': '50vw', '--gy': '40vh' } as React.CSSProperties}
        />
      )}
      {items.map((it) => (
        <span
          key={it.id}
          className={`ambient-drift ${it.spin ? 'ambient-drift-spin' : ''}`}
          style={{
            left: `${it.x}%`,
            fontSize: it.size,
            animationDuration: `${it.duration}s`,
            animationDelay: `${it.delay}s`,
            ['--drift-x' as string]: `${it.drift}px`,
          }}
        >
          {it.glyph}
        </span>
      ))}
    </div>
  );
}
