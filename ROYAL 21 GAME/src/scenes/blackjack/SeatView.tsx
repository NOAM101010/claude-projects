import { motion } from 'framer-motion';
import { PlayingCard } from '@/components/game/PlayingCard';
import { ChipStack } from '@/components/game/ChipStack';
import { Avatar } from '@/components/social/Avatar';
import { FloatingEmote } from '@/components/social/FloatingEmote';
import { handValue, isBlackjack } from '@/games/blackjack/engine';
import type { BjSeat } from '@/games/blackjack/types';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';

interface Props {
  seat: BjSeat;
  hero?: boolean;
  active?: boolean;
  activeHand?: number;
  cardFace: string;
  cardBack: string;
  chipSkin: string;
  points?: number;
  emote?: { emote?: string; message?: string };
}

const outcomeTone: Record<string, string> = {
  win: 'var(--jade-hi)', blackjack: 'var(--gold-hi)', push: 'var(--muted)',
  lose: 'var(--crimson-hi)', bust: 'var(--crimson-hi)',
};

export function SeatView({ seat, hero, active, activeHand = 0, cardFace, cardBack, chipSkin, points, emote }: Props) {
  const { t } = useT();
  const size = hero ? 'md' : 'sm';

  return (
    <motion.div
      className="relative flex flex-col items-center gap-1.5 px-2 py-2 rounded-[var(--r-md)]"
      animate={{
        borderColor: active ? 'var(--gold)' : 'transparent',
        backgroundColor: active ? 'rgba(227,178,60,.07)' : 'transparent',
        boxShadow: active ? '0 0 30px rgba(227,178,60,.2)' : 'none',
        opacity: seat.spectator ? 0.55 : 1,
      }}
      style={{ borderWidth: 1, borderStyle: 'solid', minWidth: hero ? 190 : 116 }}
    >
      <FloatingEmote emote={emote?.emote} message={emote?.message} />

      <div className="flex items-center gap-2">
        <Avatar config={seat.avatar} size={hero ? 46 : 34} level={seat.level} id={`seat-${seat.userId}`} />
        <div className="text-start">
          <b className="block text-[12.5px]" style={{ fontFamily: 'var(--font-display)' }}>
            {seat.username}{hero ? ` · ${t('common.you')}` : ''}
          </b>
          <span className="text-[10.5px] num" style={{ color: 'var(--muted)' }}>
            {t('common.level')} {seat.level}
            {points !== undefined && ` · ${points} ${t('duel.points')}`}
          </span>
        </div>
      </div>

      {seat.spectator && (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
          style={{ background: 'rgba(123,91,214,.16)', border: '1px solid rgba(123,91,214,.5)', color: '#c3aeff' }}>
          👁 {t('blackjack.spectating')}
        </span>
      )}

      {seat.hands.length > 0 ? (
        <div className="flex gap-2.5 flex-wrap justify-center">
          {seat.hands.map((hand, index) => {
            const total = handValue(hand.cards).total;
            const bj = isBlackjack(hand);
            const dim = seat.hands.length > 1 && !(active && index === activeHand) && !hand.done;
            return (
              <div key={index} className="text-center" style={{ opacity: dim ? 0.6 : 1 }}>
                <div className="flex justify-center" style={{ marginInlineStart: 18 }}>
                  {hand.cards.map((card, cardIndex) => (
                    <div key={cardIndex} style={{ marginInlineStart: -18 }}>
                      <PlayingCard card={card} size={size} index={cardIndex} face={cardFace} back={cardBack} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span
                    className="inline-grid place-items-center num font-black rounded-full px-2.5"
                    style={{
                      minWidth: 38, height: 24, fontFamily: 'var(--font-display)',
                      background: bj ? 'var(--brushed-gold)' : 'rgba(0,0,0,.55)',
                      color: bj ? '#1a1206' : total > 21 ? 'var(--crimson-hi)' : 'var(--gold-hi)',
                      border: '1px solid var(--gold-line)',
                    }}
                  >
                    {bj ? 'BJ' : total}
                  </span>
                  {hand.bet > 0 && (
                    <span className="text-[11px] font-bold num" style={{ color: 'var(--gold)' }}>{fmt(hand.bet)}</span>
                  )}
                  {hand.outcome && (
                    <span className="text-[11px] font-bold" style={{ color: outcomeTone[hand.outcome] }}>
                      {t(`blackjack.${hand.outcome === 'bust' ? 'bust' : hand.outcome === 'blackjack' ? 'blackjack' : hand.outcome}`)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : seat.bet > 0 ? (
        <div className="flex flex-col items-center">
          <ChipStack amount={seat.bet} size={22} skin={chipSkin} max={8} />
          <span className="text-[11px] font-bold num mt-1" style={{ color: 'var(--gold)' }}>{fmt(seat.bet)}</span>
          <span className="text-[10.5px]" style={{ color: seat.ready ? 'var(--jade-hi)' : 'var(--dim)' }}>
            {seat.ready ? `✅ ${t('blackjack.isReady')}` : t('blackjack.waiting')}
          </span>
        </div>
      ) : (
        <span className="text-[10.5px]" style={{ color: 'var(--dim)' }}>{t('blackjack.waiting')}</span>
      )}
    </motion.div>
  );
}
