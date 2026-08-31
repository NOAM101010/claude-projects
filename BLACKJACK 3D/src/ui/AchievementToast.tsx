import { useEffect, useState } from 'react'
import { useProgress, ACHIEVEMENTS } from '../progression/useProgress'
import { playSfx } from '../audio/sfx'

/** Pops achievement unlocks one at a time from the progress queue. */
export default function AchievementToast() {
  const pending = useProgress(s => s.pending)
  const consume = useProgress(s => s.consumePending)
  const [shown, setShown] = useState<string | null>(null)

  // Pull the next unlock off the queue. Kept separate from the hide timer so the
  // re-render caused by setShown can't clear that timer (the bug that left the
  // toast on screen forever).
  useEffect(() => {
    if (shown || pending.length === 0) return
    const id = consume()
    if (!id) return
    setShown(id)
    playSfx('win')
  }, [pending, shown, consume])

  // Auto-hide, keyed only on `shown` so it survives until it actually fires.
  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(null), 3600)
    return () => clearTimeout(timer)
  }, [shown])

  if (!shown) return null
  const a = ACHIEVEMENTS.find(x => x.id === shown)
  if (!a) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-gold/60 bg-gradient-to-b from-[#241a06] to-black px-6 py-3.5 shadow-2xl">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-gold/20 text-2xl">🏆</div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/70">הישג נפתח</div>
          <div className="font-display text-lg font-bold text-gold">{a.name}</div>
          <div className="text-xs text-white/60">{a.description}{a.reward > 0 ? ` · +${a.reward}` : ''}</div>
        </div>
      </div>
    </div>
  )
}
