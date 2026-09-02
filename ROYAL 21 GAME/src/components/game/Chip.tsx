import { motion } from 'framer-motion';

export const CHIP_COLORS: Record<number, string> = {
  10: '#3a4f9e', 25: '#2e9e6b', 50: '#a8413e', 100: '#2b2f38',
  250: '#7b5bd6', 500: '#e3b23c', 1000: '#38b6c8',
  2500: '#c23a8e', 5000: '#15161a', 10000: '#e8e3d4',
  // VIP high-stakes chips.
  25000: '#6b4f1a',   // deep gold
  50000: '#0d0e12',   // obsidian
  100000: '#4a2d7a',  // royal purple
  250000: '#6e2e22',  // bronze-red
};

export const chipColor = (value: number) => {
  const steps = Object.keys(CHIP_COLORS).map(Number).sort((a, b) => b - a);
  return CHIP_COLORS[steps.find((step) => value >= step) ?? 10];
};

export const chipLabel = (value: number) => (value >= 1000 ? `${value / 1000}K` : String(value));

/** Only the 10K chip is a near-white face that needs dark ink; every other
 *  chip (including the dark VIP ones) reads best with white. */
export const chipInk = (value: number) => (chipColor(value) === CHIP_COLORS[10000] ? '#1a1206' : '#fff');

interface Props {
  value: number;
  size?: number;
  skin?: string;
  onClick?: () => void;
  disabled?: boolean;
  interactive?: boolean;
}

/** A physical chip, not a rectangular button (§56). */
export function Chip({ value, size = 52, skin = 'ck-classic', onClick, disabled, interactive }: Props) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <span className={skin} style={{ display: 'inline-block' }}>
      <Comp
        className="chip-obj"
        style={{
          width: size, height: size,
          fontSize: Math.max(9, size * 0.24),
          borderWidth: Math.max(2, size * 0.06),
          ['--chip-color' as string]: chipColor(value),
          color: chipInk(value),
          textShadow: chipInk(value) === '#1a1206'
            ? '0 1px 1px rgba(255,255,255,.4)'
            : '0 1px 2px rgba(0,0,0,.55)',
          opacity: disabled ? 0.35 : 1,
          cursor: onClick && !disabled ? 'pointer' : 'default',
        }}
        whileHover={interactive && !disabled ? { y: -7, scale: 1.06 } : undefined}
        whileTap={interactive && !disabled ? { y: -1, scale: 0.96 } : undefined}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={`${value}`}
      >
        {chipLabel(value)}
      </Comp>
    </span>
  );
}
