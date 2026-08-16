import { useCallback } from 'react';
import { audio, type Sfx } from '@/audio/AudioManager';
import { haptic } from '@/lib/haptics';

/** Input -> feedback -> animation -> sound is one call site, not three. */
export function useSound() {
  const play = useCallback((name: Sfx, withHaptic?: 'tap' | 'chip' | 'card' | 'land' | 'win') => {
    audio.play(name);
    if (withHaptic) haptic(withHaptic);
  }, []);
  return { play, audio };
}
