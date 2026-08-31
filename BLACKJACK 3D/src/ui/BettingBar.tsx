import { useGame } from '../state/useGame'
import { useWallet } from '../state/useWallet'
import { CHIP_COLORS, CHIP_VALUES } from '../scene/models'
import { t } from '../i18n/he'

function ChipButton({ value, disabled, onClick }: {
  value: number
  disabled: boolean
  onClick: () => void
}) {
  const color = CHIP_COLORS[value as keyof typeof CHIP_COLORS]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${value}`}
      className="group relative h-14 w-14 rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:-translate-y-1"
      style={{ background: color }}
    >
      <span className="absolute inset-0 rounded-full border-[3px] border-dashed border-white/70" />
      <span className="absolute inset-[7px] rounded-full border border-white/40 bg-black/15" />
      <span className="relative z-10 font-display text-sm font-bold text-white drop-shadow">
        {value >= 1000 ? `${value / 1000}K` : value}
      </span>
    </button>
  )
}

export default function BettingBar() {
  const round = useGame(s => s.round)
  const pendingBet = useGame(s => s.pendingBet)
  const lastBet = useGame(s => s.lastBet)
  const addChip = useGame(s => s.addChip)
  const clearBet = useGame(s => s.clearBet)
  const rebet = useGame(s => s.rebet)
  const deal = useGame(s => s.deal)
  const nextRound = useGame(s => s.nextRound)
  const balance = useWallet(s => s.balance)

  const phase = round?.phase

  if (phase === 'PAYOUT') {
    return (
      <button
        onClick={nextRound}
        className="lux-gold rounded-2xl px-10 py-3.5 font-display text-lg font-bold tracking-wide"
      >
        {t('newRound')}
      </button>
    )
  }

  if (phase && phase !== 'BETTING') return null

  // Below the smallest chip nothing is clickable, so say so rather than
  // leaving a dead betting bar with no way forward.
  if (balance < CHIP_VALUES[0] && pendingBet === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-gold/30 bg-black/70 px-8 py-5 text-center backdrop-blur">
        <div className="font-display text-xl font-bold text-gold">{t('outOfChips')}</div>
        <div className="text-sm text-white/60">{t('outOfChipsHint')}</div>
      </div>
    )
  }

  return (
    <div className="lux-glass flex items-center gap-3 rounded-3xl px-5 py-3">
      <div className="flex items-center gap-2">
        {CHIP_VALUES.map(v => (
          <ChipButton
            key={v}
            value={v}
            disabled={pendingBet + v > balance}
            onClick={() => addChip(v)}
          />
        ))}
      </div>

      <div className="mx-1 h-10 w-px bg-white/15" />

      <button
        onClick={clearBet}
        disabled={pendingBet === 0}
        className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
      >
        {t('clear')}
      </button>

      <button
        onClick={rebet}
        disabled={lastBet === 0 || lastBet > balance}
        className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
      >
        {t('rebet')}
      </button>

      <button
        onClick={deal}
        disabled={pendingBet === 0}
        className="lux-gold rounded-xl px-8 py-2.5 text-base font-bold disabled:opacity-30"
      >
        {t('deal')}
      </button>
    </div>
  )
}
