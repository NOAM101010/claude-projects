import { ACHIEVEMENTS } from '../progression/achievements'
import { useProgress } from '../progression/useProgress'
import { t } from '../i18n/he'

export default function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const unlocked = useProgress(s => s.unlocked)
  const unlockedIds = new Set(unlocked.map(u => u.id))
  const done = ACHIEVEMENTS.filter(a => unlockedIds.has(a.id)).length

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/25 bg-[#0d0a12] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gold">
            {t('achievements')} <span className="text-sm text-white/40">{done}/{ACHIEVEMENTS.length}</span>
          </h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            {t('close')}
          </button>
        </div>

        <ul className="space-y-2">
          {ACHIEVEMENTS.map(a => {
            const got = unlockedIds.has(a.id)
            return (
              <li
                key={a.id}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  got ? 'border border-gold/40 bg-gold/10' : 'bg-white/5 opacity-70'
                }`}
              >
                <div className={`grid h-10 w-10 place-items-center rounded-full text-xl ${got ? 'bg-gold/20' : 'bg-white/10 grayscale'}`}>
                  {got ? '🏆' : '🔒'}
                </div>
                <div className="flex-1">
                  <div className={`font-bold ${got ? 'text-gold' : 'text-white/70'}`}>{a.name}</div>
                  <div className="text-xs text-white/50">{a.description}</div>
                </div>
                {a.reward > 0 && (
                  <div className="text-xs font-bold text-white/50">+{a.reward.toLocaleString('he-IL')}</div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
