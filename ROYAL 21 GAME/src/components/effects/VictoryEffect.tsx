import { motion } from 'framer-motion';

/** Equipped victory cosmetics actually play when you win (§95). */
export function VictoryEffect({ kind }: { kind: string | null }) {
  if (!kind) return null;

  if (kind === 'vc-coins') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute text-[22px]"
            style={{ left: `${6 + i * 6.6}%`, top: -30 }}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: '90vh', opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 1.6 + (i % 4) * 0.2, delay: i * 0.05, ease: 'easeIn' }}
          >
            🪙
          </motion.span>
        ))}
      </div>
    );
  }

  if (kind === 'vc-crown') {
    return (
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <motion.span
          className="text-[72px]"
          initial={{ y: -160, opacity: 0, rotate: -20 }}
          animate={{ y: 0, opacity: [0, 1, 1, 0], rotate: 0, scale: [0.6, 1.15, 1] }}
          transition={{ duration: 1.8, times: [0, 0.35, 0.75, 1] }}
        >
          👑
        </motion.span>
      </div>
    );
  }

  if (kind === 'vc-fireworks') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[{ x: 28, y: 34, c: '#ffd75e', d: 0 }, { x: 70, y: 26, c: '#ff7ab0', d: 0.25 }, { x: 50, y: 52, c: '#5ef2d6', d: 0.5 }].map((burst, b) => (
          <div key={b} className="absolute" style={{ left: `${burst.x}%`, top: `${burst.y}%` }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{ background: burst.c }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos((i / 14) * Math.PI * 2) * 90,
                  y: Math.sin((i / 14) * Math.PI * 2) * 90,
                  scale: [0, 1.4, 0], opacity: [1, 1, 0],
                }}
                transition={{ duration: 1.2, delay: burst.d + i * 0.01, repeat: 1, repeatDelay: 0.3 }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'vc-stars') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute"
            style={{ left: `${4 + i * 6}%`, bottom: -20, fontSize: 14 + (i % 3) * 6, color: 'var(--gold-hi)' }}
            initial={{ y: 40, opacity: 0, rotate: 0 }}
            animate={{ y: '-95vh', opacity: [0, 1, 1, 0], rotate: 220 }}
            transition={{ duration: 1.8 + (i % 4) * 0.25, delay: i * 0.06, ease: 'easeOut' }}
          >
            ✦
          </motion.span>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--gold-hi)' }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{
            x: Math.cos((i / 12) * Math.PI * 2) * 130,
            y: Math.sin((i / 12) * Math.PI * 2) * 130,
            scale: [0, 1.6, 0], opacity: [1, 1, 0],
          }}
          transition={{ duration: 1.1, delay: 0.05 * i }}
        />
      ))}
    </div>
  );
}
