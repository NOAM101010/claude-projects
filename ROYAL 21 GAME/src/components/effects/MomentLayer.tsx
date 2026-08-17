import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';

/** Confetti particles for the loudest moments — bigWin / blackjack. Each
 *  particle is a tiny rotating rectangle scattered across the screen and
 *  drifted down with a slight sway. Colours come from the app palette so
 *  it never feels like a cheap generic party burst. */
const CONFETTI_COLORS = ['#e3b23c', '#fff6dc', '#a8413e', '#4a86d6', '#5aa563', '#a878f0'];

function Confetti() {
  // Pre-compute positions/timings so a re-render doesn't wiggle them.
  const bits = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({
      i,
      x: (i * 37) % 100,
      startY: -10 - (i % 5) * 8,
      hue: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      duration: 1.6 + (i % 6) * 0.15,
      delay: (i % 8) * 0.03,
      rot: (i % 2 ? 1 : -1) * (360 + i * 20),
      width: 6 + (i % 3) * 2,
      height: 10 + (i % 4) * 2,
    })),
    [],
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bits.map((b) => (
        <motion.span
          key={b.i}
          style={{
            position: 'absolute',
            left: `${b.x}%`, top: `${b.startY}%`,
            width: b.width, height: b.height,
            background: b.hue,
            borderRadius: 2,
            boxShadow: '0 1px 2px rgba(0,0,0,.4)',
          }}
          initial={{ y: 0, x: 0, opacity: 0, rotate: 0 }}
          animate={{ y: '110vh', x: [(b.i % 2 ? -1 : 1) * 20, 0, (b.i % 2 ? 1 : -1) * 30], opacity: [0, 1, 1, 0], rotate: b.rot }}
          transition={{ duration: b.duration, delay: b.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/** Big golden coins raining alongside the confetti. Just 14 of them, staggered. */
function CoinRain() {
  const coins = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      i, x: 4 + i * 6.8, delay: 0.05 * i, duration: 1.7 + (i % 3) * 0.2,
    })),
    [],
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {coins.map((c) => (
        <motion.span
          key={c.i}
          className="absolute text-[24px]"
          style={{ left: `${c.x}%`, top: -30 }}
          initial={{ y: -30, opacity: 0, rotate: 0 }}
          animate={{ y: '95vh', opacity: [0, 1, 1, 0], rotate: 720 }}
          transition={{ duration: c.duration, delay: c.delay, ease: 'easeIn' }}
        >
          🪙
        </motion.span>
      ))}
    </div>
  );
}

/**
 * One shared layer for every hero moment: Blackjack, big win, level up,
 * rare item, friend joined. Short, loud, then gone (§103).
 *
 * bigWin / blackjack get the confetti + coin-rain treatment. The others
 * keep the calmer light pulse.
 */
export function MomentLayer() {
  const moment = useUI((s) => s.moment);
  const clear = useUI((s) => s.clearMoment);
  const { t } = useT();

  useEffect(() => {
    if (!moment) return;
    const timer = setTimeout(clear, moment.duration ?? 2200);
    return () => clearTimeout(timer);
  }, [moment, clear]);

  const title = moment ? (moment.title.includes('.') ? t(moment.title) : moment.title) : '';
  const loud = moment?.kind === 'bigWin' || moment?.kind === 'blackjack';

  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          className="fixed inset-0 z-[600] grid place-items-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* a pulse of light rather than a dark overlay */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(227,178,60,.22), transparent 62%)' }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 1, 0.4], scale: [0.7, 1.1, 1] }}
            transition={{ duration: 1.1 }}
          />
          {loud && <Confetti />}
          {loud && <CoinRain />}
          <motion.div
            className="text-center px-6"
            initial={{ scale: 0.4, opacity: 0, y: 40 }}
            animate={{ scale: loud ? [0.4, 1.25, 1] : [0.6, 1.1, 1], opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -20 }}
            transition={{ duration: loud ? 0.9 : 0.6, times: loud ? [0, 0.55, 1] : undefined, type: loud ? 'tween' : 'spring' }}
          >
            {moment.icon && <div className="text-[64px] leading-none mb-2">{moment.icon}</div>}
            <h1
              className="tracking-tight"
              style={{
                fontSize: loud ? 'clamp(44px, 11vw, 100px)' : 'clamp(34px, 8vw, 76px)',
                background: 'linear-gradient(180deg, #fff6dc, var(--gold) 60%, #9a781f)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 6px 30px rgba(227,178,60,.55))',
              }}
            >
              {title}
            </h1>
            {moment.subtitle && (
              <div className="mt-1 font-black" style={{ fontSize: loud ? 'clamp(20px,4vw,32px)' : 'clamp(16px,3vw,24px)', color: 'var(--gold-hi)' }}>
                {moment.subtitle}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
