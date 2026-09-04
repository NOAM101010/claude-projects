import { db, isRemoteId } from './supabase';
import { checkLimit } from '@/lib/rateLimit';
import { roomCode as makeCode } from '@/lib/random';
import type { ActiveGame, GameKey, Room, RoomConfig, RoomMember } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toMember = (row: any): RoomMember => ({
  userId: row.user_id,
  username: row.profile?.username ?? 'Player',
  avatar: row.profile?.avatar ?? { skin: 0, hair: 0, shirt: 'base' },
  level: row.profile?.level ?? 1,
  seat: row.seat,
  isHost: row.is_host,
  presence: row.profile?.presence ?? 'online',
  joinedAt: row.joined_at,
  title: row.profile?.equipped?.title ?? null,
  nameColor: row.profile?.equipped?.nameColor ?? null,
});

const MEMBER_SELECT = 'user_id, seat, is_host, joined_at, profile:profiles!room_members_user_id_fkey(username, avatar, level, presence, equipped)';

/**
 * SHA-256 the password before it leaves the device.
 *
 * These aren't real credentials — the point is to keep the plaintext out of
 * URLs, chat logs and the DB, not to defend against a determined attacker
 * (this is virtual-chip party protection).
 */
export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The server-side reaper (`reassign_room_host`) hands the room to a new host
 * once `rooms.updated_at` has been still for 10s. An alive host that simply
 * isn't publishing right now (between hands, or its tab is backgrounded so the
 * round-advance timers are throttled) must therefore keep nudging that column
 * or it gets falsely replaced and two hosts start fighting over the state.
 * 8s stays comfortably under the 10s window even after one missed beat.
 */
const HOST_HEARTBEAT_MS = 8000;

/**
 * Background tabs throttle `setInterval` to ~once per minute — far too slow to
 * keep the heartbeat alive. A Worker gets its own, much less aggressively
 * throttled timer, so the host keeps its seat even while the tab is hidden.
 * Falls back to a plain interval where Workers aren't available (tests/SSR).
 */
const TICKER_WORKER_SRC =
  'let h;onmessage=(e)=>{if(e.data&&e.data.stop){clearInterval(h);return;}' +
  'clearInterval(h);h=setInterval(()=>postMessage(0),e.data.ms);};';

