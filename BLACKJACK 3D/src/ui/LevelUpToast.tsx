import { useEffect, useState } from 'react'
import { useProgress } from '../progression/useProgress'
import { playSfx } from '../audio/sfx'
import { t } from '../i18n/he'

/** Celebrates a level-up popped from the progress queue. */
export default function LevelUpToast() {
  const pendingLevelUp = useProgress(s => s.pendingLevelUp)
  const consume = useProgress(s => s.consumeLevelUp)
  const gems = useProgress(s => s.lastLevelGems)
  const [shown, setShown] = useState<{ level: number; reward: number } | null>(null)

  // Pull the pending level-up. Separate from the hide timer so the setShown
  // re-render can't clear that timer (which left the banner on screen forever).
  useEffect(() => {
    if (shown || pendingLevelUp === null) return
    const next = consume()
    if (!next) return
    setShown(next)
    playSfx('win')
  }, [pendingLevelUp, shown, consume])

  // Auto-hide, keyed only on `shown`.
  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(null), 3800)
    return () => clearTimeout(timer)
  }, [shown])

  if (!shown) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3 z-[55] -translate-x-1/2">
      <div
        className="flex flex-col items-center gap-1 rounded-3xl border border-gold/60 bg-gradient-to-b from-[#2a1f06] to-black px-10 py-6 shadow-2xl"
        style={{ animation: 'floatUp .4s ease-out' }}
      >
        <div className="text-5xl">⭐</div>
        <div className="lux-shimmer font-display text-3xl font-bold">{t('levelUp')} {shown.level}</div>
        <div className="flex items-center gap-3 text-sm font-bold">
          {shown.reward > 0 && <span className="text-gold">+{shown.reward.toLocaleString('he-IL')} 🪙</span>}
          {gems > 0 && <span className="text-sky-300">+{gems} 💎</span>}
        </div>
      </div>
    </div>
  )
}
