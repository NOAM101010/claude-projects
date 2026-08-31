/**
 * CITY EMPIRE — Development logging (MASTER §67).
 *
 * Tagged, throttled logging that is easy to grep and that we can
 * strip in production builds. Never spam per-frame (§67).
 */

const ENABLED = import.meta.env.DEV;

export type LogChannel =
  | 'Core'
  | 'Player'
  | 'Interaction'
  | 'Economy'
  | 'World'
  | 'Save';

export function log(channel: LogChannel, message: string, ...data: unknown[]) {
  if (!ENABLED) return;
  // eslint-disable-next-line no-console
  console.log(`%c[${channel}]`, 'color:#7dd3fc;font-weight:600', message, ...data);
}

export function warn(channel: LogChannel, message: string, ...data: unknown[]) {
  if (!ENABLED) return;
  // eslint-disable-next-line no-console
  console.warn(`[${channel}] ${message}`, ...data);
}
