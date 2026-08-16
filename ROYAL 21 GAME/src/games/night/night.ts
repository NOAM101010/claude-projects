import type { BjState, Outcome } from '@/games/blackjack/types';
import type { RoomMember } from '@/types';

/**
 * Game night scoring.
 *
 * Points are derived from the table's own settled history rather than kept in a
 * second place. `rooms.state.history` is already host-authoritative and already
 * synced to everyone, so the scoreboard cannot drift from what actually
 * happened — there is nothing to reconcile.
 */
export const POINTS: Record<Outcome, number> = {
  blackjack: 4,
  win: 3,
  push: 1,
  lose: 0,
  bust: 0,
};

export interface NightRow {
  userId: string;
  username: string;
  points: number;
  hands: number;
  wins: number;
  blackjacks: number;
  net: number;
}

/** Ranked scoreboard: points first, then chips won, then most hands played. */
export function scoreboard(state: BjState | null, members: RoomMember[]): NightRow[] {
  const rows = new Map<string, NightRow>();

  const ensure = (userId: string, username: string) => {
    let row = rows.get(userId);
    if (!row) {
      row = { userId, username, points: 0, hands: 0, wins: 0, blackjacks: 0, net: 0 };
      rows.set(userId, row);
    }
    return row;
  };

  // Everyone at the table appears, even before their first hand.
  members.forEach((member) => ensure(member.userId, member.username));
  state?.seats.forEach((seat) => ensure(seat.userId, seat.username));

  for (const entry of state?.history ?? []) {
    const seat = state?.seats.find((s) => s.userId === entry.userId);
    const row = ensure(entry.userId, entry.username ?? seat?.username ?? 'Player');
    row.points += POINTS[entry.outcome] ?? 0;
    row.hands += 1;
    row.net += entry.net;
    if (entry.outcome === 'win' || entry.outcome === 'blackjack') row.wins += 1;
    if (entry.outcome === 'blackjack') row.blackjacks += 1;
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.net - a.net || b.hands - a.hands,
  );
}

/** True once at least one hand has been settled tonight. */
export const nightStarted = (state: BjState | null) => (state?.history.length ?? 0) > 0;
