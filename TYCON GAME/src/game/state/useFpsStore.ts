/**
 * CITY EMPIRE — FPS store.
 *
 * Tiny piece of state so the HUD can show a live frame-rate readout while we
 * tune performance. Updated a few times per second, never per-frame, so the
 * measurement itself doesn't cost anything.
 */

import { create } from 'zustand';

interface FpsState {
  fps: number;
  setFps: (fps: number) => void;
}

export const useFpsStore = create<FpsState>((set) => ({
  fps: 0,
  setFps: (fps) => set({ fps }),
}));
