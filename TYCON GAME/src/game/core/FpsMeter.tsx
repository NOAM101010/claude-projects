/**
 * CITY EMPIRE — invisible FPS sampler.
 *
 * Counts frames and pushes an average to `useFpsStore` roughly 2x/sec.
 * Renders nothing; lives inside the Canvas so it shares the render loop.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFpsStore } from '../state/useFpsStore';

export function FpsMeter() {
  const frames = useRef(0);
  const acc = useRef(0);
  const setFps = useFpsStore((s) => s.setFps);

  useFrame((_, delta) => {
    frames.current += 1;
    acc.current += delta;
    if (acc.current >= 0.5) {
      setFps(Math.round(frames.current / acc.current));
      frames.current = 0;
      acc.current = 0;
    }
  });

  return null;
}
