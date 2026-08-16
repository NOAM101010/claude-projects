import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { panelIn } from '@/lib/motion';

interface Props extends HTMLMotionProps<'div'> {
  children: ReactNode;
  gold?: boolean;
  /** Panels animate out of the world by default; turn off for static chrome. */
  animate?: boolean;
  className?: string;
}

/** The one window material in the game: dark glass with a hairline edge. */
export const GlassPanel = forwardRef<HTMLDivElement, Props>(function GlassPanel(
  { children, gold, animate = true, className = '', ...rest },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={`glass ${gold ? 'glass-gold' : ''} ${className}`}
      variants={animate ? panelIn : undefined}
      initial={animate ? 'hidden' : undefined}
      animate={animate ? 'show' : undefined}
      exit={animate ? 'exit' : undefined}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
