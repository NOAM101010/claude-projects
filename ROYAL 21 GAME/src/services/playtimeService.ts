import { db, isOnline, isRemoteId } from './supabase';
import { env } from '@/lib/env';

/**
 * Lifetime play-time tracking. The app runs a foreground-only second counter
 * (see App.tsx) and hands the accumulated seconds to `flush()` every minute and
 * again when the tab is backgrounded or closed.
 *
 * `add_playtime` (supabase/playtime.sql) clamps every call to an hour, so a
 * flush that never lands is a rounding error, not a hole.
 */
export const playtimeService = {
  /** Normal flush — awaited, used on the 60s interval. Returns the new total. */
  async flush(userId: string | null | undefined, seconds: number): Promise<number | null> {
    const secs = Math.round(seconds);
    if (secs <= 0 || !isOnline() || !isRemoteId(userId)) return null;
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('add_playtime', { p_seconds: secs });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  /**
   * Best-effort flush for `pagehide` / `visibilitychange → hidden`, when an
   * awaited request would be killed by navigation. Uses a keepalive fetch
   * straight to the RPC endpoint with the live session token.
   */
  flushBeacon(userId: string | null | undefined, seconds: number, accessToken: string | null): void {
    const secs = Math.round(seconds);
    if (secs <= 0 || !isOnline() || !isRemoteId(userId) || !accessToken) return;
    try {
      void fetch(`${env.supabaseUrl}/rest/v1/rpc/add_playtime`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ p_seconds: secs }),
      });
    } catch {
      /* nothing more we can do on the way out */
    }
  },
};

/** "3h 12m" / "12m" / "45s" — compact lifetime-playtime label (he: "3ש 12ד"). */
export function formatPlaytime(seconds: number | null | undefined, lang = 'en'): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const u = lang === 'he'
    ? { h: 'ש', m: 'ד', s: 'שנ' }
    : { h: 'h', m: 'm', s: 's' };
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  if (m > 0) return `${m}${u.m}`;
  return `${s}${u.s}`;
}
