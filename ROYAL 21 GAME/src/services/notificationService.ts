import { db, isRemoteId } from './supabase';
import type { AppNotification } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toNotification = (row: any): AppNotification => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body ?? undefined,
  actorId: row.actor_id ?? undefined,
  payload: row.payload ?? undefined,
  read: row.read ?? false,
  createdAt: row.created_at,
});

export const notificationService = {
  async list(userId: string): Promise<AppNotification[]> {
    const client = db();
    if (!client || !isRemoteId(userId)) return [];
    const { data } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    return (data ?? []).map(toNotification);
  },

  async markRead(userId: string) {
    const client = db();
    if (!client || !isRemoteId(userId)) return;
    await client.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  },

  async invite(fromId: string, toId: string, roomCode: string, game: string) {
    const client = db();
    if (!client) return;
    await client.from('notifications').insert({
      user_id: toId, kind: 'invite', actor_id: fromId, title: 'invite',
      payload: { room_code: roomCode, game },
    });
  },

  /** Realtime feed so invites arrive while you are mid-game. */
  subscribe(userId: string, onInsert: (n: AppNotification) => void) {
    const client = db();
    if (!client || !isRemoteId(userId)) return () => {};
    const channel = client
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => onInsert(toNotification(payload.new)),
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
