/**
 * CITY EMPIRE — HUD (MASTER §42: minimal, premium, dark).
 *
 * Reads gameplay state from the stores and renders a lean overlay: cash,
 * the focused interaction prompt, transient notifications, and a controls
 * hint. The HUD is display-only — it never mutates gameplay (MASTER §8).
 */

import { GAME } from '../game/core/config';
import { INTERACTION } from '../game/core/config';
import { usePlayerStore } from '../game/state/usePlayerStore';
import { useInteractionStore } from '../game/interaction/useInteractionStore';
import { useNotifications } from '../game/state/useNotifications';
import { useFpsStore } from '../game/state/useFpsStore';

function formatMoney(n: number) {
  return '€' + n.toLocaleString('en-US');
}

export function HUD() {
  const cash = usePlayerStore((s) => s.cash);
  const focused = useInteractionStore((s) => s.focused);
  const notices = useNotifications((s) => s.notices);
  const fps = useFpsStore((s) => s.fps);

  return (
    <div className="hud">
      {/* Top-left brand */}
      <div className="hud-brand">
        <span className="hud-brand-name">CITY EMPIRE</span>
        <span className="hud-brand-ver">v{GAME.version}</span>
        <span className={`hud-fps ${fps > 0 && fps < 45 ? 'hud-fps--low' : ''}`}>{fps || '--'} FPS</span>
      </div>

      {/* Top-right cash */}
      <div className="hud-cash">
        <span className="hud-cash-label">CASH</span>
        <span className="hud-cash-value">{formatMoney(cash)}</span>
      </div>

      {/* Notifications */}
      <div className="hud-notices">
        {notices.map((n) => (
          <div key={n.id} className={`hud-notice hud-notice--${n.kind}`}>
            {n.text}
          </div>
        ))}
      </div>

      {/* Interaction prompt */}
      {focused && (
        <div className="hud-prompt">
          <kbd>{INTERACTION.key.replace('Key', '')}</kbd>
          <span className="hud-prompt-verb">{focused.verb}</span>
          <span className="hud-prompt-label">{focused.label}</span>
        </div>
      )}

      {/* Controls hint */}
      <div className="hud-hint">
        <b>WASD</b> move · <b>Shift</b> sprint · <b>Space</b> jump · <b>Mouse</b> look · <b>E</b> interact
      </div>
    </div>
  );
}
