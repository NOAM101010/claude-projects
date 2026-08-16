type Pattern = 'tap' | 'chip' | 'card' | 'land' | 'win';

const patterns: Record<Pattern, number | number[]> = {
  tap: 8,
  chip: 12,
  card: [0, 6],
  land: [0, 14, 40, 10],
  win: [0, 18, 60, 24],
};

let enabled = true;
export const setHaptics = (on: boolean) => {
  enabled = on;
};

/** Gentle only. Silently no-ops where unsupported. */
export function haptic(kind: Pattern) {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(patterns[kind]);
  } catch {
    /* ignore */
  }
}
