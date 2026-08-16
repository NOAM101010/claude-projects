import type { Transition, Variants } from 'framer-motion';

/** Shared animation presets. Mirrors the duration/easing tokens in tokens.css. */
export const easeOut = [0.2, 0.8, 0.25, 1] as const;
export const easeInOut = [0.6, 0, 0.35, 1] as const;

export const uiFast: Transition = { duration: 0.14, ease: easeOut };
export const uiNormal: Transition = { duration: 0.24, ease: easeOut };
export const uiSlow: Transition = { duration: 0.42, ease: easeOut };
export const cinematic: Transition = { duration: 0.9, ease: easeInOut };
export const bounce: Transition = { type: 'spring', stiffness: 420, damping: 26 };
export const hero: Transition = { type: 'spring', stiffness: 220, damping: 18 };

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: uiNormal },
  exit: { opacity: 0, transition: uiFast },
};

/** Panels grow out of the world rather than sliding in from nowhere. */
export const panelIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 18, filter: 'blur(6px)' },
  show: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: uiSlow },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: uiFast },
};

/** Scene changes read as camera moves, not route cuts. */
export const sceneIn: Variants = {
  hidden: { opacity: 0, scale: 1.06 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: easeOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.32, ease: easeInOut } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: uiSlow },
  exit: { opacity: 0, y: 12, transition: uiFast },
};

/** Staggered list entrance for friends, items, seats. */
export const stagger = (gap = 0.05): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
});

export const heroReveal: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: { opacity: 1, scale: 1, transition: hero },
  exit: { opacity: 0, scale: 1.1, transition: uiNormal },
};
