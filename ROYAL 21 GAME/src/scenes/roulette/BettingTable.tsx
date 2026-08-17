import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GRID_ROWS, columnNumbers, dozenNumbers, isRed,
} from '@/games/roulette/engine';
import type { RouletteBetKind, RouletteSeat } from '@/games/roulette/types';
import { useT } from '@/hooks/useT';

export const betKey = (kind: RouletteBetKind, numbers: number[]) => `${kind}:${numbers.join(',')}`;

interface Contribution { color: string; amount: number; userId: string }

interface Props {
  seats: RouletteSeat[];
  disabled: boolean;
  /** Set once a spin resolves — draws the classic casino "marker" (dolly) on
   *  the winning number so the whole table can see it at a glance. Clears when
   *  the next betting window opens. */
  winningNumber?: number | null;
  onBet: (kind: RouletteBetKind, numbers: number[]) => void;
}

/** Casino "dolly" — the crystal marker croupiers drop on the winning number
 *  after a spin. Sits above the chip cluster and pulses to draw the eye. */
function WinnerMarker() {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 15, delay: 0.15 }}
      className="absolute pointer-events-none"
      style={{
        top: -6, right: -6, width: 18, height: 18, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #fff8d6, #e3b23c 55%, #7a5822)',
        boxShadow: '0 0 12px rgba(227,178,60,.9), inset 0 -2px 3px rgba(0,0,0,.4)',
        border: '1px solid #fff8d6', zIndex: 5,
      }}
    />
  );
}

function ChipCluster({ contributions }: { contributions: Contribution[] }) {
  if (!contributions.length) return null;
  const total = contributions.reduce((sum, c) => sum + c.amount, 0);
  return (
    <div className="absolute inset-x-0 bottom-0.5 flex flex-col items-center pointer-events-none" style={{ gap: 1 }}>
      <div className="flex" style={{ marginInlineStart: -4 }}>
        {contributions.slice(0, 5).map((c, i) => (
          <span
            key={c.userId}
            className="rounded-full"
            style={{
              width: 10, height: 10, marginInlineStart: -4, zIndex: i,
              background: c.color, border: '1px solid rgba(0,0,0,.5)',
              boxShadow: '0 1px 2px rgba(0,0,0,.5)',
            }}
          />
        ))}
      </div>
      <span className="num" style={{ fontSize: 8, color: 'var(--gold-hi)', fontWeight: 800, lineHeight: 1 }}>{total}</span>
    </div>
  );
}

