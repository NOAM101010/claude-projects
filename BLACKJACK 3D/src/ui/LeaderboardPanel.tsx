import { useLeaderboard } from '../services/useLeaderboard'
import { t } from '../i18n/he'

export default function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const { entries, loading, online, myId } = useLeaderboard()

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gold/25 bg-[#0d0a12] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-gold">{t('leaderboard')}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            {t('close')}
          </button>
        </div>

        <div className="mb-3 text-xs text-white/40">
          {online ? '🟢 מחובר (online)' : '⚪ מקומי — הוסף Supabase לחיבור אמיתי'}
        </div>

        {loading ? (
          <div className="py-8 text-center text-white/40">טוען…</div>
        ) : (
          <ol className="space-y-1.5">
            {entries.map((e, i) => {
              const me = e.id === myId
              return (
                <li
                  key={e.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    me ? 'border border-gold/50 bg-gold/10' : 'bg-white/5'
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                      i === 0 ? 'bg-gold text-black' : i < 3 ? 'bg-white/20 text-white' : 'text-white/50'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-xl">
                    {e.avatar ?? '🎲'}
                  </span>
                  <div className="flex-1">
                    <div className="font-bold text-white">
                      {e.name} {me && <span className="text-xs text-gold">(אתה)</span>}
                    </div>
                    <div className="text-xs text-white/40">{t('level')} {e.level}</div>
                  </div>
                  <div className="text-left">
                    <div className="font-display font-bold text-gold tabular-nums">
                      {e.chips.toLocaleString('he-IL')}
                    </div>
                    <div className="text-[10px] text-white/40">שיא {e.biggestWin.toLocaleString('he-IL')}</div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
