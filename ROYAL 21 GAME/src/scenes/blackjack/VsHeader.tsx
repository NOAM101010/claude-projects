import { motion } from 'framer-motion';
import { Avatar } from '@/components/social/Avatar';
import type { BjSeat } from '@/games/blackjack/types';
import type { DuelScores } from '@/games/blackjack/duel';
import { useT } from '@/hooks/useT';

/**
 * Head-to-head framing for an exactly-2-player duel — the dedicated "boxing
 * match" treatment a table full of 3+ people doesn't get. The small DuelBoard
 * below still carries the format/round detail; this is just the marquee.
 */
export function VsHeader({ seatA, seatB, scores }: { seatA: BjSeat; seatB: BjSeat; scores: DuelScores }) {
  const { t } = useT();
  const pointsA = scores.points[seatA.userId] ?? 0;
  const pointsB = scores.points[seatB.userId] ?? 0;

  return (
    <div className="flex items-center justify-center gap-3 md:gap-6 px-2 py-2 mb-1">
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 max-w-[120px]">
        <Avatar config={seatA.avatar} size={52} level={seatA.level} id={`vs-a-${seatA.userId}`} />
        <b className="text-[12.5px] truncate max-w-full" style={{ fontFamily: 'var(--font-display)' }}>{seatA.username}</b>
      </div>

      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className="text-[10px]" style={{ color: 'var(--dim)', letterSpacing: '.3em' }}>{t('duel.vs')}</span>
        <div className="flex items-center gap-2">
          <motion.span
            key={`a-${pointsA}`}
            className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,5vw,36px)', color: 'var(--gold-hi)' }}
            initial={{ scale: 1.5, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            {pointsA}
          </motion.span>
          <span style={{ color: 'var(--dim)', fontSize: 16 }}>–</span>
          <motion.span
            key={`b-${pointsB}`}
            className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,5vw,36px)', color: 'var(--gold-hi)' }}
            initial={{ scale: 1.5, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            {pointsB}
          </motion.span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 max-w-[120px]">
        <Avatar config={seatB.avatar} size={52} level={seatB.level} id={`vs-b-${seatB.userId}`} />
        <b className="text-[12.5px] truncate max-w-full" style={{ fontFamily: 'var(--font-display)' }}>{seatB.username}</b>
      </div>
    </div>
  );
}
