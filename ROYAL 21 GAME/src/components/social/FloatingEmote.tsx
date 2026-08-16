import { AnimatePresence, motion, type Variants } from 'framer-motion';

/** Each emote has its own entrance (§45): the crown drops, fire bursts, the skull falls apart. */
const VARIANTS: Record<string, Variants> = {
  crown: {
    hidden: { y: -80, opacity: 0, rotate: -20 },
    show: { y: 0, opacity: [0, 1, 1, 0], rotate: 0, transition: { duration: 2.2 } },
  },
  fire: {
    hidden: { scale: 0, opacity: 0, y: 0 },
    show: { scale: [0, 1.4, 1, 0.9], opacity: [0, 1, 1, 0], y: [-4, -18], transition: { duration: 2 } },
  },
  laugh: {
    hidden: { y: 0, opacity: 0, rotate: 0 },
    show: { y: [0, -16, -6, -22], opacity: [0, 1, 1, 0], rotate: [0, -12, 12, 0], transition: { duration: 2.2 } },
  },
  skull: {
    hidden: { scale: 0.6, opacity: 0, y: 0, rotate: 0 },
    show: { scale: [0.6, 1.2, 1], opacity: [0, 1, 1, 0], y: [0, -10, 14], rotate: [0, 0, 22], transition: { duration: 2.3 } },
  },
  base: {
    hidden: { y: 10, opacity: 0, scale: 0.6 },
    show: { y: -26, opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1], transition: { duration: 2 } },
  },
};

const BY_EMOTE: Record<string, string> = {
  '👑': 'crown', '🔥': 'fire', '😂': 'laugh', '💀': 'skull',
};

export function FloatingEmote({ emote, message }: { emote?: string; message?: string }) {
  const variant = VARIANTS[(emote && BY_EMOTE[emote]) || 'base'];
  return (
    <AnimatePresence>
      {(emote || message) && (
        <motion.div
          className="absolute -top-9 start-1/2 -translate-x-1/2 pointer-events-none z-20 whitespace-nowrap"
          variants={variant}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0 }}
        >
          {emote ? (
            <span className="text-[30px]">{emote}</span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[12px] font-bold glass">{message}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
