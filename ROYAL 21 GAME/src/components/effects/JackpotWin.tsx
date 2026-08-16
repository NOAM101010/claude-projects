import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmt } from '@/lib/format';
import { useT } from '@/hooks/useT';
import { audio } from '@/audio/AudioManager';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { usePlayer } from '@/stores/usePlayer';

interface Props {
  amount: number;
  onDone: () => void;
}

/**
 * Full-screen jackpot-win celebration.
 *
 * Layers, back to front:
 *   1. A gold flash that briefly washes the whole screen.
 *   2. A vignette that stays gold-tinted for the full duration.
 *   3. 80 confetti particles (gold + red + white) launched from the center
 *      with slight angular jitter and gravity so they arc.
 *   4. A radial "sunburst" of pulsing rays.
 *   5. The big amount, rising in with a spring, then a subtle float.
 *   6. A cascade of `bigWin` sounds and a chip-jingle to fill 3 seconds.
 *
 * onDone fires ~4 seconds in so callers can navigate away or unmount.
 */
export function JackpotWin({ amount, onDone }: Props) {
  const { t } = useT();
  const currencySkin = usePlayer((s) => s.profile.equipped.currencySkin);
  const [phase, setPhase] = useState<'flash' | 'party' | 'fadeout'>('flash');

  // Confetti — precomputed once so re-renders don't randomize their trajectories.
  const confetti = useMemo(
    () => Array.from({ length: 80 }, (_, i) => {
      const angle = (Math.random() - 0.5) * Math.PI + Math.PI / 2; // downward-ish
      const speed = 320 + Math.random() * 380;
      return {
        id: i,
        color: ['#e3b23c', '#fff6dc', '#a8413e', '#2e9e6b', '#4aa8c8'][i % 5],
        // start from a jitter around center
        startX: (Math.random() - 0.5) * 40,
        startY: (Math.random() - 0.5) * 40,
        // travel vector
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * -speed, // negative = up
        rotate: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 8,
        delay: Math.random() * 0.3,
      };
    }),
    [],
  );

  // Sunburst rays
  const rays = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ id: i, angle: (i * 360) / 12 })),
    [],
  );

  useEffect(() => {
    audio.duck(3800);
    audio.play('bigWin');
    const t1 = setTimeout(() => audio.play('bigWin', { gain: 0.7 }), 260);
    const t2 = setTimeout(() => audio.play('coinLand'), 420);
    const t3 = setTimeout(() => audio.play('chipStack'), 900);
    const t4 = setTimeout(() => audio.play('bigWin', { gain: 0.55 }), 1500);
    const p1 = setTimeout(() => setPhase('party'), 220);
    const p2 = setTimeout(() => setPhase('fadeout'), 3400);
    const p3 = setTimeout(onDone, 4200);
    return () => [t1, t2, t3, t4, p1, p2, p3].forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
    >
      {/* 1. Gold flash */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'flash' ? 0.85 : 0 }}
        transition={{ duration: 0.5 }}
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,240,180,.9), rgba(227,178,60,.35) 45%, transparent 75%)' }}
      />

      {/* 2. Vignette that stays through the party */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'fadeout' ? 0 : 1 }}
        transition={{ duration: phase === 'fadeout' ? 0.8 : 0.4 }}
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,.7) 100%)' }}
      />

      {/* 3. Confetti */}
      <AnimatePresence>
        {phase !== 'fadeout' && confetti.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{ opacity: 0, x: `calc(50vw + ${piece.startX}px)`, y: `calc(50vh + ${piece.startY}px)`, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: `calc(50vw + ${piece.startX + piece.dx}px)`,
              y: [`calc(50vh + ${piece.startY}px)`, `calc(50vh + ${piece.startY + piece.dy}px)`, `calc(50vh + ${piece.startY + piece.dy + 800}px)`],
              rotate: piece.rotate,
            }}
            transition={{
              duration: 2.6,
              delay: piece.delay,
              times: [0, 0.15, 0.5, 1],
              ease: 'linear',
            }}
            className="absolute"
            style={{
              width: piece.size,
              height: piece.size * 0.5,
              background: piece.color,
              borderRadius: 2,
              boxShadow: `0 0 6px ${piece.color}`,
            }}
          />
        ))}
      </AnimatePresence>

      {/* 4. Sunburst rays behind the amount */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative" style={{ width: 400, height: 400 }}>
          {rays.map((ray) => (
            <motion.div
              key={ray.id}
              className="absolute top-1/2 start-1/2"
              style={{
                width: 300,
                height: 8,
                transformOrigin: '0 50%',
                background: 'linear-gradient(90deg, rgba(255,240,180,.7), transparent)',
                transform: `translateY(-50%) rotate(${ray.angle}deg)`,
              }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{
                opacity: phase === 'party' ? [0, 0.9, 0.4, 0.9, 0.4] : 0,
                scaleX: phase === 'party' ? 1 : 0,
              }}
              transition={{
                duration: 2.4,
                delay: 0.1 + ray.id * 0.02,
                times: [0, 0.2, 0.5, 0.8, 1],
                repeat: Infinity,
              }}
            />
          ))}
        </div>
      </div>

      {/* 5. The amount */}
      <div className="absolute inset-0 grid place-items-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.4, y: 40 }}
          animate={{
            opacity: phase === 'fadeout' ? 0 : 1,
            scale: phase === 'fadeout' ? 0.9 : 1,
            y: phase === 'party' ? [0, -8, 0] : 0,
          }}
          transition={{
            opacity: { duration: phase === 'fadeout' ? 0.6 : 0.5, delay: phase === 'flash' ? 0.2 : 0 },
            scale: { type: 'spring', stiffness: 220, damping: 16, delay: 0.15 },
            y: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <div
            className="text-[68px]"
            style={{ filter: 'drop-shadow(0 6px 18px rgba(227,178,60,.7))' }}
          >
            🏆
          </div>
          <div
            className="mt-1 text-[14px] tracking-[.35em] uppercase font-bold"
            style={{ color: 'var(--gold-line)' }}
          >
            {t('jackpot.title')}
          </div>
          <div
            className="mt-2 num font-black"
            style={{
              fontSize: 'clamp(48px, 12vw, 96px)',
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(180deg, #fff6dc, #e3b23c 55%, #9a781f)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 8px 24px rgba(227,178,60,.75))',
              lineHeight: 1,
            }}
          >
            +{fmt(amount)}
          </div>
          <div className="mt-3 text-[14px]" style={{ color: 'var(--gold-hi)' }}>
            {chipGlyphOf(currencySkin)} {t('jackpot.won')}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
