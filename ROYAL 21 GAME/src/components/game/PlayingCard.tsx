import { motion } from 'framer-motion';
import type { Card } from '@/games/blackjack/types';

const PIPS: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

interface Props {
  card?: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Index in the hand, used to stagger the deal. */
  index?: number;
  /** Skins currently equipped by the seat owner — cosmetics are visible to all. */
  face?: string;
  back?: string;
  fresh?: boolean;
}

const dims = {
  sm: { w: 44, h: 63, rank: 12, pip: 15 },
  md: { w: 62, h: 89, rank: 16, pip: 21 },
  lg: { w: 74, h: 106, rank: 19, pip: 25 },
};

/**
 * A card leaves the shoe, travels, rotates a little, lands. The flip is a real
 * 3D rotation of one element, not two crossfading images.
 */
export function PlayingCard({
  card, faceDown, size = 'md', index = 0, face = 'cf-classic', back = 'bk-crimson', fresh = true,
}: Props) {
  const d = dims[size];
  const red = card ? card.s === 'H' || card.s === 'D' : false;
  return (
    <motion.div
      className={`pc ${face}`}
      style={{ width: d.w, height: d.h }}
      initial={fresh ? { x: 120, y: -180, rotate: -22, opacity: 0, scale: 0.9 } : false}
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1, rotateY: faceDown ? 180 : 0 }}
      transition={{
        type: 'spring', stiffness: 140, damping: 18, delay: fresh ? index * 0.11 : 0,
        rotateY: { duration: 0.5, ease: [0.2, 0.8, 0.25, 1] },
      }}
    >
      <div className={`pc-face ${red ? 'pc-red' : ''}`}>
        <div className="pc-rank" style={{ fontSize: d.rank }}>
          {card?.r}
          <div style={{ fontSize: d.rank * 0.75 }}>{card ? PIPS[card.s] : ''}</div>
        </div>
        <div className="pc-pip" style={{ fontSize: d.pip }}>{card ? PIPS[card.s] : ''}</div>
        <div className="pc-rank pc-foot" style={{ fontSize: d.rank * 0.7 }}>
          {card?.r} {card ? PIPS[card.s] : ''}
        </div>
      </div>
      <div className={`pc-back ${back}`} />
    </motion.div>
  );
}
