/**
 * CITY EMPIRE — Interaction store (Zustand).
 *
 * ONE reusable interaction framework (MASTER §16). Interactables register
 * themselves with a world position + prompt + action. Each frame the player
 * controller reports its position; we resolve the single closest in-range
 * interactable and expose it as `focused` so the HUD can show a prompt.
 *
 * Objects never implement their own bespoke interaction code — they just
 * register/unregister here.
 */

import { create } from 'zustand';
import { INTERACTION } from '../core/config';
import { log } from '../core/log';

export interface Interactable {
  id: string;
  /** Short verb shown in the prompt, e.g. "Enter", "Talk", "Buy". */
  verb: string;
  /** Object label, e.g. "Small Cafe". */
  label: string;
  /** Live world position [x,y,z]; read fresh each resolve. */
  getPosition: () => [number, number, number];
  /** Optional per-object range override (meters). */
  range?: number;
  /** Called when the player triggers the interaction. */
  onInteract: () => void;
  /** Optional gate — return false to hide the prompt (e.g. already owned). */
  isAvailable?: () => boolean;
}

interface InteractionState {
  registry: Map<string, Interactable>;
  /** The currently focused (closest in-range) interactable, or null. */
  focused: Interactable | null;

  register: (item: Interactable) => () => void;
  /** Resolve the closest in-range interactable to the given player position. */
  resolveFocus: (playerPos: [number, number, number]) => void;
  /** Trigger the focused interactable's action, if any. */
  triggerFocused: () => void;
}

function dist2(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2]; // ground-plane distance (ignore Y)
  return dx * dx + dz * dz;
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  registry: new Map(),
  focused: null,

  register: (item) => {
    get().registry.set(item.id, item);
    log('Interaction', `Registered "${item.label}" (${item.id})`);
    return () => {
      get().registry.delete(item.id);
      if (get().focused?.id === item.id) set({ focused: null });
    };
  },

  resolveFocus: (playerPos) => {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const item of get().registry.values()) {
      if (item.isAvailable && !item.isAvailable()) continue;
      const range = item.range ?? INTERACTION.range;
      const d = dist2(playerPos, item.getPosition());
      if (d <= range * range && d < bestD) {
        bestD = d;
        best = item;
      }
    }
    // Avoid needless re-renders: only update when the focused id changes.
    if (best?.id !== get().focused?.id) {
      set({ focused: best });
    }
  },

  triggerFocused: () => {
    const focused = get().focused;
    if (!focused) return;
    if (focused.isAvailable && !focused.isAvailable()) return;
    log('Interaction', `Triggered "${focused.label}" → ${focused.verb}`);
    focused.onInteract();
  },
}));
