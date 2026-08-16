import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJackpot } from '@/hooks/useJackpot';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { usePlayer } from '@/stores/usePlayer';
import type { JackpotGame } from '@/services/jackpotService';

interface Props {
  game: JackpotGame;
  /** How to win it — one short line under the amount. */
  winCondition?: string;
}

/**
 * The Jackpot banner — big, gold, always ticking upward.
 *
 * Two visual tricks make the number feel alive:
 *   1. When the pool updates, a small +delta floats up beside the total.
 *   2. The animated shimmer never stops, so the eye is drawn there even
 *      when nothing is currently changing.
 */
export function JackpotBanner({ game, winCondition }: Props) {
  const jackpot = useJackpot(game);
  const { t } = useT();
  const currencySkin = usePlayer((s) => s.profile.equipped.currencySkin);
  const [prev, setPrev] = useState<number | null>(null);
  const [showDelta, setShowDelta] = useState(0);

  useEffect(() => {
    if (!jackpot) return;
    if (prev !== null && jackpot.pool > prev) {
      const delta = jackpot.pool - prev;
      setShowDelta(delta);
      const timer = setTimeout(() => setShowDelta(0), 1400);
      // Update prev after the delta shows, so consecutive ticks stack visually
      setPrev(jackpot.pool);
      return () => clearTimeout(timer);
    }
    if (prev === null) setPrev(jackpot.pool);
    return undefined;
  }, [jackpot?.pool, prev]);

  if (!jackpot) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--r-sm)] px-4 py-3 mb-3"
      style={{
        background: 'linear-gradient(120deg, #2a1c05 0%, #4a3410 50%, #2a1c05 100%)',
        border: '1px solid var(--gold-line)',
        boxShadow: '0 8px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)',
      }}
    >
      {/* Animated shimmer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(120deg, transparent 40%, rgba(255,215,120,.15) 50%, transparent 60%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div
            className="text-[10px] tracking-[.35em] uppercase font-bold"
            style={{ color: 'var(--gold-line)' }}
          >
            🏆 {t('jackpot.title')}
          </div>
          {winCondition && (
            <div className="text-[10px] mt-0.5" style={{ color: '#c9a95e' }}>
              {winCondition}
            </div>
          )}
        </div>

        <div className="relative text-end">
          <motion.b
            key={jackpot.pool}
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="num block"
            style={{
              fontSize: 'clamp(20px, 5vw, 30px)',
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(180deg, #fff6dc, #e3b23c 55%, #9a781f)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 2px 8px rgba(227,178,60,.5))',
              lineHeight: 1,
            }}
          >
            {chipGlyphOf(currencySkin)} {fmt(jackpot.pool)}
          </motion.b>
          <AnimatePresence>
            {showDelta > 0 && (
              <motion.span
                key={`delta-${showDelta}`}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: 1, y: -22 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                className="absolute end-0 top-0 num text-[12px] font-bold"
                style={{ color: 'var(--jade-hi)' }}
              >
                +{fmt(showDelta)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
