import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSettings, resolvedQuality } from '@/stores/useSettings';
import { useIsCompact } from '@/hooks/useMediaQuery';

/* ============================================================================
   HUB backdrop — a luxe casino floor at night.

   Layers, back to front:
     · deep room gradient           (static)
     · slow-turning "house lighting" conic glow
     · four huge, very blurred suit marks bobbing in place
     · two drifting bokeh orbs (gold + teal)
     · a little gold dust rising
     · vignette + floor bloom        (static)

   Everything is fixed / behind content / pointer-events:none. Only transform
   and opacity animate. Honours the `reducedMotion` setting (and, through it,
   `prefers-reduced-motion` — see useSettings) by freezing every layer.
   ========================================================================== */

const SUITS = [
  { s: '♠', x: 13, y: 24, size: 300, dur: 46 },
  { s: '♥', x: 84, y: 66, size: 260, dur: 54 },
  { s: '♣', x: 68, y: 14, size: 210, dur: 60 },
  { s: '♦', x: 28, y: 82, size: 240, dur: 50 },
];

export function HubBackdrop() {
  const reduced = useSettings((s) => s.reducedMotion);
  const quality = useSettings((s) => resolvedQuality(s.quality));
  const compact = useIsCompact();

  const dustCount = reduced
    ? 0
    : compact
      ? 6
      : quality === 'low' ? 4 : quality === 'medium' ? 9 : 15;

  const dust = useMemo(
    () => Array.from({ length: dustCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 1.5 + Math.random() * 3,
      duration: 18 + Math.random() * 20,
      delay: Math.random() * -34,
      drift: (Math.random() - 0.5) * 46,
    })),
    [dustCount],
  );

  return (
    <div className="hub-backdrop" aria-hidden="true">
      <div className="hub-backdrop-base" />

      <motion.div
        className="hub-backdrop-conic"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 130, repeat: Infinity, ease: 'linear' }}
      />

      {SUITS.map((suit) => (
        <motion.span
          key={suit.s}
          className="hub-backdrop-suit"
          style={{ left: `${suit.x}%`, top: `${suit.y}%`, fontSize: suit.size }}
          animate={reduced ? undefined : { y: [0, -26, 0], opacity: [0.05, 0.09, 0.05] }}
          transition={{ duration: suit.dur, repeat: Infinity, ease: 'easeInOut' }}
        >
          {suit.s}
        </motion.span>
      ))}

      <motion.span
        className="hub-backdrop-bokeh"
        style={{
          left: '18%', top: '28%', width: 440, height: 440,
          background: 'radial-gradient(circle, rgba(227,178,60,.16), transparent 70%)',
        }}
        animate={reduced ? undefined : { x: [0, 42, 0], y: [0, -30, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="hub-backdrop-bokeh"
        style={{
          left: '82%', top: '64%', width: 380, height: 380,
          background: 'radial-gradient(circle, rgba(74,168,200,.12), transparent 70%)',
        }}
        animate={reduced ? undefined : { x: [0, -34, 0], y: [0, 28, 0], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 44, repeat: Infinity, ease: 'easeInOut' }}
      />

      {dust.map((d) => (
        <motion.span
          key={d.id}
          className="hub-backdrop-dust"
          style={{ left: `${d.x}%`, width: d.size, height: d.size }}
          initial={{ y: '112vh', opacity: 0 }}
          animate={{ y: '-12vh', x: d.drift, opacity: [0, 0.7, 0.7, 0] }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      <div className="hub-backdrop-vignette" />
    </div>
  );
}
