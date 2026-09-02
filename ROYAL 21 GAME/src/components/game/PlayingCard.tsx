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
  /** When set, the card is tappable (baccarat "squeeze" reveal). */
  onClick?: () => void;
  /** Ring the card in gold — it's the next one to turn over. */
  highlight?: boolean;
}

const dims = {
  sm: { w: 44, h: 63, rank: 12, pip: 15 },
  md: { w: 62, h: 89, rank: 16, pip: 21 },
  lg: { w: 74, h: 106, rank: 19, pip: 25 },
};

/**
 * A card travels in already showing its back if it's dealt face-down; turning it
 * over is a separate 3D rotation triggered later by `faceDown` going false — not
 * a spin folded into the deal. `transformPerspective` is what makes the flip
 * read as a flip and not a mirrored squash (the bug this replaces).
 */
export function PlayingCard({
  card, faceDown, size = 'md', index = 0, face = 'cf-classic', back = 'bk-crimson',
  fresh = true, onClick, highlight,
}: Props) {
  const d = dims[size];
  const red = card ? card.s === 'H' || card.s === 'D' : false;
  return (
    <motion.div
      className={`pc ${face} ${highlight ? 'pc-next' : ''}`}
      onClick={onClick}
      style={{ width: d.w, height: d.h, cursor: onClick ? 'pointer' : undefined, transformPerspective: 900 }}
      initial={
        fresh
          ? { x: 110, y: -160, rotate: -20, opacity: 0, scale: 0.9, rotateY: faceDown ? 180 : 0 }
          : false
      }
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1, rotateY: faceDown ? 180 : 0 }}
      transition={{
        default: { type: 'spring', stiffness: 150, damping: 18, delay: fresh ? index * 0.09 : 0 },
        rotateY: { duration: 0.46, ease: [0.2, 0.8, 0.25, 1] },
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
