/**
 * Room backgrounds for "My Room" — purchased in the vault, equipped like any
 * other cosmetic. Every id here must have a matching item in items.ts with a
 * `payload: { roomBackground: id }`, except the default which nobody buys.
 */
export interface RoomBackground {
  gradient: string;
  glowColor: string;
}

export const DEFAULT_ROOM_BACKGROUND = 'rb-default';

export const ROOM_BACKGROUNDS: Record<string, RoomBackground> = {
  'rb-default': {
    gradient: 'radial-gradient(ellipse at 50% 0%, #1b1a24, #0d0d12 55%, #08090b 88%)',
    glowColor: 'rgba(227,178,60,.13)',
  },
  'rb-emerald': {
    gradient: 'radial-gradient(ellipse at 50% 0%, #123324, #0a1712 55%, #08090b 88%)',
    glowColor: 'rgba(74,211,154,.16)',
  },
  'rb-crimson': {
    gradient: 'radial-gradient(ellipse at 50% 0%, #331515, #170a0a 55%, #08090b 88%)',
    glowColor: 'rgba(211,74,74,.16)',
  },
  'rb-midnight': {
    gradient: 'radial-gradient(ellipse at 50% 0%, #131a33, #0a0d17 55%, #08090b 88%)',
    glowColor: 'rgba(74,140,211,.16)',
  },
  'rb-gold': {
    gradient: 'radial-gradient(ellipse at 50% 0%, #332a12, #17130a 55%, #08090b 88%)',
    glowColor: 'rgba(227,178,60,.22)',
  },
};

export const roomBackgroundOf = (id: string | null) =>
  (id && ROOM_BACKGROUNDS[id]) || ROOM_BACKGROUNDS[DEFAULT_ROOM_BACKGROUND];

/** Max decor pieces displayed in the room at once — keeps the shelf readable. */
export const MAX_ROOM_DECOR = 4;
