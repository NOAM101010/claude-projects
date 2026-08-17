import { db, isRemoteId } from './supabase';
import { checkLimit } from '@/lib/rateLimit';
import { roomCode as makeCode } from '@/lib/random';
import type { GameKey, Room, RoomConfig, RoomMember } from '@/types';

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
});

const MEMBER_SELECT = 'user_id, seat, is_host, joined_at, profile:profiles!room_members_user_id_fkey(username, avatar, level, presence)';

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

export const roomsService = {
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
    const { data, error } = await client
      .from('rooms')
      .insert({ code, host_id: hostId, game, state: null, config: config ?? null })
      .select('*')
      .single();
    if (error || !data) return null;
    await client.from('room_members').insert({ room_id: data.id, user_id: hostId, is_host: true, seat: 0 });
    return {
      id: data.id, code: data.code, hostId: data.host_id, game: data.game,
      createdAt: data.created_at, members: [], config: data.config ?? undefined,
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
    };
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
   * finds the room has gone quiet for 20s+ — the signal that the old host's
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
    // Was 15s. The server-side `reassign_room_host` refuses unless the room
    // has been quiet for 20s+ anyway, so shortening the client-side poll only
    // reduces the "how quickly can we notice a dead host" latency — worst-case
    // freeze time is now ~5-25s instead of ~15-35s. Cheap RPC either way.
    const interval = setInterval(() => {
      if (isCurrentlyHost()) return;
      void this.claimHostIfStale(roomId, userId).then((claimed) => { if (claimed) onTakeover(); });
    }, 5000);
    return () => clearInterval(interval);
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
