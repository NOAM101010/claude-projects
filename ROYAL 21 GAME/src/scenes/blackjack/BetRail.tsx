import { motion } from 'framer-motion';
import { Chip } from '@/components/game/Chip';
import { ChipStack } from '@/components/game/ChipStack';
import { GameButton } from '@/components/ui/GameButton';
import { BLACKJACK_BETS } from '@/data/economy';
import { VIP_CHIP_EXTRA } from '@/data/vip';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';

interface Props {
  bet: number;
  chips: number;
  lastBet: number;
  ready: boolean;
  multiplayer: boolean;
  chipSkin: string;
  /** When true, the VIP high-stakes chip row is added underneath the base rail. */
  vip?: boolean;
  /** Solo: tapping a chip SELECTS it (for the felt betting circles) instead of
   *  adding straight to the main wager. */
  selectMode?: boolean;
  selectedChip?: number;
  onSelectChip?: (value: number) => void;
  onAdd: (value: number) => void;
  onClear: () => void;
  onRepeat: () => void;
  onAll: () => void;
  onReady: () => void;
}

/** Betting is done with physical chips on a rail, never with square buttons. */
export function BetRail({
  bet, chips, lastBet, ready, multiplayer, chipSkin, vip,
  selectMode, selectedChip, onSelectChip,
  onAdd, onClear, onRepeat, onAll, onReady,
}: Props) {
  const { t } = useT();
  const chipTap = (value: number) => (selectMode ? onSelectChip?.(value) : onAdd(value));
  const chipWrap = (value: number) => ({
    display: 'inline-block', borderRadius: '50%', transition: '.15s',
    boxShadow: selectMode && selectedChip === value ? '0 0 0 3px var(--gold-hi)' : undefined,
    transform: selectMode && selectedChip === value ? 'translateY(-5px)' : undefined,
  } as const);
  return (
    <motion.div
      className="glass glass-gold p-3.5"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="eyebrow">{t('blackjack.chooseBet')}</span>
        <span className="flex items-center gap-2">
          {bet > 0 && <ChipStack amount={bet} size={18} skin={chipSkin} max={6} />}
          <b className="num" style={{ color: 'var(--gold-hi)', fontFamily: 'var(--font-display)' }}>{fmt(bet)}</b>
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-2">
        {BLACKJACK_BETS.map((value) => (
          <span key={value} style={chipWrap(value)}>
            <Chip
              value={value}
              size={46}
              skin={chipSkin}
              interactive
              disabled={chips < value || ready}
              onClick={() => chipTap(value)}
            />
          </span>
        ))}
      </div>
      {vip && (
        <div className="flex flex-wrap justify-center gap-2 mb-3 pt-2"
          style={{ borderTop: '1px dashed var(--gold-line)' }}>
          <span className="w-full text-center text-[10.5px] font-black tracking-widest"
            style={{ color: 'var(--gold-hi)', letterSpacing: '0.15em' }}>
            💎 VIP HIGH STAKES
          </span>
          {VIP_CHIP_EXTRA.map((value) => (
            <span key={value} style={chipWrap(value)}>
              <Chip
                value={value}
                size={44}
                skin={chipSkin}
                interactive
                disabled={chips < value || ready}
                onClick={() => chipTap(value)}
              />
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <GameButton size="sm" tone="ghost" disabled={!bet || ready} onClick={onClear}>{t('blackjack.clear')}</GameButton>
        <GameButton size="sm" tone="ghost" disabled={!lastBet || ready} onClick={onRepeat}>{t('blackjack.lastBet')}</GameButton>
        <GameButton size="sm" tone="ghost" disabled={chips <= 0 || ready} onClick={onAll}>{t('blackjack.allIn')}</GameButton>
        <GameButton size="md" tone="gold" disabled={!bet || ready} onClick={onReady} className="min-w-[120px]">
          {ready ? `✅ ${t('blackjack.isReady')}` : multiplayer ? t('blackjack.ready') : t('blackjack.deal')}
        </GameButton>
      </div>

      {ready && multiplayer && (
        <p className="text-center mt-2.5 num font-black" style={{ color: 'var(--gold-hi)', fontFamily: 'var(--font-display)' }}>
          ⏱ {t('rooms.waitingForPlayers')}
        </p>
      )}
    </motion.div>
  );
}