function startTicker(ms: number, onTick: () => void): () => void {
  if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    try {
      const url = URL.createObjectURL(new Blob([TICKER_WORKER_SRC], { type: 'application/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = () => onTick();
      worker.postMessage({ ms });
      return () => {
        worker.postMessage({ stop: true });
        worker.terminate();
        URL.revokeObjectURL(url);
      };
    } catch {
      /* fall through to setInterval */
    }
  }
  const id = setInterval(onTick, ms);
  return () => clearInterval(id);
}

export const roomsService = {
  /**
   * A throttle-resistant repeating timer (Blob Worker, falls back to
   * setInterval). Shared by the host heartbeat and the global presence
   * heartbeat — a plain setInterval is clamped to ~1/min in a background tab.
   */
  startTicker,

  /**
   * Device-local players cannot host.
   *
   * A `guest_…` id is not a uuid, so inserting it as `host_id` is rejected by
   * Postgres and the room silently never appears — the lobby just sits there
   * showing an empty code. Refusing here lets the scene say why. Getting a real
   * id needs Anonymous sign-ins enabled on the Supabase project.
   */
  canHost(userId: string) {
    return Boolean(db()) && isRemoteId(userId);
  },

  async create(hostId: string, game: GameKey, config?: RoomConfig): Promise<Room | null> {
    const client = db();
    if (!client || !isRemoteId(hostId)) return null;
    if (!checkLimit(hostId, 'roomCreate')) return null;
    const code = makeCode();
    // Stamp the host's equipped table skin + room background onto the room so
    // every seated client dresses the felt the same way (a private room should
    // look like the host's table, not like each player's own vault).
    let dressed: RoomConfig = config ?? {};
    try {
      const { data: host } = await client.from('profiles').select('equipped').eq('id', hostId).maybeSingle();
      const eq = host?.equipped as { table?: string; roomBackground?: string } | undefined;
      dressed = {
        ...dressed,
        ...(eq?.table ? { tableSkin: eq.table } : {}),
        ...(eq?.roomBackground ? { bgSkin: eq.roomBackground } : {}),
      };
    } catch { /* keep config as-is if the lookup fails */ }
    const { data, error } = await client
      .from('rooms')
      .insert({ code, host_id: hostId, game, state: null, config: dressed })
      .select('*')
      .single();
    if (error || !data) return null;
    await client.from('room_members').insert({ room_id: data.id, user_id: hostId, is_host: true, seat: 0 });
    return {
      id: data.id, code: data.code, hostId: data.host_id, game: data.game,
      createdAt: data.created_at, members: [], config: data.config ?? undefined,
      activeGame: data.active_game ?? null,
    };
  },

  async byCode(code: string): Promise<Room | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
    if (!data) return null;
    return {
      id: data.id, code: data.code, hostId: data.host_id, game: data.game,
      createdAt: data.created_at, members: [], config: data.config ?? undefined,
      activeGame: data.active_game ?? null,
    };
  },

  /**
   * Publish which game (and which room) this room's members should all be
   * playing right now — a generic pointer any room can set, not just a
   * blackjack-shaped one. `useFollowHost` watches it and auto-navigates
   * every client in, including the one that set it (so the host doesn't
   * need its own separate `navigate()` call).
   */
  async setActiveGame(roomId: string, activeGame: ActiveGame): Promise<void> {
    const client = db();
    if (!client) return;
    await client.from('rooms').update({ active_game: activeGame }).eq('id', roomId);
  },

  async clearActiveGame(roomId: string): Promise<void> {
    const client = db();
    if (!client) return;
    await client.from('rooms').update({ active_game: null }).eq('id', roomId);
  },

  /** Every client watches this room's `active_game` pointer. */
  subscribeActiveGame(roomId: string, onChange: (activeGame: ActiveGame | null) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`room-active-game:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { active_game: ActiveGame | null };
          onChange(row.active_game ?? null);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** True when a room with this code still exists AND has at least one member.
   *  `rooms` rows are never deleted, so a bare byCode() isn't enough to tell a
   *  live table from a dead one — an invite is only worth acting on if someone
   *  is actually there.
   *
   *  A failed / errored query returns `true` ("assume live") so a network blip
   *  never deletes a legitimate invite; only a query that *succeeds* and finds
   *  no room / no members returns `false`. */
  async isLive(code: string): Promise<boolean> {
    const client = db();
    if (!client) return true;
    try {
      const { data: room, error: roomErr } = await client
        .from('rooms').select('id').eq('code', code.toUpperCase()).maybeSingle();
      if (roomErr) return true;
      if (!room) return false;
      const { count, error: memberErr } = await client
        .from('room_members').select('user_id', { count: 'exact', head: true }).eq('room_id', room.id);
      if (memberErr) return true;
      return (count ?? 0) > 0;
    } catch {
      return true;
    }
  },

  /** Check a password against a room's stored hash. Returns true when public. */
  async verifyPassword(roomId: string, password: string): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const hash = await hashPassword(password);
    const { data, error } = await client.rpc('verify_room_password', {
      p_room_id: roomId, p_password: hash,
    });
    if (error) return false;
    return Boolean(data);
  },

  async join(roomId: string, userId: string, maxSeats = 4) {
    const client = db();
    if (!client || !isRemoteId(userId)) return;
    const { data: existing } = await client.from('room_members').select('user_id, seat').eq('room_id', roomId);
    if (existing?.some((m) => m.user_id === userId)) return;
    const taken = new Set((existing ?? []).map((m) => m.seat));
    /*
     * Two players can both read the same "next free seat" before either
     * inserts. The `room_members_seat_unique` constraint (supabase/roulette.sql)
     * turns the loser's insert into a 23505 conflict instead of a silent
     * double-seat — retry with the next open seat rather than dropping them.
     */
    for (let seat = 0; seat < maxSeats; seat += 1) {
      if (taken.has(seat)) continue;
      const { error } = await client.from('room_members').insert({ room_id: roomId, user_id: userId, is_host: false, seat });
      if (!error) return;
      if (error.code !== '23505') return;
      taken.add(seat);
    }
  },

  /**
   * Tries to take over as host. Only succeeds if `reassign_room_host` (SQL)
   * finds the room has gone quiet for 10s+ — the signal that the old host's
   * loop has stopped publishing, which only happens once that tab is gone.
   */
  async claimHostIfStale(roomId: string, userId: string): Promise<boolean> {
    const client = db();
    if (!client || !isRemoteId(userId)) return false;
    const { data, error } = await client.rpc('reassign_room_host', { p_room_id: roomId });
    return !error && !!data;
  },

  /**
   * A disconnected host otherwise freezes a room forever — nothing else ever
   * changes `host_id`. Every non-host member polls for staleness and races to
   * claim host the moment the room goes quiet; `reassign_room_host` is the
   * actual arbiter (whoever's call lands first server-side wins), so this is
   * safe to run from every seated client at once.
   */
  watchHostLiveness(roomId: string, userId: string, isCurrentlyHost: () => boolean, onTakeover: () => void) {
    // Was 5s / a 20s server window. The server-side `reassign_room_host`
    // refuses unless the room has been quiet for 10s+ anyway, so shortening
    // the client-side poll only reduces the "how quickly can we notice a dead
    // host" latency — worst-case freeze time is now ~2-12s instead of ~5-25s.
    // Cheap RPC either way.
    const interval = setInterval(() => {
      if (isCurrentlyHost()) return;
      void this.claimHostIfStale(roomId, userId).then((claimed) => { if (claimed) onTakeover(); });
    }, 2000);
    return () => clearInterval(interval);
  },

  /**
   * Keep this client's hold on the room while it is the host. Every ~8s (and
   * immediately whenever the tab regains focus) it touches `rooms.updated_at`
   * so the server-side reaper never mistakes an idle-but-alive host for a dead
   * one. The write is filtered by `host_id = userId` and additionally gated by
   * the `rooms_update_host` RLS policy, so it silently affects zero rows the
   * moment another client has legitimately taken over — that is the signal to
   * step down (`onLostHost`) rather than keep publishing a second, conflicting
   * stream of state.
   */
  startHostHeartbeat(
    roomId: string,
    userId: string,
    isCurrentlyHost: () => boolean,
    onLostHost: () => void,
  ) {
    const client = db();
    if (!client || !isRemoteId(userId)) return () => {};
    let stopped = false;
    let lost = false;

    const beat = async () => {
      if (stopped || lost || !isCurrentlyHost()) return;
      const { data, error } = await client
        .from('rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .eq('host_id', userId)
        .select('id');
      if (stopped || lost) return;
      // A transient network error just means "try again next beat". Zero rows
      // with no error means we are provably not the host anymore.
      if (!error && Array.isArray(data) && data.length === 0) {
        lost = true;
        onLostHost();
      }
    };

    const stopTicker = startTicker(HOST_HEARTBEAT_MS, () => { void beat(); });
    void beat();

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void beat();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stopped = true;
      stopTicker();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  },

  async leave(roomId: string, userId: string) {
    const client = db();
    if (!client) return;
    await client.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  },

  async members(roomId: string): Promise<RoomMember[]> {
    const client = db();
    if (!client) return [];
    const { data } = await client.from('room_members').select(MEMBER_SELECT).eq('room_id', roomId).order('seat');
    return (data ?? []).map(toMember);
  },

  /** Membership changes + live presence for everyone sitting at the table. */
  subscribeMembers(roomId: string, onChange: (members: RoomMember[]) => void) {
    const client = db();
    if (!client) return () => {};
    const refresh = async () => onChange(await this.members(roomId));
    const channel = client
      .channel(`room-members:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') void refresh(); });
    return () => { void client.removeChannel(channel); };
  },

  /** Lightweight side-channel for emotes and quick messages (not game state). */
  chatChannel(roomId: string) {
    const client = db();
    if (!client) return null;
    return client.channel(`room-chat:${roomId}`, { config: { broadcast: { self: true } } });
  },
};
