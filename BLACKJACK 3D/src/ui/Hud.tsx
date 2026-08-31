import { useApp } from '../state/useApp'
import { useOverlay } from '../state/useOverlay'
import BalanceDisplay from './BalanceDisplay'
import LevelBadge from './LevelBadge'
import Toast from './Toast'
import AchievementToast from './AchievementToast'
import LevelUpToast from './LevelUpToast'
import { t } from '../i18n/he'

function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={t('menu')}
      className="flex h-11 items-center gap-2 rounded-full border border-gold/30 bg-black/55 px-4 text-sm font-bold text-gold backdrop-blur transition hover:border-gold"
    >
      ☰ <span className="hidden sm:inline">{t('menu')}</span>
      <span className="rounded bg-white/10 px-1.5 text-[10px] text-white/60">M</span>
    </button>
  )
}

function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={t('settings')}
      className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/55 text-white/70 backdrop-blur transition hover:text-white"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-4 text-sm font-bold text-white/80 backdrop-blur transition hover:text-white"
    >
      <span className="text-lg leading-none">‹</span>
      {t('backToLobby')}
    </button>
  )
}

/**
 * The persistent overlay shown on top of every screen: balance, level, settings,
 * result toasts, and — inside a game — a way back to the lobby. Games render
 * their own controls beneath this via the `children` slot area in App.
 */
export default function Hud() {
  const screen = useApp(s => s.screen)
  const exitToLobby = useApp(s => s.exitToLobby)
  const openMenu = useOverlay(s => s.toggleMenu)

  if (screen === 'splash') return null
  const inGame = screen !== 'lobby'

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <BalanceDisplay />
          <LevelBadge />
        </div>

        <div className="pointer-events-none flex flex-1 justify-center pt-2">
          <Toast />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {inGame && <BackButton onClick={exitToLobby} />}
          <MenuButton onClick={openMenu} />
        </div>
      </div>

      <AchievementToast />
      <LevelUpToast />
    </>
  )
}
