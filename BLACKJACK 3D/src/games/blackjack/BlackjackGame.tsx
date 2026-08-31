import BlackjackScene from '../../scene/BlackjackScene'
import BettingBar from '../../ui/BettingBar'
import ActionBar from '../../ui/ActionBar'
import PhaseIndicator from '../../ui/PhaseIndicator'

/**
 * The blackjack table as one game within the casino. The shared HUD (balance,
 * level, settings, back-to-lobby) is provided by App; this owns only the scene
 * and the table's own controls.
 */
export default function BlackjackGame() {
  return (
    <div className="absolute inset-0">
      <BlackjackScene />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex justify-center pt-16">
          <div className="pointer-events-auto">
            <PhaseIndicator />
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-3">
          <ActionBar />
          <BettingBar />
        </div>
      </div>
    </div>
  )
}
