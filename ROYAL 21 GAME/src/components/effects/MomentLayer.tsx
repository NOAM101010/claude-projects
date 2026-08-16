import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { heroReveal } from '@/lib/motion';

/**
 * One shared layer for every hero moment: Blackjack, big win, level up,
 * rare item, friend joined. Short, loud, then gone (§103).
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
          <motion.div className="text-center px-6" variants={heroReveal} initial="hidden" animate="show" exit="exit">
            {moment.icon && <div className="text-[56px] leading-none mb-2">{moment.icon}</div>}
            <h1
              className="tracking-tight"
              style={{
                fontSize: 'clamp(34px, 8vw, 76px)',
                background: 'linear-gradient(180deg, #fff6dc, var(--gold) 60%, #9a781f)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 6px 30px rgba(227,178,60,.45))',
              }}
            >
              {title}
            </h1>
            {moment.subtitle && (
              <div className="mt-1 font-black" style={{ fontSize: 'clamp(16px,3vw,24px)', color: 'var(--gold-hi)' }}>
                {moment.subtitle}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
