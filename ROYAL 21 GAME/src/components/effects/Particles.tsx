import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSettings, resolvedQuality } from '@/stores/useSettings';

/** Foreground dust. Count drops with the quality tier; zero on reduced motion. */
export function Particles({ count = 18, color = 'rgba(227,178,60,.5)' }: { count?: number; color?: string }) {
  const quality = useSettings((s) => resolvedQuality(s.quality));
  const reduced = useSettings((s) => s.reducedMotion);
  const total = reduced ? 0 : quality === 'low' ? Math.round(count * 0.3) : quality === 'medium' ? Math.round(count * 0.6) : count;

  const dots = useMemo(
    () => Array.from({ length: total }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      duration: 12 + Math.random() * 16,
      delay: Math.random() * -20,
    })),
    [total],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {dots.map((dot) => (
        <motion.span
          key={dot.id}
          className="absolute rounded-full"
          style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: dot.size, height: dot.size, background: color }}
          animate={{ y: [0, -34, 0], x: [0, 12, 0], opacity: [0, 0.8, 0] }}
          transition={{ duration: dot.duration, delay: dot.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
