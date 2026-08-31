import { Card } from '../engine/types'
import { scoreHand } from '../engine/hand'
import Card3D from './Card3D'
import ScorePlaque, { PlaqueTone } from './ScorePlaque'
import { LAYOUT } from './TableMetrics'

const SPREAD = 0.05

export default function DealerArea({ cards, restY }: { cards: Card[]; restY: number }) {
  const baseZ = LAYOUT.dealerCardsZ
  const baseX = -((cards.length - 1) * SPREAD) / 2

  const revealed = cards.filter(c => c.faceUp)
  const allUp = cards.length > 0 && revealed.length === cards.length
  const shown = allUp ? cards : revealed
  const { total, soft } = scoreHand(shown)
  const bust = allUp && total > 21

  // While the hole card is down only the upcard counts, and showing an ace as
  // "1/11 + ?" is noise — the visible card's best value plus a marker is clearer.
  const label =
    cards.length === 0 ? ''
      : !allUp ? `${total} + ?`
      : bust ? `${total} נשרף`
      : soft ? `${total - 10}/${total}`
      : `${total}`

  const tone: PlaqueTone = bust ? 'bust' : 'dealer'

  return (
    <group>
      {cards.map((c, i) => (
        <Card3D
          key={c.id}
          card={c}
          position={[baseX + i * SPREAD, restY + i * 0.0011, baseZ - i * 0.01]}
          delay={i * 0.13}
        />
      ))}
      <ScorePlaque
        label={label}
        position={[0, restY + 0.125, baseZ - 0.02]}
        tone={tone}
        height={0.058}
      />
    </group>
  )
}
