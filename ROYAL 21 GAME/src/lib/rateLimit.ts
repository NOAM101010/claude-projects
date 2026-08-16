/**
 * Client-side rate limiting for game actions.
 *
 * Every action send goes through here first — if a caller (buggy code,
 * fast-clicking user, or someone trying to flood the room) breaches the
 * quota, the call is dropped locally so it never reaches the network.
 *
 * A trusted user with 20 actions/second is already unreasonable for a
 * turn-based game; the limits here are set to catch abuse, not annoy
 * normal play.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

interface Limit {
  /** Max calls allowed in the window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

/** Preset limits per category, tuned for real gameplay. */
export const LIMITS: Record<string, Limit> = {
  // Game actions (picks, bets, flips) — 10/sec is generous for humans
  gameAction: { max: 10, windowMs: 1000 },
  // Room creation — 5 rooms per minute
  roomCreate: { max: 5, windowMs: 60_000 },
  // Chat messages — 15/min prevents spam
  chat: { max: 15, windowMs: 60_000 },
  // Friend requests — 20/min
  social: { max: 20, windowMs: 60_000 },
  // Bug reports — 3/min
  bugReport: { max: 3, windowMs: 60_000 },
};

/**
 * Check if this call is allowed under the given rate limit.
 * Returns true if allowed and records the call; false if over quota.
 *
 * key: unique per (user, category) — e.g. `${userId}:gameAction`
 */
export function checkRate(key: string, limit: Limit): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= limit.windowMs) {
    // Window expired or first call — reset
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= limit.max) return false;

  bucket.count += 1;
  return true;
}

/** Convenience: check against a named preset limit. */
export function checkLimit(userId: string, category: keyof typeof LIMITS): boolean {
  const limit = LIMITS[category];
  return checkRate(`${userId}:${category}`, limit);
}

/** Clean up old buckets periodically so the map does not grow unbounded. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    // Any bucket older than 5 minutes is definitely stale
    if (now - bucket.windowStart > 5 * 60_000) buckets.delete(key);
  }
}, 60_000);
