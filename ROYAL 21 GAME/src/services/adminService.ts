import { db, isRemoteId, isOnline } from './supabase';
import type { Profile } from '@/types';

/**
 * Admin powers.
 *
 * Every call here is a round trip to a SECURITY DEFINER function that checks
 * `profiles.is_admin` for the calling session before it does anything. The flag
 * on the client profile decides what the app *draws*; it decides nothing about
 * what the app is *allowed to do*. That split is the whole point — otherwise
 * "admin" would be one localStorage edit away for anyone.
 */

export interface AdminOverview {
  players: number;
  guests: number;
  online: number;
  unconfirmed: number;
  missingProfile: number;
  rooms: number;
  liveRooms: number;
  messages: number;
  itemsOwned: number;
  catalogue: number;
  chipsInPlay: number;
  handsPlayed: number;
  topPlayers: { username: string; tag: string; level: number; chips: number; presence: string }[];
}

export interface AdminRoom {
  code: string;
  game: string;
  host: string | null;
  members: number;
  created_at: string;
  updated_at: string;
}

/** One row of the "who's live right now" panel. */
export interface AdminActivePlayer {
  id: string;
  username: string;
  tag: string;
  level: number;
  chips: number;
  presence: string;
  current_game: string | null;
  last_seen: string;
  is_admin: boolean;
  is_guest: boolean;
}

/** One line per thing that can be silently wrong, with the answer. */
export interface HealthCheck {
  key: string;
  ok: boolean;
  detail: string;
}

/** Full player card from admin_find_player. */
export interface AdminPlayer {
  id: string;
  username: string;
  tag: string;
  level: number;
  xp: number;
  chips: number;
  presence: string;
  current_game: string | null;
  last_seen: string | null;
  is_admin: boolean;
  is_guest: boolean;
  created_at: string;
  ever_vip: boolean;
  daily_streak: number;
  onboarded_at: string | null;
  item_count: number;
  friend_count: number;
  referral_count: number;
}

/** One row of admin_list_bugs. */
export interface AdminBug {
  id: number;
  description: string;
  url: string | null;
  screen_size: string | null;
  user_agent: string | null;
  created_at: string;
  resolved_at: string | null;
  notes: string | null;
  reporter: string | null;
  reporter_tag: string | null;
}

