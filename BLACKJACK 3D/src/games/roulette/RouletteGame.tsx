import { useEffect } from 'react'
import { useRoulette } from './useRoulette'
import { colorOf } from './engine'
import RouletteWheel2D from './RouletteWheel2D'
import BettingBoard from './BettingBoard'
import { CHIP_VALUES, CHIP_COLORS } from '../../three'
import { t } from '../../i18n/he'

function RecentResults() {
  const recent = useRoulette(s => s.recent)
  if (recent.length === 0) return null
  return (
    <div className="flex items-center gap-1.5">
      {recent.slice(0, 8).map((n, i) => {
        const c = colorOf(n)
        const bg = c === 'red' ? '#b01623' : c === 'black' ? '#1c1c1c' : '#0e7a3a'
        return (
          <div
            key={i}
            className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white"
            style={{ background: bg, opacity: 1 - i * 0.08 }}
          >
            {n}
          </div>
        )
      })}
    </div>
  )
}

function ChipPicker() {
  const chip = useRoulette(s => s.chip)
  const setChip = useRoulette(s => s.setChip)
  const maxBet = useRoulette(s => s.maxBet)
  const minBet = useRoulette(s => s.minBet)
  // Only show chips that fit the table, and on high-minimum tables drop the tiny
  // denominations so the VIP room only offers big chips.
  const floor = minBet >= 1000 ? minBet / 10 : 0
  return (
    <div className="flex items-center gap-2">
      {CHIP_VALUES.filter(v => v <= maxBet && v >= floor).map(v => (
        <button
          key={v}
          onClick={() => setChip(v)}
          className={`grid h-11 w-11 place-items-center rounded-full text-xs font-bold text-white transition ${
            chip === v ? 'ring-2 ring-gold ring-offset-2 ring-offset-black' : ''
          }`}
          style={{ background: CHIP_COLORS[v as keyof typeof CHIP_COLORS] }}
        >
          {v >= 1000 ? `${v / 1000}K` : v}
        </button>
      ))}
    </div>
  )
}

export default function RouletteGame() {
  const phase = useRoulette(s => s.phase)
  const result = useRoulette(s => s.result)
  const message = useRoulette(s => s.message)
  const doSpin = useRoulette(s => s.doSpin)
  const clearBets = useRoulette(s => s.clearBets)
  const syncBounds = useRoulette(s => s.syncBounds)
  const repeatLast = useRoulette(s => s.repeatLast)
  const saveFavorite = useRoulette(s => s.saveFavorite)
  const loadFavorite = useRoulette(s => s.loadFavorite)
  const lastBets = useRoulette(s => s.lastBets)
  const savedBets = useRoulette(s => s.savedBets)
  const bets = useRoulette(s => s.bets)

  useEffect(() => { syncBounds() }, [syncBounds])

  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 35%, #1a1012, #0a0608 70%)' }}>
      <RouletteWheel2D />

      {/* Result is revealed ONLY when the ball has landed (phase 'result'). */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex flex-col items-center gap-3">
        {phase === 'spinning' && (
          <div className="lux-glass rounded-full px-5 py-2 text-sm font-bold text-white/70">
            הכדור מסתובב…
          </div>
        )}
        {phase === 'result' && result !== null && (
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl font-display text-3xl font-bold text-white shadow-2xl"
            style={{
              background:
                colorOf(result) === 'red' ? '#b01623' : colorOf(result) === 'black' ? '#1c1c1c' : '#0e7a3a',
              animation: 'floatUp .3s ease-out',
            }}
          >
            {result}
          </div>
        )}
        {phase === 'result' && message && (
          <div className="lux-glass rounded-2xl px-7 py-2 font-display text-xl font-bold text-gold" style={{ animation: 'floatUp .3s ease-out' }}>
            {message}
          </div>
        )}
        <RecentResults />
      </div>

      {/* Betting board + controls — slide away during the spin so the whole
          wheel is visible while the ball runs. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 transition-all duration-500 ${
          phase === 'betting' ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'
        }`}
      >
        <BettingBoard />
        <div className="lux-glass pointer-events-auto flex items-center gap-3 rounded-3xl px-5 py-2.5">
          <ChipPicker />
          <div className="mx-1 h-10 w-px bg-white/15" />
          <button
            onClick={clearBets}
            disabled={phase !== 'betting'}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
          >
            {t('clear')}
          </button>
          <button
            onClick={repeatLast}
            disabled={phase !== 'betting' || lastBets.length === 0}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
          >
            ↻ {t('repeatBet')}
          </button>
          <button
            onClick={saveFavorite}
            disabled={phase !== 'betting' || bets.length === 0}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
            title={t('saveBet')}
          >
            ★
          </button>
          <button
            onClick={loadFavorite}
            disabled={phase !== 'betting' || savedBets.length === 0}
            className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:opacity-30"
            title={t('loadBet')}
          >
            ☆
          </button>
          <button
            onClick={doSpin}
            disabled={phase !== 'betting'}
            className="lux-gold rounded-xl px-8 py-2.5 text-base font-bold disabled:opacity-30"
          >
            {t('spin')}
          </button>
        </div>
      </div>
    </div>
  )
}
