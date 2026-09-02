import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChipStack } from '@/components/game/ChipStack';
import { Modal } from '@/components/ui/Modal';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import type { BjSide, Phase } from '@/games/blackjack/types';

interface Props {
  chipSkin: string;
  selectedChip: number;
  mainBet: number;
  sideBets?: Partial<Record<BjSide, number>>;
  sideResults?: Partial<Record<BjSide, number>>;
  phase: Phase;
  /** Add the selected chip to the main wager (the HAND circle). */
  onHand: () => void;
  /** Add the selected chip to a side wager. */
  onSide: (side: BjSide, amount: number) => void;
}

const PAIRS_ROWS = [
  ['perfectPair', '25:1'], ['coloredPair', '12:1'], ['mixedPair', '6:1'],
] as const;
const TRIO_ROWS = [
  ['suitedTrips', '100:1'], ['straightFlush', '40:1'], ['trips', '30:1'],
  ['straight', '10:1'], ['flush', '5:1'],
] as const;

/**
 * The three betting circles down the middle of the solo felt — HAND (main),
 * PAIRS (Perfect Pairs) and 21+3. Pick a chip on the rail, then tap a circle to
 * drop it. Solo only; the room/duel scene never renders this.
 */
export function FeltBets({ chipSkin, selectedChip, mainBet, sideBets, sideResults, phase, onHand, onSide }: Props) {
  const { t } = useT();
  const [rules, setRules] = useState(false);
  const betting = phase === 'betting';

  const spot = (label: string, amount: number, legend: string, onTap: () => void, won: boolean) => (
    <motion.button
      type="button"
      disabled={!betting}
      onClick={() => { if (betting) { audio.play('chip'); onTap(); } }}
      className="relative flex flex-col items-center justify-between rounded-[var(--r-sm)] press"
      style={{
        width: 98, minHeight: 96, padding: '8px 6px',
        border: `2px solid ${won ? 'var(--gold-hi)' : 'var(--gold-line)'}`,
        background: amount > 0 ? 'rgba(227,178,60,.12)' : 'rgba(0,0,0,.28)',
        opacity: betting ? 1 : 0.82,
      }}
      animate={won ? { boxShadow: ['0 0 0 rgba(227,178,60,0)', '0 0 22px rgba(227,178,60,.75)', '0 0 0 rgba(227,178,60,0)'] } : {}}
      transition={won ? { duration: 1.1, repeat: 3 } : {}}
    >
      <span className="text-[10px] font-black tracking-widest" style={{ color: 'var(--gold-hi)', letterSpacing: '.12em' }}>{label}</span>
      <div className="grid place-items-center flex-1 min-h-[30px]">
        {amount > 0
          ? <ChipStack amount={amount} size={20} skin={chipSkin} max={6} />
          : <span className="rounded-full" style={{ width: 30, height: 30, border: '1px dashed var(--gold-line)' }} />}
      </div>
      {amount > 0 && <span className="num text-[10.5px]" style={{ color: 'var(--gold-hi)' }}>{fmt(amount)}</span>}
      <span className="text-[8px] mt-0.5" style={{ color: 'var(--dim)' }}>{legend}</span>
    </motion.button>
  );

  return (
    <div className="flex flex-col items-center gap-1.5 my-2">
      <div className="flex items-end gap-2">
        {spot(t('blackjack.hand'), mainBet, t('blackjack.deal'), onHand, false)}
        {spot(t('blackjack.pairs'), sideBets?.pairs ?? 0, '6·12·25', () => onSide('pairs', selectedChip), (sideResults?.pairs ?? 0) > 0)}
        {spot('21+3', sideBets?.trio ?? 0, '5·10·30·40·100', () => onSide('trio', selectedChip), (sideResults?.trio ?? 0) > 0)}
      </div>
      <button type="button" onClick={() => setRules(true)} className="text-[10px] underline underline-offset-2 press" style={{ color: 'var(--muted)' }}>
        {t('blackjack.sideBets')} · {t('games.paytable')}
      </button>
      {betting && (
        <span className="text-[9.5px]" style={{ color: 'var(--dim)' }}>{t('blackjack.sideBetHint')}</span>
      )}

      <Modal open={rules} onClose={() => setRules(false)} title={t('blackjack.sideBets')}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="eyebrow mb-1.5">{t('blackjack.pairs')} — {t('blackjack.pairsNote')}</div>
            {PAIRS_ROWS.map(([k, pay]) => (
              <div key={k} className="flex justify-between text-[13px] py-1" style={{ borderBottom: '1px solid var(--glass-line)' }}>
                <span>{t(`blackjack.${k}`)}</span><b className="num" style={{ color: 'var(--gold-hi)' }}>{pay}</b>
              </div>
            ))}
          </div>
          <div>
            <div className="eyebrow mb-1.5">21+3 — {t('blackjack.trioNote')}</div>
            {TRIO_ROWS.map(([k, pay]) => (
              <div key={k} className="flex justify-between text-[13px] py-1" style={{ borderBottom: '1px solid var(--glass-line)' }}>
                <span>{t(`blackjack.${k}`)}</span><b className="num" style={{ color: 'var(--gold-hi)' }}>{pay}</b>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
