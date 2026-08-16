import { db, isRemoteId } from './supabase';

/**
 * Lightweight, first-party analytics.
 *
 * Fire-and-forget: `track()` never awaits, never throws, never blocks the
 * caller. Every event batches into a short queue and flushes to the
 * `analytics_events` table every few seconds, so a chatty game screen does
 * not turn into a chatty network tab.
 *
 * The point of this file is answering four questions from the admin dashboard:
 *   1. How many people played today?
 *   2. What game did they play?
 *   3. Where did they drop off?
 *   4. What broke?
 * — nothing more. If we ever want cohort analysis or funnel analytics, that
 * is what PostHog is for; this stays boring on purpose.
 */

interface Event {
  name: string;
  properties?: Record<string, unknown>;
  ts: number;
}

const queue: Event[] = [];
let sessionId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL = 5000;
const MAX_QUEUE = 50;

/** A per-tab id so the admin dashboard can group events into sessions. */
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const existing = sessionStorage.getItem('royal21.session_id');
    if (existing) { sessionId = existing; return existing; }
    const fresh = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('royal21.session_id', fresh);
    sessionId = fresh;
    return fresh;
  } catch {
    // Some privacy modes disable sessionStorage — an in-memory id is still useful.
    sessionId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    return sessionId;
  }
}

async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const client = db();
  if (!client) { queue.length = 0; return; }

  const userId = getCurrentUserId();
  const batch = queue.splice(0, queue.length).map((event) => ({
    user_id: userId,
    event_name: event.name,
    properties: event.properties ?? null,
    session_id: getSessionId(),
    created_at: new Date(event.ts).toISOString(),
  }));

  // Best-effort — a failed flush is not a user-visible problem.
  try { await client.from('analytics_events').insert(batch); } catch { /* swallow */ }
}

/** Set by the player store once a profile is loaded. */
let currentUserId: string | null = null;
function getCurrentUserId(): string | null {
  return currentUserId && isRemoteId(currentUserId) ? currentUserId : null;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { void flush(); }, FLUSH_INTERVAL);
}

export const analytics = {
  /** Record an event. Never awaits, never throws. */
  track(name: string, properties?: Record<string, unknown>) {
    queue.push({ name, properties, ts: Date.now() });
    if (queue.length >= MAX_QUEUE) { void flush(); return; }
    scheduleFlush();
  },

  /** Called from usePlayer when the profile changes. */
  setUser(userId: string | null) {
    currentUserId = userId;
  },

  /** Force a flush right now (used on page unload). */
  async flushNow() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    await flush();
  },
};

// Best-effort flush on unload so a session's last events are not lost.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void analytics.flushNow(); });
  window.addEventListener('beforeunload', () => { void analytics.flushNow(); });
}
