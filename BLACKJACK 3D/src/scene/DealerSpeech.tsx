import { useGame } from '../state/useGame'
import { DEALER_LINES } from '../i18n/he'
import ScorePlaque from './ScorePlaque'

/** Speech plate above the dealer, driven by round events. */
export default function DealerSpeech({ position }: { position: [number, number, number] }) {
  const line = useGame(s => s.dealerLine)
  if (!line) return null

  const text = DEALER_LINES[line]
  if (!text) return null

  return <ScorePlaque label={text} position={position} tone="dealer" height={0.048} />
}
