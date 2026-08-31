import { useProgress } from '../progression/useProgress'
import { MAX_LEVEL } from '../progression/levels'
import { useCosmetics } from '../state/useCosmetics'

/** Compact level chip with an XP progress ring, for the shared HUD. */
export default function LevelBadge() {
  const xp = useProgress(s => s.xp)
  const avatar = useProgress(s => s.avatar)
  const frameId = useCosmetics(s => s.avatarFrame)
  const frameRing = useCosmetics.getState().currentFrame().ring
  void frameId
  const { level, frac } = useProgress.getState().progress()
  // Recompute reactively by reading xp above; progress() is pure over xp.
  void xp
  const maxed = level >= MAX_LEVEL

  const R = 18
  const C = 2 * Math.PI * R
  const dash = C * Math.min(Math.max(frac, 0), 1)

  return (
    <div className="lux-glass flex items-center gap-2 rounded-2xl px-3 py-2">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-xl" style={{ boxShadow: frameRing }}>{avatar}</div>
      <div className="relative h-11 w-11">
        <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
          <circle cx="22" cy="22" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <circle
            cx="22" cy="22" r={R} fill="none" stroke="#d4af37" strokeWidth="4"
            strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-display text-sm font-bold text-gold">
          {level}
        </div>
      </div>
      <div className="pr-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/60">רמה</div>
        <div className="text-xs font-bold text-white/80">{maxed ? 'MAX' : `${Math.round(frac * 100)}%`}</div>
      </div>
    </div>
  )
}
