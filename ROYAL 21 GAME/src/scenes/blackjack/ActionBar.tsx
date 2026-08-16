import { motion } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { useT } from '@/hooks/useT';

interface Props {
  yourTurn: boolean;
  turnName?: string;
  canDouble: boolean;
  canSplit: boolean;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
}

/** Table controls: brushed metal set into the rail, lit only on your turn. */
export function ActionBar({ yourTurn, turnName, canDouble, canSplit, onHit, onStand, onDouble, onSplit }: Props) {
  const { t } = useT();
  return (
    <motion.div
      className="glass p-3"
      style={{ borderColor: yourTurn ? 'var(--gold-line)' : 'var(--glass-line)' }}
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1, boxShadow: yourTurn ? '0 0 34px rgba(227,178,60,.22)' : 'var(--shadow-deep)' }}
      exit={{ y: 30, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <p className="text-center mb-2.5 text-[12.5px] font-bold" style={{ color: yourTurn ? 'var(--gold-hi)' : 'var(--muted)' }}>
        {yourTurn ? t('blackjack.yourTurn') : t('blackjack.turnOf', { name: turnName ?? '…' })}
      </p>
      <div className="grid grid-cols-4 gap-2">
        <GameButton tone="gold" size="lg" disabled={!yourTurn} onClick={onHit}>{t('blackjack.hit')}</GameButton>
        <GameButton tone="metal" size="lg" disabled={!yourTurn} onClick={onStand}>{t('blackjack.stand')}</GameButton>
        <GameButton tone="metal" size="lg" disabled={!yourTurn || !canDouble} onClick={onDouble}>{t('blackjack.double')}</GameButton>
        <GameButton tone="metal" size="lg" disabled={!yourTurn || !canSplit} onClick={onSplit}>{t('blackjack.split')}</GameButton>
      </div>
    </motion.div>
  );
}
