import { motion } from 'framer-motion';

type Mood = 'idle' | 'shuffle' | 'deal' | 'flip' | 'win' | 'lose' | 'blackjack' | 'bust';

const SKINS: Record<string, { coat: string; tie: string; skin: string; hair: string }> = {
  'dl-house': { coat: '#20242e', tie: '#a8413e', skin: '#e0ab7f', hair: '#241a12' },
  'dl-noir': { coat: '#14161b', tie: '#8b8f98', skin: '#c78d5e', hair: '#1b1b1f' },
  'dl-royal': { coat: '#2c1d4a', tie: '#e3b23c', skin: '#f0c9a6', hair: '#4a3423' },
};

/**
 * A 2.5D dealer with real states. Chosen over a rushed 3D model on purpose
 * (§129): stylised and alive beats low-quality and stiff.
 */
export function Dealer({ mood = 'idle', skin = 'dl-house', size = 92, lookAt = 0 }: {
  mood?: Mood; skin?: string; size?: number; lookAt?: number;
}) {
  const c = SKINS[skin] ?? SKINS['dl-house'];
  const eyeShift = Math.max(-2.2, Math.min(2.2, lookAt * 2.2));

  const body = {
    idle: { rotate: [0, 0.8, 0, -0.8, 0], y: [0, -1.5, 0] },
    shuffle: { rotate: [0, -2, 2, 0], y: [0, -2, 0] },
    deal: { rotate: [0, -4, 0], x: [0, -3, 0] },
    flip: { rotate: [0, 3, 0] },
    win: { y: [0, -4, 0], rotate: [0, 2, -2, 0] },
    lose: { y: [0, 2, 0] },
    blackjack: { y: [0, -6, 0], rotate: [0, -3, 3, 0] },
    bust: { rotate: [0, -1.5, 1.5, 0] },
  }[mood];

  const duration = mood === 'idle' ? 6 : mood === 'shuffle' ? 1.1 : 0.7;

  return (
    <motion.svg
      viewBox="0 0 100 100" width={size} height={size}
      animate={body}
      transition={{ duration, repeat: mood === 'idle' || mood === 'shuffle' ? Infinity : 0, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {/* light pool behind the dealer */}
      <ellipse cx="50" cy="52" rx="42" ry="40" fill="rgba(227,178,60,.07)" />
      {/* shoulders + coat */}
      <path d="M14 100c0-22 16-32 36-32s36 10 36 32z" fill={c.coat} />
      <path d="M42 70l8 14 8-14-8-5z" fill="#f3efe6" opacity=".9" />
      <path d="M48 72l2 12 2-12z" fill={c.tie} />
      {/* head */}
      <ellipse cx="50" cy="42" rx="17" ry="19" fill={c.skin} />
      <path d="M33 40c0-13 34-13 34 0 0-6-4-15-17-15S33 34 33 40z" fill={c.hair} />
      {/* eyes follow the active player (§51) */}
      <motion.g animate={{ x: eyeShift }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
        <ellipse cx="43" cy="42" rx="2" ry="2.4" fill="#20232b" />
        <ellipse cx="57" cy="42" rx="2" ry="2.4" fill="#20232b" />
      </motion.g>
      {/* mouth reacts to the outcome */}
      <path
        d={
          mood === 'win' || mood === 'blackjack' ? 'M44 51q6 5 12 0'
            : mood === 'lose' || mood === 'bust' ? 'M44 53q6-5 12 0'
              : 'M45 52h10'
        }
        stroke="#20232b" strokeWidth="1.6" fill="none" strokeLinecap="round"
      />
      {/* hands: shuffling and dealing move them */}
      <motion.g
        animate={
          mood === 'shuffle' ? { x: [-2, 2, -2], rotate: [-4, 4, -4] }
            : mood === 'deal' ? { x: [0, 12, 0], y: [0, -6, 0] }
              : { x: 0, y: 0 }
        }
        transition={{ duration: mood === 'shuffle' ? 0.9 : 0.6, repeat: mood === 'shuffle' ? Infinity : 0 }}
      >
        <rect x="28" y="80" width="14" height="9" rx="4" fill={c.skin} />
        <rect x="58" y="80" width="14" height="9" rx="4" fill={c.skin} />
      </motion.g>
    </motion.svg>
  );
}
