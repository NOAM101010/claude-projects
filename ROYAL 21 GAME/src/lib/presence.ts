/**
 * Freshness gate for a friend's presence.
 *
 * `profiles.presence` / `last_seen` are written on route changes and by a ~25s
 * heartbeat (App.tsx). Someone who closes a tab without the `pagehide` beacon
 * landing keeps their last `presence` value forever, so "online" has to mean
 * *and seen recently* — the same check the admin scene already does inline.
 */
const FRESH_MS = 60_000;

export function isFriendOnline(p: { presence?: string | null; lastSeen?: string | null }): boolean {
  if (p.presence == null || p.presence === 'offline' || p.lastSeen == null) return false;
  const seen = new Date(p.lastSeen).getTime();
  return Number.isFinite(seen) && Date.now() - seen < FRESH_MS;
}
