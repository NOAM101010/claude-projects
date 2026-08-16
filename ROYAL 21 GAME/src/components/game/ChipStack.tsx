import { motion } from 'framer-motion';
import { chipColor } from './Chip';

const DENOMS = [1000, 500, 250, 100, 50, 25, 10];

/** Breaks an amount into real chips and stacks them with a little human wobble. */
export function ChipStack({ amount, size = 30, skin = 'ck-classic', max = 12 }: {
  amount: number; size?: number; skin?: string; max?: number;
}) {
  const chips: number[] = [];
  let left = amount;
  for (const denom of DENOMS) {
    while (left >= denom && chips.length < max) {
      chips.push(denom);
      left -= denom;
    }
  }
  return (
    <div className={skin} style={{ position: 'relative', width: size, height: size + chips.length * 4 }}>
      {chips.map((denom, index) => (
        <motion.div
          key={index}
          className="chip-obj"
          initial={{ y: -40, opacity: 0, rotate: -20 }}
          animate={{ y: 0, opacity: 1, rotate: (index % 3) - 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26, delay: index * 0.03 }}
          style={{
            position: 'absolute',
            bottom: index * 4,
            width: size, height: size,
            fontSize: size * 0.26,
            borderWidth: 2,
            ['--chip-color' as string]: chipColor(denom),
          }}
        />
      ))}
    </div>
  );
}
