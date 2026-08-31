import { useEffect, useRef, useState } from 'react'
import { useWallet } from '../state/useWallet'
import { useDiamonds } from '../state/useDiamonds'
import { useGame } from '../state/useGame'
import { t } from '../i18n/he'

/** Counts the displayed number toward the real balance so payouts read as motion. */
function useCountUp(value: number) {
  const [shown, setShown] = useState(value)
  const raf = useRef(0)
  const current = useRef(value)
  current.current = shown

  useEffect(() => {
    const from = current.current
    if (from === value) return

    // rAF is suspended while the tab is hidden, which would otherwise strand the
    // display on a stale figure until the user interacts again.
    if (document.hidden) {
      setShown(value)
      return
    }

    const start = performance.now()
    const dur = 550

    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (value - from) * e))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    // If the tab is hidden mid-count, land on the true value straight away.
    const onHide = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf.current)
        setShown(value)
      }
    }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelAnimationFrame(raf.current)
      document.removeEventListener('visibilitychange', onHide)
    }
    // Keyed on the target only; the ref carries the animation's start point.
  }, [value])

  return shown
}

export default function BalanceDisplay() {
  const balance = useWallet(s => s.balance)
  const diamonds = useDiamonds(s => s.diamonds)
  const pendingBet = useGame(s => s.pendingBet)
  const round = useGame(s => s.round)
  const shown = useCountUp(balance)

  const liveBet = round?.hands.reduce((a, h) => a + h.bet, 0) ?? 0
  const bet = pendingBet || liveBet

  return (
    <div className="lux-glass flex items-stretch overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2.5 px-5 py-2.5">
        <span className="text-lg">🪙</span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/60">
            {t('balance')}
          </div>
          <div className="lux-gold-text font-display text-2xl font-bold leading-tight tabular-nums">
            {shown.toLocaleString('he-IL')}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-r border-gold/20 px-4 py-2.5">
        <span className="text-base">💎</span>
        <span className="font-display text-lg font-bold text-sky-300 tabular-nums">
          {diamonds.toLocaleString('he-IL')}
        </span>
      </div>

      {bet > 0 && (
        <div className="border-r border-gold/20 bg-gold/10 px-5 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {t('bet')}
          </div>
          <div className="font-display text-2xl font-bold leading-tight text-white tabular-nums">
            {bet.toLocaleString('he-IL')}
          </div>
        </div>
      )}
    </div>
  )
}
