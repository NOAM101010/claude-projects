/**
 * CITY EMPIRE — Player store (Zustand).
 *
 * Holds persistent player state that the UI reads: cash, bank, and a
 * low-frequency snapshot of the player's world position (for HUD / save).
 * High-frequency transform lives in refs inside the Player component —
 * we never push per-frame updates through the store (perf, MASTER §49).
 *
 * All money changes route through the economy service later (MASTER §24);
 * for the foundation we expose guarded primitives here.
 */

import { create } from 'zustand';
import { ECONOMY } from '../core/config';
import { log } from '../core/log';

export interface PlayerState {
  cash: number;
  bank: number;
  /** Snapshot position, refreshed a few times per second (not every frame). */
  position: [number, number, number];

  addCash: (amount: number) => void;
  spendCash: (amount: number) => boolean;
  setPositionSnapshot: (pos: [number, number, number]) => void;
  resetPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  cash: ECONOMY.startingCash,
  bank: ECONOMY.startingBank,
  position: [0, 0, 0],

  addCash: (amount) => {
    if (amount <= 0) return;
    set((s) => ({ cash: s.cash + amount }));
    log('Economy', `+${amount} cash (balance ${get().cash})`);
  },

  /** Returns false and changes nothing if the player can't afford it. */
  spendCash: (amount) => {
    if (amount <= 0) return true;
    const { cash } = get();
    if (cash < amount) {
      log('Economy', `Purchase blocked: need ${amount}, have ${cash}`);
      return false;
    }
    set({ cash: cash - amount });
    log('Economy', `-${amount} cash (balance ${get().cash})`);
    return true;
  },

  setPositionSnapshot: (position) => set({ position }),

  resetPlayer: () =>
    set({
      cash: ECONOMY.startingCash,
      bank: ECONOMY.startingBank,
      position: [0, 0, 0],
    }),
}));