/** The felt: 0 + 3x12 grid, dozens, columns and the classic even-money bets. */
export function BettingTable({ seats, disabled, winningNumber, onBet }: Props) {
  const { t } = useT();

  const byKey = useMemo(() => {
    const map = new Map<string, Contribution[]>();
    for (const seat of seats) {
      for (const bet of seat.bets) {
        const key = betKey(bet.kind, bet.numbers);
        const list = map.get(key) ?? [];
        list.push({ color: seat.color, amount: bet.amount, userId: seat.userId });
        map.set(key, list);
      }
    }
    return map;
  }, [seats]);

  const cellStyle = (n: number, extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'relative',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: 4,
    background: n === 0 ? '#1c7a4a' : isRed(n) ? '#7a2f2d' : '#1a1c22',
    border: '1px solid rgba(227,178,60,.18)',
    color: '#f3efe6', fontWeight: 800, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
    userSelect: 'none',
    ...extra,
  });

  const outsideStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(227,178,60,.18)',
    color: 'var(--muted)', fontWeight: 700, fontSize: 11,
    cursor: disabled ? 'default' : 'pointer', userSelect: 'none',
    ...extra,
  });

  const handle = (kind: RouletteBetKind, numbers: number[]) => {
    if (disabled) return;
    onBet(kind, numbers);
  };

  const outsideBets: { kind: RouletteBetKind; numbers: number[]; label: string; col: number }[] = [
    { kind: 'low', numbers: [], label: t('roulette.low'), col: 0 },
    { kind: 'even', numbers: [], label: t('roulette.even'), col: 1 },
    { kind: 'red', numbers: [], label: t('roulette.red'), col: 2 },
    { kind: 'black', numbers: [], label: t('roulette.black'), col: 3 },
    { kind: 'odd', numbers: [], label: t('roulette.odd'), col: 4 },
    { kind: 'high', numbers: [], label: t('roulette.high'), col: 5 },
  ];

  return (
    <div
      className="w-full rounded-[var(--r-sm)] overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr repeat(12, 1fr) 1fr',
        gridTemplateRows: 'repeat(3, 42px) 34px 34px',
        gap: 2,
        background: 'var(--felt)',
        padding: 3,
        boxShadow: 'var(--shadow-inset)',
      }}
    >
      {/* zero */}
      <motion.div
        whileTap={!disabled ? { scale: 0.93 } : undefined}
        style={{ ...cellStyle(0, { gridColumn: '1 / 2', gridRow: '1 / 4', alignItems: 'center', borderRadius: 6 }),
          ...(winningNumber === 0 ? { boxShadow: 'inset 0 0 0 3px var(--gold-hi), 0 0 24px rgba(227,178,60,.6)' } : {}) }}
        onClick={() => handle('straight', [0])}
      >
        0
        {winningNumber === 0 && <WinnerMarker />}
        <ChipCluster contributions={byKey.get(betKey('straight', [0])) ?? []} />
      </motion.div>

      {/* number grid */}
      {GRID_ROWS.map((row, r) =>
        row.map((n, c) => {
          const isWinner = winningNumber === n;
          return (
            <motion.div
              key={n}
              whileTap={!disabled ? { scale: 0.93 } : undefined}
              style={cellStyle(n, {
                gridColumn: `${c + 2} / ${c + 3}`, gridRow: `${r + 1} / ${r + 2}`,
                ...(isWinner ? { boxShadow: 'inset 0 0 0 3px var(--gold-hi), 0 0 24px rgba(227,178,60,.6)' } : {}),
              })}
              onClick={() => handle('straight', [n])}
            >
              {n}
              {isWinner && <WinnerMarker />}
              <ChipCluster contributions={byKey.get(betKey('straight', [n])) ?? []} />
            </motion.div>
          );
        }),
      )}

      {/* column bets, one per row */}
      {[0, 1, 2].map((r) => (
        <motion.div
          key={`col-${r}`}
          whileTap={!disabled ? { scale: 0.95 } : undefined}
          style={outsideStyle({ gridColumn: '14 / 15', gridRow: `${r + 1} / ${r + 2}`, fontSize: 10 })}
          onClick={() => handle('column', columnNumbers(r as 0 | 1 | 2))}
        >
          2:1
          <ChipCluster contributions={byKey.get(betKey('column', columnNumbers(r as 0 | 1 | 2))) ?? []} />
        </motion.div>
      ))}

      {/* dozens */}
      {[1, 2, 3].map((d) => (
        <motion.div
          key={`dozen-${d}`}
          whileTap={!disabled ? { scale: 0.96 } : undefined}
          style={outsideStyle({ gridColumn: `${(d - 1) * 4 + 2} / ${(d - 1) * 4 + 6}`, gridRow: '4 / 5' })}
          onClick={() => handle('dozen', dozenNumbers(d as 1 | 2 | 3))}
        >
          {t(`roulette.dozen${d}`)}
          <ChipCluster contributions={byKey.get(betKey('dozen', dozenNumbers(d as 1 | 2 | 3))) ?? []} />
        </motion.div>
      ))}

      {/* even-money outside bets */}
      {outsideBets.map((bet) => (
        <motion.div
          key={bet.kind}
          whileTap={!disabled ? { scale: 0.96 } : undefined}
          style={outsideStyle({
            gridColumn: `${2 + bet.col * 2} / ${4 + bet.col * 2}`, gridRow: '5 / 6',
            background: bet.kind === 'red' ? 'rgba(168,65,62,.28)' : bet.kind === 'black' ? 'rgba(21,22,26,.5)' : undefined,
            color: bet.kind === 'red' ? 'var(--crimson-hi)' : bet.kind === 'black' ? '#e8e3d4' : undefined,
          })}
          onClick={() => handle(bet.kind, bet.numbers)}
        >
          {bet.label}
          <ChipCluster contributions={byKey.get(betKey(bet.kind, bet.numbers)) ?? []} />
        </motion.div>
      ))}
    </div>
  );
}