export const adminService = {
  async overview(): Promise<AdminOverview | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('admin_overview');
    if (error) return null;
    return data as AdminOverview;
  },

  async recentRooms(limit = 12): Promise<AdminRoom[]> {
    const client = db();
    if (!client) return [];
    const { data, error } = await client.rpc('admin_recent_rooms', { p_limit: limit });
    if (error) return [];
    return (data ?? []) as AdminRoom[];
  },

  async setChips(chips: number): Promise<number | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('admin_set_chips', { p_chips: Math.round(chips) });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  async grantAllItems(): Promise<number | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('admin_grant_all_items');
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  async setLevel(level: number): Promise<number | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('admin_set_level', { p_level: Math.round(level) });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  async transferChips(targetTag: string, amount: number): Promise<{ username: string; balance: number } | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('transfer_chips', { target_tag: targetTag, amount: Math.round(amount) });
    if (error || !data?.success) return null;
    return { username: data.username, balance: data.new_balance };
  },

  /** Set another player's balance to an exact value (not a delta). */
  async setUserChips(targetTag: string, chips: number): Promise<{ username: string; balance: number } | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('admin_set_user_chips', { target_tag: targetTag, p_chips: Math.round(chips) });
    if (error || !data?.success) return null;
    return { username: data.username, balance: data.new_balance };
  },

  /** Live "who's online right now" list. Updated presence + current game per row. */
  async activePlayers(limit = 30): Promise<AdminActivePlayer[]> {
    const client = db();
    if (!client) return [];
    const { data, error } = await client.rpc('admin_active_players', { p_limit: limit });
    if (error) return [];
    return (data ?? []) as AdminActivePlayer[];
  },

  /* ----------------------------- player support ----------------------------- */

  async findPlayer(q: string): Promise<AdminPlayer[]> {
    const client = db();
    if (!client) return [];
    const { data, error } = await client.rpc('admin_find_player', { q });
    if (error) return [];
    return (data ?? []) as AdminPlayer[];
  },

  async resetPlayer(targetId: string): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const { data, error } = await client.rpc('admin_reset_player', { target_id: targetId });
    return !error && Boolean(data?.ok);
  },

  async grantItem(targetId: string, itemId: string): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const { data, error } = await client.rpc('admin_grant_item', { target_id: targetId, p_item_id: itemId });
    return !error && Boolean(data?.ok);
  },

  async revokeItem(targetId: string, itemId: string): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const { data, error } = await client.rpc('admin_revoke_item', { target_id: targetId, p_item_id: itemId });
    return !error && Boolean(data?.ok);
  },

  async setPlayerLevel(targetId: string, level: number): Promise<number | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('admin_set_level', { target_id: targetId, p_level: Math.round(level) });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },

  /* --------------------------------- bugs ---------------------------------- */

  async listBugs(): Promise<AdminBug[]> {
    const client = db();
    if (!client) return [];
    const { data, error } = await client.rpc('admin_list_bugs');
    if (error) return [];
    return (data ?? []) as AdminBug[];
  },

  async resolveBug(id: number): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const { data, error } = await client.rpc('admin_resolve_bug', { p_id: id });
    return !error && Boolean(data?.ok);
  },

  /* ---------------------------- economy config --------------------------- */

  async getConfig(): Promise<Record<string, unknown>> {
    const client = db();
    if (!client) return {};
    const { data, error } = await client.rpc('get_app_config');
    if (error || !data) return {};
    return data as Record<string, unknown>;
  },

  async setConfig(key: string, value: unknown): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const { data, error } = await client.rpc('admin_set_config', { p_key: key, p_value: value });
    return !error && Boolean(data?.ok);
  },

  /**
   * The diagnostic that would have made the last round of bugs obvious in
   * seconds: is there a session, does the profile row exist, and can this
   * session actually write to it — the three things that all look identical
   * from the outside when they go wrong.
   */
  async health(profile: Profile): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const client = db();

    if (!isOnline() || !client) {
      return [{ key: 'backend', ok: false, detail: 'VITE_SUPABASE_URL / ANON_KEY not set — device-local play only' }];
    }
    checks.push({ key: 'backend', ok: true, detail: 'connected' });

    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData.session;
    checks.push({
      key: 'session',
      ok: Boolean(session),
      detail: session
        ? `${session.user.email ?? 'anonymous'} · expires ${new Date((session.expires_at ?? 0) * 1000).toLocaleString()}`
        : 'no session — every write will be refused',
    });

    checks.push({
      key: 'identity',
      ok: Boolean(session && session.user.id === profile.id),
      detail: session
        ? session.user.id === profile.id
          ? profile.id
          : `app is ${profile.id}, server sees ${session.user.id}`
        : profile.id || 'none',
    });

    if (isRemoteId(profile.id)) {
      const { data: row } = await client.from('profiles').select('id, is_admin, chips').eq('id', profile.id).maybeSingle();
      checks.push({
        key: 'profileRow',
        ok: Boolean(row),
        detail: row ? `chips ${row.chips}` : 'missing — run supabase/confirm-existing-emails.sql',
      });

      // The real test of a session: does a write land, or is it quietly refused?
      const { data: written, error: writeError } = await client
        .from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', profile.id).select('id');
      checks.push({
        key: 'writable',
        ok: Boolean(written?.length) && !writeError,
        detail: writeError?.message ?? (written?.length ? 'writes accepted' : 'refused by RLS — the session does not match this row'),
      });
    } else {
      checks.push({ key: 'profileRow', ok: false, detail: 'device-local guest, nothing stored server side' });
      checks.push({ key: 'writable', ok: false, detail: 'device-local guest' });
    }

    const { count, error: itemsError } = await client.from('items').select('id', { count: 'exact', head: true });
    checks.push({
      key: 'catalogue',
      ok: !itemsError && (count ?? 0) > 0,
      detail: itemsError?.message ?? `${count ?? 0} items seeded`,
    });

    // buy_item() is the function the shop stands on; prove it exists.
    const { error: rpcError } = await client.rpc('buy_item', { p_item_id: '__probe__' });
    const missing = (rpcError?.message ?? '').toLowerCase().includes('could not find the function');
    checks.push({
      key: 'buyItem',
      ok: !missing,
      detail: missing ? 'buy_item() not installed — run supabase/setup.sql' : 'installed',
    });

    return checks;
  },
};
