import { ChipStack } from '@/components/game/ChipStack';
import { useT } from '@/hooks/useT';
import { fmt } from '@/lib/format';
import { audio } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';
import type { BaccaratSide } from './types';

/** Grouped like a real Baccarat layout, each wager carrying its own paytable
 *  row (payouts from PAYTABLE in engine.ts). */
const GROUPS: { title: string; sides: { side: BaccaratSide; pay: string }[] }[] = [
  {
    title: 'baccarat.pairsGroup',
    sides: [
      { side: 'playerPair', pay: '11 : 1' },
      { side: 'bankerPair', pay: '11 : 1' },
      { side: 'perfectPair', pay: '25 : 1' },
    ],
  },
  {
    title: 'baccarat.countGroup',
    sides: [
      { side: 'big', pay: '0.54 : 1' },
      { side: 'small', pay: '1.5 : 1' },
    ],
  },
];

interface Props {
  sideBets: Partial<Record<BaccaratSide, number>>;
  sideResults?: Partial<Record<BaccaratSide, number>>;
  betting: boolean;
  settled: boolean;
  chipSkin: string;
  onSide: (side: BaccaratSide) => void;
}

/**
 * Baccarat side bets, built on the Blackjack `FeltBets` pattern: a readable
 * paytable per wager, the chips you staked shown right on it, and a gold pulse
 * (`.sb-won`, a plain CSS animation) on the ones that hit — so it's never a
 * guess whether you won. Used in solo and in a room.
 */
export function BaccaratSideBets({ sideBets, sideResults, betting, settled, chipSkin, onSide }: Props) {
  const { t } = useT();
  return (
    <div className="w-full grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(158px,1fr))' }}>
      {GROUPS.map((group) => (
        <div
          key={group.title}
          className="rounded-[var(--r-sm)] p-2.5"
          style={{ background: 'rgba(6,10,9,.5)', border: '1px solid var(--gold-line)' }}
        >
          <div
            className="font-black tracking-widest mb-1.5"
            style={{ fontSize: 9.5, color: 'var(--gold-hi)', letterSpacing: '.12em' }}
          >
            {t(group.title)}
          </div>
          <div className="flex flex-col gap-1">
            {group.sides.map(({ side, pay }) => {
              const amount = sideBets[side] ?? 0;
              const payout = sideResults?.[side] ?? 0;
              const won = settled && payout > 0;
              const lost = settled && amount > 0 && payout === 0;
              return (
                <button
                  key={side}
                  type="button"
                  disabled={!betting}
                  onClick={() => { if (betting) { audio.play('chip'); haptic('chip'); onSide(side); } }}
                  className={`w-full text-start rounded-[6px] px-2 py-1.5 press ${won ? 'sb-won' : ''}`}
                  style={{
                    border: `1.5px solid ${won ? 'var(--gold-hi)' : amount > 0 ? 'var(--gold-line)' : 'rgba(255,255,255,.08)'}`,
                    background: amount > 0 ? 'rgba(227,178,60,.14)' : 'rgba(255,255,255,.03)',
                    opacity: lost ? 0.45 : 1,
                  }}
                >
                  <div className="flex items-center justify-between gap-1" style={{ fontSize: 11 }}>
                    <b style={{ color: 'var(--text)', lineHeight: 1.1 }}>{t(`baccarat.${side}`)}</b>
                    <b className="num shrink-0" style={{ color: 'var(--gold-hi)' }}>{pay}</b>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5" style={{ minHeight: 15 }}>
                    {amount > 0 ? (
                      <>
                        <ChipStack amount={amount} size={13} skin={chipSkin} max={4} />
                        <span
                          className="num"
                          style={{ fontSize: 10, color: won ? 'var(--jade-hi)' : lost ? 'var(--crimson-hi)' : 'var(--gold-hi)' }}
                        >
                          {won ? `+${fmt(payout)}` : lost ? t('baccarat.noHit') : `${t('baccarat.youBet')} ${fmt(amount)}`}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 9, color: 'var(--dim)' }}>
                        {betting ? t('baccarat.tapToBet') : '—'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
