import { ChipStack } from '@/components/game/ChipStack';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import type { BjSide, Phase } from '@/games/blackjack/types';

interface Props {
  chipSkin: string;
  /** Amount of the last chip tapped on the rail — placed on a panel tap. */
  lastChip: number;
  sideBets?: Partial<Record<BjSide, number>>;
  sideResults?: Partial<Record<BjSide, number>>;
  phase: Phase;
  compact: boolean;
  onSide: (side: BjSide, amount: number) => void;
}

const ROWS: Record<BjSide, readonly (readonly [string, string])[]> = {
  pairs: [['perfectPair', '25:1'], ['coloredPair', '12:1'], ['mixedPair', '6:1']],
  trio: [['suitedTrips', '100:1'], ['straightFlush', '40:1'], ['trips', '30:1'], ['straight', '10:1'], ['flush', '5:1']],
};

/**
 * Solo side-bet panels pinned to the left and right of the felt — each carries a
 * readable paytable for its wager and the chips staked on it. Tap a chip on the
 * rail, then tap a panel to drop it. Never rendered in a room or duel.
 */
export function FeltBets({ chipSkin, lastChip, sideBets, sideResults, phase, compact, onSide }: Props) {
  const { t } = useT();
  const betting = phase === 'betting';

  const panel = (side: BjSide, label: string) => {
    const amount = sideBets?.[side] ?? 0;
    const result = sideResults?.[side] ?? 0;
    const won = result > 0 && !betting;
    return (
      <button
        type="button"
        disabled={!betting}
        onClick={() => { if (betting) { audio.play('chip'); haptic('chip'); onSide(side, lastChip || 100); } }}
        className={`flex flex-col gap-0.5 rounded-[var(--r-sm)] press text-start ${won ? 'sb-won' : ''}`}
        style={{
          width: compact ? 104 : 134,
          padding: compact ? '7px 8px' : '9px 11px',
          border: `2px solid ${won ? 'var(--gold-hi)' : 'var(--gold-line)'}`,
          background: amount > 0 ? 'rgba(227,178,60,.14)' : 'rgba(6,10,9,.74)',
          backdropFilter: 'blur(3px)',
          opacity: betting ? 1 : 0.9,
        }}
      >
        <span className="font-black tracking-widest" style={{ fontSize: 9.5, color: 'var(--gold-hi)', letterSpacing: '.12em' }}>
          {label}
        </span>
        {ROWS[side].map(([k, pay]) => (
          <div key={k} className="flex items-center justify-between gap-1" style={{ fontSize: compact ? 8.5 : 9.5 }}>
            <span className="truncate" style={{ color: 'var(--muted)' }}>{t(`blackjack.${k}`)}</span>
            <b className="num" style={{ color: 'var(--gold-hi)' }}>{pay}</b>
          </div>
        ))}
        <div className="mt-1 pt-1 flex items-center gap-1.5" style={{ borderTop: '1px solid var(--gold-line)' }}>
          {amount > 0 ? (
            <>
              <ChipStack amount={amount} size={15} skin={chipSkin} max={5} />
              <span className="num" style={{ fontSize: 10.5, color: 'var(--gold-hi)' }}>
                {won ? `+${fmt(amount + result)}` : `${t('blackjack.youBet')} ${fmt(amount)}`}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 9, color: 'var(--dim)' }}>{t('blackjack.sideBetHint')}</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="absolute z-10" style={{ insetInlineStart: compact ? 2 : 10, top: '50%', transform: 'translateY(-50%)' }}>
        {panel('pairs', t('blackjack.pairs'))}
      </div>
      <div className="absolute z-10" style={{ insetInlineEnd: compact ? 2 : 10, top: '50%', transform: 'translateY(-50%)' }}>
        {panel('trio', '21+3')}
      </div>
    </>
  );
}
