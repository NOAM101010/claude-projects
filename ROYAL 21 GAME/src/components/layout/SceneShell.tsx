import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { sceneIn } from '@/lib/motion';
import { HUD } from './HUD';
import { SideNav } from './SideNav';
import { BackButton } from './BackButton';
import { Particles } from '@/components/effects/Particles';

interface Props {
  children: ReactNode;
  /** Hide the HUD during cinematic scenes. */
  bare?: boolean;
  compactHud?: boolean;
  particles?: boolean;
  /** Scenes that lay out their own full-bleed world (the hub) opt out of the rail gutter. */
  flush?: boolean;
  className?: string;
}

/**
 * Every scene sits in the same shell so moving between them reads as a camera
 * move inside one place, not a page load. The shell also owns the two controls
 * that must exist everywhere: the side menu and the way back to the hub.
 */
export function SceneShell({ children, bare, compactHud, particles = true, flush, className = '' }: Props) {
  return (
    <motion.div
      className={`relative min-h-[100dvh] vignette ${className}`}
      variants={sceneIn}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {particles && <Particles />}
      {!bare && <HUD compact={compactHud} />}
      {!bare && <SideNav />}
      {!bare && <BackButton />}
      <div
        className="relative z-10"
        style={bare || flush ? undefined : { paddingBottom: 'calc(64px + var(--safe-b))' }}
      >
        <div className={bare || flush ? '' : 'md:ps-[78px]'}>{children}</div>
      </div>
    </motion.div>
  );
}
