/**
 * CITY EMPIRE — Global configuration & tuning constants.
 *
 * Central place for magic numbers so gameplay classes stay clean
 * (MASTER §69: avoid magic numbers scattered across the code).
 */

export const GAME = {
  version: '0.1.0',
  phase: 'PHASE 0/1 — Foundation + Player',
  saveVersion: 1,
} as const;

/** Player movement tuning (world units = meters). */
export const PLAYER = {
  walkSpeed: 3.2,
  sprintSpeed: 6.4,
  rotationLerp: 0.18, // how fast the body turns to face movement direction
  jumpSpeed: 6.0,
  gravity: -18.0,
  radius: 0.35,
  height: 1.8,
  spawn: [0, 0, 6] as [number, number, number],
} as const;

/** Third-person follow camera. */
export const CAMERA = {
  distance: 7,
  height: 3.4,
  lookHeight: 1.2,
  followLerp: 0.12,
  minPitch: -0.15,
  maxPitch: 0.9,
  orbitSensitivity: 0.0032,
} as const;

/** Interaction system. */
export const INTERACTION = {
  /** Max distance (meters) at which a prompt can appear. */
  range: 2.6,
  /** Key used to trigger the focused interactable. */
  key: 'KeyE',
} as const;

/** Starting economy values (MASTER §5: player begins weak). */
export const ECONOMY = {
  startingCash: 500,
  startingBank: 0,
} as const;
