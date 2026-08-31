import { Hand } from '../engine/types'
import { isBlackjack, scoreHand } from '../engine/hand'
import Card3D from './Card3D'
import ScorePlaque, { PlaqueTone } from './ScorePlaque'
import { LAYOUT } from './TableMetrics'
import { handX } from './tableLayout'

interface Props {
  hand: Hand
  slot: number
  slotCount: number
  active: boolean
  restY: number
}

const SPREAD = 0.05

export default function HandArea({ hand, slot, slotCount, active, restY }: Props) {
  const baseX = handX(slot, slotCount)
  const baseZ = LAYOUT.playerCardsZ

  const { total, soft } = scoreHand(hand.cards)
  const bust = total > 21
  const bj = isBlackjack(hand)

  const label =
    hand.cards.length === 0 ? ''
      : bj ? "בלאק ג'ק"
      : bust ? `${total} נשרף`
      : soft ? `${total - 10}/${total}`
      : `${total}`

  const tone: PlaqueTone = bust ? 'bust' : bj ? 'blackjack' : active ? 'active' : 'idle'

  return (
    <group>
      {hand.cards.map((c, i) => (
        <Card3D
          key={c.id}
          card={c}
          position={[baseX + i * SPREAD - ((hand.cards.length - 1) * SPREAD) / 2, restY + i * 0.0011, baseZ - i * 0.012]}
          tilt={(i - (hand.cards.length - 1) / 2) * 0.05}
          delay={i * 0.13}
        />
      ))}

      <ScorePlaque
        label={label}
        position={[baseX, restY + 0.105, baseZ - 0.06]}
        tone={tone}
      />

      {active && slotCount > 1 && (
        <mesh position={[baseX, restY - 0.0012, baseZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.085, 0.092, 40]} />
          <meshBasicMaterial color="#ffd964" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  )
}
