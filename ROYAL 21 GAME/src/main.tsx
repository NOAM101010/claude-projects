import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import './styles/game.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

/**
 * Fade the pre-React veil once the first frame is on screen.
 *
 * `requestAnimationFrame` does not fire while the tab is hidden, and the veil
 * is an opaque, click-eating layer at z-index 9999. Opening the game in a
 * background tab — which is what happens to every invite link — therefore left
 * a black screen that swallowed the first tap, and with it the gesture the
 * AudioContext needs to start. So rAF is only the fast path: a timer clears it
 * regardless, and becoming visible clears it immediately.
 */
function liftBootVeil() {
  const veil = document.getElementById('boot-veil');
  if (!veil || veil.classList.contains('gone')) return;
  veil.classList.add('gone');
  setTimeout(() => veil.remove(), 600);
}

requestAnimationFrame(liftBootVeil);
setTimeout(liftBootVeil, 1200);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) liftBootVeil();
});
