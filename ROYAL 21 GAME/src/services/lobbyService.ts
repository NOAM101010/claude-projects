import { db } from './supabase';
import type { GameKey, RoomConfig } from '@/types';

export interface LobbyTable {
  id: string;
  code: string;
  game: GameKey;
  hostId: string;
  hostName: string;
  maxSeats: number;
  createdAt: string;
  config?: RoomConfig;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const MAX_SEATS_BY_GAME: Partial<Record<GameKey, number>> = { roulette: 5 };
const maxSeatsOf = (game: GameKey) => MAX_SEATS_BY_GAME[game] ?? 4;

/** Rooms older than this can't still be live — an upper bound on the candidate query, not the real filter. */
const CANDIDATE_WINDOW_MS = 6 * 60 * 60 * 1000;

export const lobbyService = {
  /**
   * Candidate tables across every game — the `rooms` row is public-read (it's the
   * invite). This is not "who's actually there right now": a room row survives
   * long after everyone has closed the tab, so callers must cross this with
   * `subscribePresence` and only show tables with a live count above zero.
   */
  async list(): Promise<LobbyTable[]> {
    const client = db();
    if (!client) return [];
    const since = new Date(Date.now() - CANDIDATE_WINDOW_MS).toISOString();
    const { data: rooms } = await client
      .from('rooms')
      .select('id, code, game, host_id, created_at, config, host:profiles!rooms_host_id_fkey(username)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(60);
    if (!rooms?.length) return [];

    return rooms.map((row: any): LobbyTable => ({
      id: row.id,
      code: row.code,
      game: row.game as GameKey,
      hostId: row.host_id,
      hostName: row.host?.username ?? 'Player',
      maxSeats: (row.config?.maxSeats as number | undefined) ?? maxSeatsOf(row.game as GameKey),
      createdAt: row.created_at,
      config: row.config ?? undefined,
    }));
  },

  /** New rooms appearing — the lobby re-fetches the candidate list on every insert. */
  subscribeNewRooms(onChange: () => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel('lobby-rooms')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, onChange)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /**
   * Live headcount per room, from the same `presence:${roomId}` channel every
   * table scene tracks itself into (see presenceService). This is the actual
   * "is anyone here right now" signal — a room with 0 counts as closed, no
   * matter what the `room_members` table still says.
   */
  subscribePresence(roomIds: string[], onChange: (counts: Record<string, number>) => void) {
    const client = db();
    if (!client || !roomIds.length) return () => {};
    const counts: Record<string, number> = {};
    const channels = roomIds.map((roomId) => {
      const channel = client.channel(`presence:${roomId}`);
      channel
        .on('presence', { event: 'sync' }, () => {
          counts[roomId] = Object.keys(channel.presenceState()).length;
          onChange({ ...counts });
        })
        .subscribe();
      return channel;
    });
    return () => { channels.forEach((channel) => void client.removeChannel(channel)); };
  },
};

/** Where a joined table actually opens, per game — mirrors routes.tsx. */
export const roomRouteFor = (game: GameKey, code: string): string => {
  switch (game) {
    case 'roulette': return `/game/roulette/room/${code}`;
    case 'blackjack': return `/blackjack/room/${code}`;
    case 'duel': return `/room/${code}?game=duel`;
    case 'poker': return `/poker/${code}`;
    case 'sng': return `/poker/sng/${code}`;
    default: return `/room/${code}`;
  }
};
