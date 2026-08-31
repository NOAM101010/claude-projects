import { Suspense } from 'react'
import { useApp } from './state/useApp'
import Hud from './ui/Hud'
import MenuOverlay from './ui/MenuOverlay'
import WinCelebration from './ui/WinCelebration'
import DiamondDropToast from './ui/DiamondDropToast'
import SplashScreen from './ui/SplashScreen'
import LobbyScene from './lobby/LobbyScene'
import BlackjackGame from './games/blackjack/BlackjackGame'
import SlotsGame from './games/slots/SlotsGame'
import RouletteGame from './games/roulette/RouletteGame'
import ScratchGame from './games/scratch/ScratchGame'

/** Fades the screen out during a transition so scene swaps don't pop. */
function FadeVeil() {
  const transitioning = useApp(s => s.transitioning)
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-40 bg-black transition-opacity duration-300 ${
        transitioning ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}

function CurrentScreen() {
  const screen = useApp(s => s.screen)
  switch (screen) {
    case 'blackjack':
      return <BlackjackGame />
    case 'slots':
      return <SlotsGame />
    case 'roulette':
      return <RouletteGame />
    case 'scratch':
      return <ScratchGame />
    case 'lobby':
      return <LobbyScene />
    default:
      return null
  }
}

export default function App() {
  const screen = useApp(s => s.screen)

  return (
    <div className="fixed inset-0 overflow-hidden">
      {screen === 'splash' ? (
        <SplashScreen />
      ) : (
        <>
          <Suspense fallback={<div className="absolute inset-0 bg-[#080506]" />}>
            <CurrentScreen />
          </Suspense>
          <Hud />
          <WinCelebration />
          <DiamondDropToast />
          <MenuOverlay />
          <FadeVeil />
        </>
      )}
    </div>
  )
}
