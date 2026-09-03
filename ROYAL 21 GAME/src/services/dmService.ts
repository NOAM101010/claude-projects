import { db, isRemoteId } from './supabase';
import { checkLimit } from '@/lib/rateLimit';
import type { DirectMessage } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toDM = (row: any): DirectMessage => ({
  id: row.id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  body: row.body,
  createdAt: row.created_at,
  readAt: row.read_at ?? null,
});

const SELECT = 'id, sender_id, recipient_id, body, created_at, read_at';

/** Longest message the table will take; the input enforces the same number. */
export const MAX_DM = 240;
/** Messages loaded when a thread opens. */
const HISTORY = 60;

/**
 * 1:1 chat between friends. Same shape as chatService, keyed by the pair of
 * user ids rather than a room. RLS (supabase/direct-messages.sql) enforces that
 * both ends are friends and neither has blocked the other.
 */
export const dmService = {
  async history(meId: string, otherId: string, limit = HISTORY): Promise<DirectMessage[]> {
    const client = db();
    if (!client || !isRemoteId(meId) || !isRemoteId(otherId)) return [];
    const { data } = await client
      .from('direct_messages')
      .select(SELECT)
      .or(`and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(toDM).reverse();
  },

  async send(meId: string, otherId: string, body: string) {
    const client = db();
    const text = body.trim().slice(0, MAX_DM);
    if (!client || !text || !isRemoteId(meId) || !isRemoteId(otherId)) return;
    if (!checkLimit(meId, 'dm')) return;
    await client.from('direct_messages').insert({ sender_id: meId, recipient_id: otherId, body: text });
  },

  /**
   * Live feed for every thread this user is part of. Two filters because
   * postgres_changes takes only one column predicate each — one for messages
   * arriving, one for the echo of what this device just sent (so a second tab
   * of the same account stays in sync).
   */
  subscribe(meId: string, onMessage: (message: DirectMessage) => void) {
    const client = db();
    if (!client || !isRemoteId(meId)) return () => {};
    const channel = client
      .channel(`dm:${meId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${meId}` },
        (payload) => onMessage(toDM(payload.new)),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${meId}` },
        (payload) => onMessage(toDM(payload.new)),
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  async markRead(meId: string, otherId: string) {
    const client = db();
    if (!client || !isRemoteId(meId) || !isRemoteId(otherId)) return;
    await client.rpc('mark_dm_read', { p_other: otherId });
  },

  /** `{ [friendId]: unreadCount }` — messages sent to me I have not opened. */
  async unreadCounts(meId: string): Promise<Record<string, number>> {
    const client = db();
    if (!client || !isRemoteId(meId)) return {};
    const { data } = await client
      .from('direct_messages')
      .select('sender_id')
      .eq('recipient_id', meId)
      .is('read_at', null);
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { sender_id: string }[]) {
      counts[row.sender_id] = (counts[row.sender_id] ?? 0) + 1;
    }
    return counts;
  },
};
