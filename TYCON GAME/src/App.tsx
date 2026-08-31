/**
 * CITY EMPIRE — App shell.
 *
 * A minimal cinematic entry screen (MASTER §41) in front of the live game.
 * "New Game" drops the player into the starter slice of the European
 * District. Save/Load, Settings and Continue are wired in later phases.
 */

import { useState } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { HUD } from './ui/HUD';
import { GAME } from './game/core/config';
import './styles/menu.css';

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className="app-root">
      {started ? (
        <>
          <GameCanvas />
          <HUD />
        </>
      ) : (
        <StartScreen onStart={() => setStarted(true)} />
      )}
    </div>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="menu">
      <div className="menu-bg" />
      <div className="menu-content">
        <h1 className="menu-title">CITY EMPIRE</h1>
        <p className="menu-tagline">Build the world. Build the business. Build the empire.</p>

        <div className="menu-actions">
          <button className="menu-btn menu-btn--primary" onClick={onStart}>
            New Game
          </button>
          <button className="menu-btn" disabled title="Coming with the Save phase">
            Continue
          </button>
          <button className="menu-btn" disabled title="Coming soon">
            Settings
          </button>
        </div>

        <p className="menu-foot">
          Foundation build · v{GAME.version} · {GAME.phase}
        </p>
      </div>
    </div>
  );
}
