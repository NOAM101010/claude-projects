import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import type { BjSeat } from '@/games/blackjack/types';
import { useT } from '@/hooks/useT';
import { fmt, fmtSigned } from '@/lib/format';

export interface SessionLine {
  seat: BjSeat;
  net: number;
  bestStreak: number;
  points?: number;
}

/** The end-of-night card: results, plus one award nobody asked for (§157). */
export function SessionSummary({ open, lines, winnerId, pot, onAnother, onClose }: {
  open: boolean;
  lines: SessionLine[];
  winnerId?: string | null;
  pot?: number;
  onAnother: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const navigate = useNavigate();

  const ranked = [...lines].sort((a, b) => (b.points ?? b.net) - (a.points ?? a.net));
  const king = ranked[0];
  const luckiest = [...lines].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const rough = [...lines].sort((a, b) => a.net - b.net)[0];

  return (
    <Modal open={open} onClose={onClose} title={t('moments.sessionTitle')} width={480}>
      {winnerId && (
        <motion.div
          className="text-center mb-4"
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        >
          <div className="text-[44px]">👑</div>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold-hi)' }}>
            {t('duel.winner', { name: lines.find((line) => line.seat.userId === winnerId)?.seat.username ?? '' })}
          </b>
          {!!pot && <div className="text-[13px] mt-1" style={{ color: 'var(--muted)' }}>{t('duel.takesPot', { amount: fmt(pot) })}</div>}
        </motion.div>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {ranked.map((line, index) => (
          <motion.div
            key={line.seat.userId}
            className="flex items-center gap-3 p-2.5 rounded-[var(--r-sm)]"
            style={{ background: 'rgba(255,255,255,.035)' }}
            initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.07 }}
          >
            <span className="w-6 text-center text-[15px]">{['🥇', '🥈', '🥉'][index] ?? index + 1}</span>
            <Avatar config={line.seat.avatar} size={30} level={line.seat.level} id={`sum-${line.seat.userId}`} />
            <b className="flex-1 text-[13.5px]">{line.seat.username}</b>
            {line.points !== undefined && (
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{line.points} {t('duel.points')}</span>
            )}
            <b className="num" style={{ color: line.net >= 0 ? 'var(--jade-hi)' : 'var(--crimson-hi)' }}>{fmtSigned(line.net)}</b>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5 text-center">
        {[
          { icon: '👑', label: t('moments.kingOfNight'), name: king?.seat.username },
          { icon: '🍀', label: t('moments.luckiest'), name: luckiest?.seat.username },
          { icon: '💀', label: t('moments.roughNight'), name: rough?.seat.username },
        ].map((award) => (
          <div key={award.label} className="p-2.5 rounded-[var(--r-sm)]" style={{ background: 'rgba(255,255,255,.03)' }}>
            <div className="text-[22px]">{award.icon}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{award.label}</div>
            <b className="text-[12px]">{award.name ?? '—'}</b>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <GameButton tone="gold" block onClick={onAnother}>{t('blackjack.newRound')}</GameButton>
        <div className="flex gap-2">
          <GameButton tone="ghost" block onClick={() => navigate('/hub')}>{t('blackjack.changeGame')}</GameButton>
          <GameButton tone="ghost" block onClick={onClose}>{t('common.close')}</GameButton>
        </div>
      </div>
    </Modal>
  );
}
