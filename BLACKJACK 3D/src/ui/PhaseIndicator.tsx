import { useGame } from '../state/useGame'
import { t } from '../i18n/he'

/**
 * Always says whose turn it is. Without this the paced dealer reads as a freeze.
 */
export default function PhaseIndicator() {
  const phase = useGame(s => s.round?.phase)

  const label =
    !phase || phase === 'BETTING' ? t('phaseBetting')
      : phase === 'PLAYER' || phase === 'INSURANCE' ? t('phaseYourTurn')
      : phase === 'DEALER' ? t('phaseDealer')
      : phase === 'PAYOUT' ? t('phaseDone')
      : null

  if (!label) return null

  const busy = phase === 'DEALER'

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-4 py-1.5 text-sm font-semibold text-white/80 backdrop-blur">
      {busy && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden />
      )}
      {label}
    </div>
  )
}
