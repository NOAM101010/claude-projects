import { db } from './supabase';
import type { GameKey, Presence } from '@/types';

export interface RoomPresenceMeta {
  username: string;
  presence: Presence;
  game: GameKey | null;
  /** Connected to the room without a seat — watching, not playing. */
  spectator: boolean;
}

/**
 * Room presence: who is actually connected right now, independent of the
 * membership rows. Used for "Daniel is at the table" and the spectator count —
 * anyone who opens a table page tracks themselves here, seated or not, so the
 * people actually playing can see who's watching.
 */
export const presenceService = {
  track(roomId: string, userId: string, meta: RoomPresenceMeta) {
    const client = db();
    if (!client) return { unsubscribe: () => {}, onSync: () => {} };
    const channel = client.channel(`presence:${roomId}`, { config: { presence: { key: userId } } });
    let handler: (state: Record<string, RoomPresenceMeta[]>) => void = () => {};
    channel
      .on('presence', { event: 'sync' }, () => {
        handler(channel.presenceState<RoomPresenceMeta>());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track(meta);
      });
    return {
      unsubscribe: () => { void client.removeChannel(channel); },
      onSync: (fn: (state: Record<string, RoomPresenceMeta[]>) => void) => { handler = fn; },
    };
  },
};
