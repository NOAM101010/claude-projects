import { useState } from 'react'
import { useProgress, AVATARS } from '../progression/useProgress'
import { useWallet } from '../state/useWallet'
import { useCosmetics } from '../state/useCosmetics'
import { ACHIEVEMENTS } from '../progression/achievements'
import { t } from '../i18n/he'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="font-display text-lg font-bold tabular-nums text-white">{value}</div>
    </div>
  )
}

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const name = useProgress(s => s.name)
  const avatar = useProgress(s => s.avatar)
  const setName = useProgress(s => s.setName)
  const setAvatar = useProgress(s => s.setAvatar)
  const bestStreak = useProgress(s => s.bestStreak)
  const unlocked = useProgress(s => s.unlocked)
  const { level, frac } = useProgress.getState().progress()
  const avatarFrame = useCosmetics(s => s.avatarFrame)
  const titleId = useCosmetics(s => s.title)
  const frameRing = useCosmetics.getState().currentFrame().ring
  const currentTitle = useCosmetics.getState().currentTitle()
  void avatarFrame; void titleId

  const w = useWallet()
  const decided = w.wins + w.losses
  const rate = decided > 0 ? Math.round((w.wins / decided) * 100) : 0

  const [draft, setDraft] = useState(name)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/25 bg-[#0d0a12] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gold">{t('profile')}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            {t('close')}
          </button>
        </div>

        {/* Identity */}
        <div className="mb-5 flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-b from-[#1a1206] to-black text-5xl" style={{ boxShadow: frameRing }}>
            {avatar}
          </div>
          <div className="flex-1">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={() => draft.trim() && setName(draft.trim())}
              maxLength={16}
              dir="rtl"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-lg font-bold text-white outline-none focus:border-gold/60"
            />
            {currentTitle.id !== 'none' && (
              <div className="mt-1 text-sm font-bold text-gold">🏷️ {currentTitle.name}</div>
            )}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-white/50">
                <span>{Math.round(frac * 100)}%</span>
                <span>{t('level')} {level}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gold" style={{ width: `${frac * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Avatar picker */}
        <div className="mb-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('chooseAvatar')}</div>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map(a => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`grid aspect-square place-items-center rounded-xl text-2xl transition ${
                  a === avatar ? 'bg-gold/20 ring-2 ring-gold' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-gold/70">{t('stats')}</div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('handsPlayed')} value={String(w.handsPlayed)} />
          <Stat label={t('winRate')} value={`${rate}%`} />
          <Stat label={t('wins')} value={String(w.wins)} />
          <Stat label={t('blackjacks')} value={String(w.blackjacks)} />
          <Stat label="רצף שיא" value={String(bestStreak)} />
          <Stat label={t('achievements')} value={`${unlocked.length}/${ACHIEVEMENTS.length}`} />
          <div className="col-span-3">
            <Stat label={t('biggestWin')} value={Math.round(w.biggestWin).toLocaleString('he-IL')} />
          </div>
        </div>
      </div>
    </div>
  )
}
