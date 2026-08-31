import { BetKind, colorOf } from './engine'
import { useRoulette } from './useRoulette'
import { useCosmetics } from '../../state/useCosmetics'
import { CHIP_COLORS, CHIP_VALUES, breakIntoChips } from '../../scene/models'

const RED = '#b01623'
const BLACK = '#1c1c1c'

function cellColor(n: number): string {
  const c = colorOf(n)
  return c === 'red' ? RED : c === 'black' ? BLACK : '#0e7a3a'
}

/** The number grid is laid out in three rows (columns of the felt). */
const GRID_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
]

export default function BettingBoard() {
  const bets = useRoulette(s => s.bets)
  const phase = useRoulette(s => s.phase)
  const placeBet = useRoulette(s => s.placeBet)

  const felt = useCosmetics(s => s.currentFelt())
  const disabled = phase !== 'betting'
  const amountOn = (kind: BetKind, value?: number) =>
    bets.filter(b => b.kind === kind && b.value === value).reduce((a, b) => a + b.amount, 0)

  // A small stack of coloured chip discs (largest denomination on top) plus the
  // total — reads as real chips sitting on the number, not just a badge.
  const Chip = ({ amount }: { amount: number }) => {
    if (amount <= 0) return null
    const chips = breakIntoChips(amount, CHIP_VALUES, 4)
    return (
      <span className="pointer-events-none absolute -right-1 -top-2 flex flex-col items-center">
        <span className="relative block h-4 w-4">
          {chips.map((v, i) => (
            <span
              key={i}
              className="absolute left-0 h-4 w-4 rounded-full border border-white/70"
              style={{ background: CHIP_COLORS[v], bottom: `${i * 2}px` }}
            />
          ))}
        </span>
        <span className="mt-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-gold">
          {amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}
        </span>
      </span>
    )
  }

  const Btn = ({ label, kind, value, className = '', bg }: {
    label: string; kind: BetKind; value?: number; className?: string; bg?: string
  }) => (
    <button
      disabled={disabled}
      onClick={() => placeBet(kind, value)}
      style={bg ? { background: bg } : undefined}
      className={`relative rounded-md border border-white/20 text-xs font-bold text-white transition hover:brightness-125 disabled:opacity-50 ${className}`}
    >
      {label}
      <Chip amount={amountOn(kind, value)} />
    </button>
  )

  return (
    <div
      className="pointer-events-auto w-full max-w-2xl rounded-2xl border-2 p-3 shadow-2xl"
      style={{
        borderColor: felt.accent + '88',
        background: `radial-gradient(ellipse at 50% 0%, ${felt.felt} 0%, ${felt.felt} 55%, #000 160%)`,
        boxShadow: '0 12px 40px -10px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.35)',
      }}
    >
      {/* Zero + number grid */}
      <div className="flex gap-1">
        <button
          disabled={disabled}
          onClick={() => placeBet('straight', 0)}
          className="relative w-9 rounded-md border border-white/20 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: '#0e7a3a' }}
        >
          0
          <Chip amount={amountOn('straight', 0)} />
        </button>

        <div className="grid flex-1 grid-rows-3 gap-1">
          {GRID_ROWS.map((row, ri) => (
            <div key={ri} className="grid grid-cols-12 gap-1">
              {row.map(n => (
                <button
                  key={n}
                  disabled={disabled}
                  onClick={() => placeBet('straight', n)}
                  className="relative aspect-square rounded-md border border-white/15 text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: cellColor(n) }}
                >
                  {n}
                  <Chip amount={amountOn('straight', n)} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Dozens */}
      <div className="mt-1 grid grid-cols-3 gap-1">
        <Btn label="1-12" kind="dozen" value={1} className="py-1.5 bg-black/25" />
        <Btn label="13-24" kind="dozen" value={2} className="py-1.5 bg-black/25" />
        <Btn label="25-36" kind="dozen" value={3} className="py-1.5 bg-black/25" />
      </div>

      {/* Even-money row */}
      <div className="mt-1 grid grid-cols-6 gap-1">
        <Btn label="1-18" kind="low" className="py-1.5 bg-black/25" />
        <Btn label="זוגי" kind="even" className="py-1.5 bg-black/25" />
        <Btn label="אדום" kind="red" className="py-1.5" bg={RED} />
        <Btn label="שחור" kind="black" className="py-1.5" bg={BLACK} />
        <Btn label="אי-זוגי" kind="odd" className="py-1.5 bg-black/25" />
        <Btn label="19-36" kind="high" className="py-1.5 bg-black/25" />
      </div>
    </div>
  )
}
