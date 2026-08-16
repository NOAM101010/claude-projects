import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '@/hooks/useSound';
import { useIsCompact } from '@/hooks/useMediaQuery';

interface Props {
  /** Percentage position inside the room. */
  x: number;
  y: number;
  width: number;
  label: string;
  action: string;
  onEnter: () => void;
  children: (focused: boolean) => ReactNode;
  hoverSound?: 'card' | 'chip' | 'coin' | 'vault' | 'notify' | 'scratch';
  z?: number;
  glow?: string;
}

/**
 * A thing in the room, not a menu entry.
 * Desktop: hover lights it and shows what it does, click enters.
 * Touch: first tap focuses it, second tap enters (§119).
 */
export function HubObject({
  x, y, width, label, action, onEnter, children, hoverSound = 'card', z = 1, glow = 'rgba(227,178,60,.28)',
}: Props) {
  const [focused, setFocused] = useState(false);
  const { play } = useSound();
  const compact = useIsCompact();

  const focus = () => {
    if (focused) return;
    setFocused(true);
    play(hoverSound);
  };

  return (
    <motion.div
      className="absolute"
      style={{
        insetInlineStart: `${x}%`, top: `${y}%`, width: `${width}%`,
        transform: 'translate(-50%, -50%)', zIndex: focused ? 20 : z, cursor: 'pointer',
      }}
      initial={{ opacity: 0, y: 26, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: focused ? 1.045 : 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      onHoverStart={() => !compact && focus()}
      onHoverEnd={() => !compact && setFocused(false)}
      onClick={() => {
        if (compact && !focused) { focus(); return; }
        play('click', 'tap');
        onEnter();
      }}
      role="button"
      tabIndex={0}
      aria-label={`${label} — ${action}`}
      onFocus={focus}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onEnter(); }}
    >
      {/* the light pool under the object strengthens on focus */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          insetInlineStart: '50%', top: '62%', width: '150%', height: '68%',
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          background: `radial-gradient(ellipse, ${glow}, transparent 68%)`,
          filter: 'blur(26px)',
        }}
        animate={{ opacity: focused ? 1 : 0.42, scale: focused ? 1.12 : 1 }}
        transition={{ duration: 0.35 }}
      />
      <div className="relative">{children(focused)}</div>

      <AnimatePresence>
        {focused && (
          <motion.div
            className="absolute start-1/2 -translate-x-1/2 whitespace-nowrap text-center pointer-events-none"
            style={{ top: '100%', marginTop: 6 }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <div className="eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
            <div
              className="mt-1 px-3 py-1.5 rounded-full text-[12.5px] font-bold glass"
              style={{ borderColor: 'var(--gold-line)', color: 'var(--gold-hi)' }}
            >
              {action}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
