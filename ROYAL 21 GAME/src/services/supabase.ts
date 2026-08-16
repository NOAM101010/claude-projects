import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

let client: SupabaseClient | null = null;

/**
 * Returns the Supabase client, or null when the project has no credentials.
 * Every service checks this and falls back to device-local play, so the game
 * always runs — the backend adds friends, rooms and cross-device multiplayer.
 */
export function db(): SupabaseClient | null {
  if (!env.online) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

export const isOnline = () => env.online;

/**
 * True only for an id the database will accept as a uuid.
 *
 * Device-local players carry a `guest_…` id and, for the moment between boot
 * and sign-in, the store holds an empty one. Both used to be sent straight to
 * PostgREST as `?user_id=eq.guest_x` / `?id=eq.`, which answers 400 every time
 * — a steady drip of console errors that hid the real ones. Any service call
 * keyed by a player id checks this first and falls back to local play.
 */
export const isRemoteId = (id: string | null | undefined): id is string =>
  Boolean(id) && !id!.startsWith('guest_');
