import { mulberry32 } from '@/lib/random';
import { MAX_MISSION_REWARD, MISSION_ALL_DONE_BONUS } from './economy';

/**
 * Rotating daily / weekly missions.
 *
 * Same discipline as `shopOffers.ts`: the lineup is a pure function of the date
 * key, so every client shows the same three missions today and the same big one
 * this week — no server call, no per-refresh randomness.
 *
 * Progress is tracked device-locally in `usePlayer.missionProgress` (rolls at
 * UTC midnight / week boundary). The *claim* is server-authoritative
 * (`claim_mission` RPC) with a guest mirror, exactly like achievements.
 */

export type MissionKind = 'quantity' | 'variety';

/** Which counter in `missionProgress` drives a mission's progress. Every one of
 *  these is derivable from a single `recordResult(game, outcome, net)` call. */
export type MissionMetric =
  | 'hands' | 'wins' | 'chipsWon'                 // quantity
  | 'gamesVariety'                                // distinct games played
  | 'blackjack' | 'roulette' | 'slots' | 'scratch' | 'coinflip' | 'highcard' | 'baccarat' | 'pokerAny';

export interface Mission {
  id: string;
  kind: MissionKind;
  metric: MissionMetric;
  goal: number;
  reward: number;
  name: { he: string; en: string };
}

/** The daily pool — 16 missions, rotated 3 at a time. */
export const MISSIONS: Mission[] = [
  // ---- quantity ----
  { id: 'hands10', kind: 'quantity', metric: 'hands', goal: 10, reward: 1000, name: { he: 'שחק 10 ידיים', en: 'Play 10 hands' } },
  { id: 'hands15', kind: 'quantity', metric: 'hands', goal: 15, reward: 1500, name: { he: 'שחק 15 ידיים', en: 'Play 15 hands' } },
  { id: 'hands20', kind: 'quantity', metric: 'hands', goal: 20, reward: 2000, name: { he: 'שחק 20 ידיים', en: 'Play 20 hands' } },
  { id: 'wins3', kind: 'quantity', metric: 'wins', goal: 3, reward: 1000, name: { he: 'זכה 3 פעמים', en: 'Win 3 times' } },
  { id: 'wins5', kind: 'quantity', metric: 'wins', goal: 5, reward: 1500, name: { he: 'זכה 5 פעמים', en: 'Win 5 times' } },
  { id: 'wins8', kind: 'quantity', metric: 'wins', goal: 8, reward: 2000, name: { he: 'זכה 8 פעמים', en: 'Win 8 times' } },
  { id: 'chips10k', kind: 'quantity', metric: 'chipsWon', goal: 10000, reward: 2000, name: { he: 'הרווח 10,000 צ׳יפים בסבבים', en: 'Win 10,000 chips in rounds' } },
  { id: 'chips20k', kind: 'quantity', metric: 'chipsWon', goal: 20000, reward: 3000, name: { he: 'הרווח 20,000 צ׳יפים בסבבים', en: 'Win 20,000 chips in rounds' } },
  // ---- variety ----
  { id: 'games3', kind: 'variety', metric: 'gamesVariety', goal: 3, reward: 2000, name: { he: 'שחק ב-3 משחקים שונים', en: 'Play 3 different games' } },
  { id: 'blackjack1', kind: 'variety', metric: 'blackjack', goal: 1, reward: 1000, name: { he: 'שחק בלאק׳ג׳ק', en: 'Play a hand of blackjack' } },
  { id: 'roulette1', kind: 'variety', metric: 'roulette', goal: 1, reward: 1000, name: { he: 'סובב את הרולטה', en: 'Spin the roulette wheel' } },
  { id: 'slots1', kind: 'variety', metric: 'slots', goal: 1, reward: 1000, name: { he: 'סובב מכונת מזל', en: 'Spin the slot machine' } },
  { id: 'scratch1', kind: 'variety', metric: 'scratch', goal: 1, reward: 1000, name: { he: 'פתח קלף גירוד', en: 'Scratch a card' } },
  { id: 'poker1', kind: 'variety', metric: 'pokerAny', goal: 1, reward: 1000, name: { he: 'שחק פוקר או טורניר', en: 'Play poker or a tournament' } },
  { id: 'coinflip1', kind: 'variety', metric: 'coinflip', goal: 1, reward: 1000, name: { he: 'הטל מטבע', en: 'Flip a coin' } },
  { id: 'highcard1', kind: 'variety', metric: 'highcard', goal: 1, reward: 1000, name: { he: 'שחק קלף גבוה', en: 'Play a round of High Card' } },
  { id: 'baccarat1', kind: 'variety', metric: 'baccarat', goal: 1, reward: 1000, name: { he: 'שחק באקרה', en: 'Play a hand of baccarat' } },
];

