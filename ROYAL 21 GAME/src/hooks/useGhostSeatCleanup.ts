import { useEffect } from 'react';

interface SeatLike { userId: string }
interface MemberLike { userId: string }

/**
 * Host-only ghost-seat reconciler, shared by every multiplayer scene.
 *
 * When a player closes their tab without leaving cleanly, they drop out of
 * `room_members` but their seat lingers in game state — freezing the table if
 * it was their turn to act. The host watches for any seat whose userId is no
 * longer a room member and dispatches a synthetic `leave` for it (every engine
 * already handles `leave`, including the "not enough players left" path).
 *
 * Only the host runs it so two clients don't race the same cleanup. Keyed on the
 * sorted seat/member id lists so it re-checks whenever either set changes.
 */
export function useGhostSeatCleanup(
  isHost: boolean,
  seats: SeatLike[] | null | undefined,
  members: MemberLike[],
  leave: (userId: string) => void,
  enabled = true,
) {
  const seatKey = (seats ?? []).map((s) => s.userId).sort().join('|');
  const memberKey = members.map((m) => m.userId).sort().join('|');
  useEffect(() => {
    if (!enabled || !isHost || !seats || members.length === 0) return;
    const present = new Set(members.map((m) => m.userId));
    for (const seat of seats) {
      if (!present.has(seat.userId)) leave(seat.userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, enabled, seatKey, memberKey]);
}
