import { useEffect } from 'react'
import { useGame } from '../state/useGame'
import { useSettings } from '../state/useSettings'
import { bestMove, Move } from '../engine/strategy'
import { activeHand } from '../engine/round'
import { t } from '../i18n/he'

function Btn({ label, hint, onClick, disabled, accent, recommended }: {
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  accent?: boolean
  recommended?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex min-w-24 flex-col items-center rounded-2xl px-5 py-2.5 font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-25 ${
        accent ? 'lux-gold' : 'lux-glass text-white'
      } ${recommended ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black/50' : ''}`}
    >
      <span className="text-base">{label}</span>
      {hint && <span className="text-[10px] font-normal opacity-60">{hint}</span>}
    </button>
  )
}

export default function ActionBar() {
  const round = useGame(s => s.round)
  const doHit = useGame(s => s.doHit)
  const doStand = useGame(s => s.doStand)
  const doDouble = useGame(s => s.doDouble)
  const doSplit = useGame(s => s.doSplit)
  const doInsurance = useGame(s => s.doInsurance)
  const trainerMode = useSettings(s => s.trainerMode)

  const phase = round?.phase
  const canHit = useGame(s => s.canHit)
  const canDoubleNow = useGame(s => s.canDoubleNow)
  const canSplitNow = useGame(s => s.canSplitNow)

  useEffect(() => {
    if (phase !== 'PLAYER') return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case 'h': if (canHit()) doHit(); break
        case 's': doStand(); break
        case 'd': if (canDoubleNow()) doDouble(); break
        case 'p': if (canSplitNow()) doSplit(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, canHit, canDoubleNow, canSplitNow, doHit, doStand, doDouble, doSplit])

  if (phase === 'INSURANCE') {
    return (
      <div className="lux-glass flex items-center gap-3 rounded-3xl px-6 py-3">
        <span className="text-lg font-bold text-gold">{t('insurance')}</span>
        <Btn label={t('yes')} accent onClick={() => doInsurance(true)} />
        <Btn label={t('no')} onClick={() => doInsurance(false)} />
      </div>
    )
  }

  if (phase !== 'PLAYER' || !round) return null

  let advice: Move | null = null
  if (trainerMode) {
    const hand = activeHand(round)
    const upcard = round.dealer[0]
    if (hand && upcard) advice = bestMove(hand, upcard, round.rules)
  }

  const hitOk = canHit()
  const doubleOk = canDoubleNow()
  const splitOk = canSplitNow()

  // Fall back to the legal move when the ideal one is unavailable.
  const effective: Move | null =
    advice === 'DOUBLE' && !doubleOk ? 'HIT'
      : advice === 'SPLIT' && !splitOk ? 'HIT'
      : advice === 'SURRENDER' ? 'HIT'
      : advice

  return (
    <div className="flex items-center gap-2.5">
      <Btn label={t('hit')} hint="H" accent onClick={doHit} disabled={!hitOk} recommended={effective === 'HIT'} />
      <Btn label={t('stand')} hint="S" onClick={doStand} recommended={effective === 'STAND'} />
      <Btn label={t('double')} hint="D" onClick={doDouble} disabled={!doubleOk} recommended={effective === 'DOUBLE'} />
      <Btn label={t('split')} hint="P" onClick={doSplit} disabled={!splitOk} recommended={effective === 'SPLIT'} />
    </div>
  )
}
