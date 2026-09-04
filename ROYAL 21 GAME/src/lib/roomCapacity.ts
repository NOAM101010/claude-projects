import type { GameKey } from '@/types';

/**
 * Single source for "how many seats does this game's table have" — used
 * anywhere the UI shows "X/Y players". Mirrors each game's own `MAX_SEATS`
 * constant (`src/games/<game>/{types,engine}.ts`) plus the room-level cap
 * enforced server-side by `enforce_room_capacity` (blackjack/duel rooms,
 * hard-coded to 4 there — do not change that trigger from here).
 */
const CAPACITY: Partial<Record<GameKey, number>> = {
  poker: 6,
  sng: 6,
  roulette: 5,
  coinflip: 5,
  highcard: 5,
  blackjack: 4,
  duel: 4,
};

export function roomCapacity(game: GameKey): number {
  return CAPACITY[game] ?? 4;
}
