import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Dev-only store bridge, so screens can be driven in automated testing where
// pointer-lock and the 3D render loop are unavailable.
if (import.meta.env.DEV) {
  Promise.all([
    import('./state/useApp'),
    import('./state/useWallet'),
    import('./progression/useProgress'),
    import('./games/slots/useSlots'),
    import('./games/roulette/useRoulette'),
    import('./state/useCashier'),
    import('./state/useOverlay'),
    import('./state/useJackpot'),
    import('./state/useCosmetics'),
    import('./state/useDiamonds'),
    import('./state/usePiggyBank'),
    import('./games/scratch/useScratch'),
    import('./state/useVip'),
  ]).then(([app, wallet, progress, slots, roulette, cashier, overlay, jackpot, cosmetics, diamonds, piggy, scratch, vip]) => {
    ;(window as any).__stores = {
      app: app.useApp,
      wallet: wallet.useWallet,
      progress: progress.useProgress,
      slots: slots.useSlots,
      roulette: roulette.useRoulette,
      cashier: cashier.useCashier,
      overlay: overlay.useOverlay,
      jackpot: jackpot.useJackpot,
      cosmetics: cosmetics.useCosmetics,
      diamonds: diamonds.useDiamonds,
      piggy: piggy.usePiggyBank,
      scratch: scratch.useScratch,
      vip: vip.useVip,
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
