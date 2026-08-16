import { db, isRemoteId } from './supabase';
import { checkLimit } from '@/lib/rateLimit';
import type { ChatMessage } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toMessage = (row: any): ChatMessage => ({
  id: row.id,
  roomId: row.room_id,
  userId: row.user_id,
  username: row.profile?.username ?? row.username ?? 'Player',
  avatar: row.profile?.avatar ?? null,
  body: row.body,
  createdAt: row.created_at,
});

const SELECT = 'id, room_id, user_id, body, created_at, profile:profiles!room_messages_user_id_fkey(username, avatar)';

/** Longest message the table will take; the input enforces the same number. */
export const MAX_MESSAGE = 240;
/** Messages loaded when you open the panel. */
const HISTORY = 60;

export const chatService = {
  /** Recent history, oldest first, so a late joiner has the thread. */
  async history(roomId: string): Promise<ChatMessage[]> {
    const client = db();
    if (!client || !roomId) return [];
    const { data } = await client
      .from('room_messages')
      .select(SELECT)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(HISTORY);
    return (data ?? []).map(toMessage).reverse();
  },

  async send(roomId: string, userId: string, body: string) {
    const client = db();
    const text = body.trim().slice(0, MAX_MESSAGE);
    if (!client || !text || !isRemoteId(userId)) return;
    if (!checkLimit(userId, 'chat')) return;
    await client.from('room_messages').insert({ room_id: roomId, user_id: userId, body: text });
  },

  /**
   * Live feed for one room.
   *
   * The INSERT payload carries only the row's own columns, so the sender's name
   * and avatar are not in it. Rather than issue a follow-up select per message,
   * the caller passes the table's members and we resolve the author locally.
   */
  subscribe(roomId: string, onMessage: (message: ChatMessage) => void) {
    const client = db();
    if (!client || !roomId) return () => {};
    const channel = client
      .channel(`room-messages:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => onMessage(toMessage(payload.new)),
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
