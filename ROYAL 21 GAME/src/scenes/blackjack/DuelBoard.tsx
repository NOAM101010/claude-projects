import { motion } from 'framer-motion';
import { Avatar } from '@/components/social/Avatar';
import type { BjSeat } from '@/games/blackjack/types';
import type { DuelConfig, DuelScores } from '@/games/blackjack/duel';
import { roundTargetOf, totalRoundsOf } from '@/games/blackjack/duel';
import { useT } from '@/hooks/useT';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { usePlayer } from '@/stores/usePlayer';
import { fmt } from '@/lib/format';

/** The scoreboard is the game in duel mode, so it stays on screen. */
export function DuelBoard({ seats, config, scores, potPlayers }: {
  seats: BjSeat[]; config: DuelConfig; scores: DuelScores; potPlayers: number;
}) {
  const { t } = useT();
  const currencySkin = usePlayer((s) => s.profile.equipped.currencySkin);
  const target = roundTargetOf(config);
  const ranked = [...seats].sort((a, b) => (scores.points[b.userId] ?? 0) - (scores.points[a.userId] ?? 0));

  return (
    <div className="glass glass-gold p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow">{t('duel.scoreboard')}</span>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
          {config.format === 'race'
            ? t('duel.race', { n: config.target })
            : t('duel.round', { n: scores.round, total: totalRoundsOf(config) })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {ranked.map((seat) => {
          const points = scores.points[seat.userId] ?? 0;
          const rounds = scores.rounds[seat.userId] ?? 0;
          return (
            <div key={seat.userId} className="flex items-center gap-2.5">
              <Avatar config={seat.avatar} size={26} level={seat.level} id={`duel-${seat.userId}`} />
              <span className="text-[12.5px] font-bold flex-1 truncate">{seat.username}</span>
              {config.format === 'bestOf' && (
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {'●'.repeat(rounds)}{'○'.repeat(Math.max(0, Math.ceil(config.target / 2) - rounds))}
                </span>
              )}
              <div className="relative rounded-full overflow-hidden" style={{ width: 88, height: 7, background: 'rgba(255,255,255,.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg,var(--gold-deep),var(--gold-hi))' }}
                  animate={{ width: `${Math.min(100, (points / target) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 26 }}
                />
              </div>
              <b className="num w-8 text-end" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-hi)' }}>{points}</b>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] text-center" style={{ color: 'var(--dim)' }}>
        {chipGlyphOf(currencySkin)} {t('games.pot')} {fmt(config.buyIn * potPlayers)}
      </p>
    </div>
  );
}
