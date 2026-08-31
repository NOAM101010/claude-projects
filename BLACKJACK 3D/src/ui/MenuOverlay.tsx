import { useEffect } from 'react'
import { useOverlay, OverlayPanel } from '../state/useOverlay'
import { useApp } from '../state/useApp'
import ShopModal from './ShopModal'
import ProfileModal from './ProfileModal'
import LeaderboardPanel from './LeaderboardPanel'
import AchievementsPanel from './AchievementsPanel'
import SettingsModal from './SettingsModal'
import SkinsPanel from './SkinsPanel'
import VipPanel from './VipPanel'
import { t } from '../i18n/he'

interface MenuItem {
  id: Exclude<OverlayPanel, null | 'menu'>
  label: string
  emoji: string
}

const ITEMS: MenuItem[] = [
  { id: 'shop', label: t('shop'), emoji: '🪙' },
  { id: 'vip', label: t('vip'), emoji: '👑' },
  { id: 'profile', label: t('profile'), emoji: '🤵' },
  { id: 'skins', label: t('skins'), emoji: '🎨' },
  { id: 'leaderboard', label: t('leaderboard'), emoji: '🏅' },
  { id: 'achievements', label: t('achievements'), emoji: '🏆' },
  { id: 'settings', label: t('settings'), emoji: '⚙️' },
]

function QuickMenu() {
  const open = useOverlay(s => s.open)
  const close = useOverlay(s => s.close)
  const screen = useApp(s => s.screen)
  const exitToLobby = useApp(s => s.exitToLobby)
  const inGame = screen !== 'lobby' && screen !== 'splash'

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={close}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-gold/25 bg-[#0d0a12] p-6 shadow-2xl"
        style={{ animation: 'floatUp .25s ease-out' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="lux-shimmer font-display text-2xl font-bold">{t('menu')}</h2>
          <button onClick={close} className="rounded-lg px-3 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
            {t('close')}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => open(item.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-gold/20 bg-gradient-to-b from-[#1a1206] to-black p-4 transition hover:border-gold/60"
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="text-sm font-bold text-gold">{item.label}</span>
            </button>
          ))}
        </div>

        {inGame && (
          <button
            onClick={() => { close(); exitToLobby() }}
            className="mt-4 w-full rounded-2xl bg-white/10 py-3 font-bold text-white transition hover:bg-white/20"
          >
            ‹ {t('backToLobby')}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The single global overlay layer. The M key toggles the quick menu; from it (or
 * from HUD/lobby buttons via useOverlay.open) any panel opens. Lives above every
 * screen so it works in the lobby and inside games alike.
 */
export default function MenuOverlay() {
  const panel = useOverlay(s => s.panel)
  const close = useOverlay(s => s.close)
  const toggleMenu = useOverlay(s => s.toggleMenu)

  // Global keyboard: M toggles the menu, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // Use e.code (physical key) so it works regardless of keyboard layout —
      // on a Hebrew layout the physical M key emits 'צ', not 'm'/'מ'.
      if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M' || e.key === 'מ' || e.key === 'צ') {
        e.preventDefault()
        toggleMenu()
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMenu, close])

  if (!panel) return null
  switch (panel) {
    case 'menu': return <QuickMenu />
    case 'shop': return <ShopModal onClose={close} />
    case 'profile': return <ProfileModal onClose={close} />
    case 'leaderboard': return <LeaderboardPanel onClose={close} />
    case 'achievements': return <AchievementsPanel onClose={close} />
    case 'settings': return <SettingsModal onClose={close} />
    case 'skins': return <SkinsPanel onClose={close} />
    case 'vip': return <VipPanel onClose={close} />
  }
}