/** The weekly pool — one big mission per week. */
export const WEEKLY_MISSIONS: Mission[] = [
  { id: 'w_hands100', kind: 'quantity', metric: 'hands', goal: 100, reward: 15000, name: { he: 'שחק 100 ידיים השבוע', en: 'Play 100 hands this week' } },
  { id: 'w_hands150', kind: 'quantity', metric: 'hands', goal: 150, reward: 15000, name: { he: 'שחק 150 ידיים השבוע', en: 'Play 150 hands this week' } },
  { id: 'w_wins40', kind: 'quantity', metric: 'wins', goal: 40, reward: 15000, name: { he: 'זכה 40 פעמים השבוע', en: 'Win 40 times this week' } },
  { id: 'w_chips200k', kind: 'quantity', metric: 'chipsWon', goal: 200000, reward: 15000, name: { he: 'הרווח 200,000 צ׳יפים בסבבים השבוע', en: 'Win 200,000 chips in rounds this week' } },
  { id: 'w_games5', kind: 'variety', metric: 'gamesVariety', goal: 5, reward: 15000, name: { he: 'שחק ב-5 משחקים שונים השבוע', en: 'Play 5 different games this week' } },
];

/** The virtual "you finished all 3" mission — claimed through the same RPC. */
export const ALL_DONE_MISSION_ID = 'all_done';

const missionById = (id: string): Mission | undefined =>
  MISSIONS.find((m) => m.id === id) ?? WEEKLY_MISSIONS.find((m) => m.id === id);
export { missionById };

/* ------------------------------------------------------------------ seeds -- */

/** FNV-1a hash of a date/week key → a stable 32-bit seed. */
function seedFrom(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleWith<T>(input: T[], rng: () => number): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** `YYYY-MM-DD` shifted by whole days (UTC). */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Which ISO-week bucket a date key falls in (7-day blocks from the epoch). */
export function weekKeyFor(dateKey: string): string {
  return String(Math.floor(Date.parse(dateKey + 'T00:00:00Z') / 86_400_000 / 7));
}

/* ---------------------------------------------------------------- rotation - */

function pickThree(dateKey: string, exclude: ReadonlySet<string>): Mission[] {
  const rng = mulberry32(seedFrom(dateKey));
  const q = shuffleWith(MISSIONS.filter((m) => m.kind === 'quantity' && !exclude.has(m.id)), rng);
  const v = shuffleWith(MISSIONS.filter((m) => m.kind === 'variety' && !exclude.has(m.id)), rng);
  // Guarantee at least one of each kind, then fill the third from the rest.
  const chosen: Mission[] = [q[0], v[0]];
  const rest = shuffleWith([...q.slice(1), ...v.slice(1)], rng);
  chosen.push(rest[0]);
  return chosen;
}

/** Today's three missions — deterministic, distinct, mixed, and never the same
 *  set as yesterday. */
export function dailyMissions(dateKey: string): Mission[] {
  const yesterdayIds = new Set(pickThree(shiftDateKey(dateKey, -1), new Set()).map((m) => m.id));
  return pickThree(dateKey, yesterdayIds);
}

/** This week's single big mission — deterministic from the week bucket. */
export function weeklyMission(weekKey: string): Mission {
  const rng = mulberry32(seedFrom('w' + weekKey));
  return WEEKLY_MISSIONS[Math.floor(rng() * WEEKLY_MISSIONS.length)];
}

/* ----------------------------------------------------------------- progress */

export interface MissionCounters {
  counts: Record<string, number>;
  games: string[];
}

/** Current progress toward a mission from a counter bucket. */
export function missionValue(mission: Mission, c: MissionCounters): number {
  switch (mission.metric) {
    case 'gamesVariety': return c.games.length;
    case 'pokerAny': return (c.counts.poker ?? 0) + (c.counts.sng ?? 0);
    default: return c.counts[mission.metric] ?? 0;
  }
}

export const missionComplete = (mission: Mission, c: MissionCounters): boolean =>
  missionValue(mission, c) >= mission.goal;

/** Shared constants re-exported so consumers import from one place. */
export { MAX_MISSION_REWARD, MISSION_ALL_DONE_BONUS };
