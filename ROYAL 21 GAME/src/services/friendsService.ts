import { db, isRemoteId } from './supabase';
import type { Friend, FriendRequest } from '@/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toFriend = (row: any): Friend => ({
  id: row.id,
  username: row.username,
  tag: row.tag ?? '#0000',
  avatar: row.avatar ?? { skin: 0, hair: 0, shirt: 'base' },
  level: row.level ?? 1,
  chips: row.chips ?? 0,
  presence: row.presence ?? 'offline',
  currentGame: row.current_game ?? null,
});

export const friendsService = {
  async list(userId: string): Promise<Friend[]> {
    const client = db();
    if (!client || !isRemoteId(userId)) return [];
    const { data } = await client.from('friendships').select('friend:profiles!friendships_friend_id_fkey(*)').eq('user_id', userId);
    return (data ?? []).map((row: any) => toFriend(row.friend)).filter(Boolean);
  },

  async search(term: string, selfId: string): Promise<Friend[]> {
    const client = db();
    if (!client || !isRemoteId(selfId) || term.trim().length < 2) return [];
    const clean = term.trim().replace('#', '');
    const { data } = await client
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${clean}%,tag.ilike.%${clean}%`)
      .neq('id', selfId)
      .limit(12);
    return (data ?? []).map(toFriend);
  },

  async requests(userId: string): Promise<FriendRequest[]> {
    const client = db();
    if (!client || !isRemoteId(userId)) return [];
    const { data } = await client
      .from('friend_requests')
      .select('id, created_at, from:profiles!friend_requests_from_id_fkey(*)')
      .eq('to_id', userId)
      .eq('status', 'pending');
    return (data ?? []).map((row: any) => ({ id: row.id, createdAt: row.created_at, from: toFriend(row.from) }));
  },

  async sendRequest(fromId: string, toId: string) {
    const client = db();
    if (!client) return;
    await client.from('friend_requests').insert({ from_id: fromId, to_id: toId, status: 'pending' });
    await client.from('notifications').insert({
      user_id: toId, kind: 'friend_request', actor_id: fromId, title: 'friend_request',
    });
  },

  async respond(requestId: string, accept: boolean) {
    const client = db();
    if (!client) return;
    if (!accept) {
      await client.from('friend_requests').update({ status: 'declined' }).eq('id', requestId);
      return;
    }
    // accept_friend_request() writes both directions of the friendship atomically.
    await client.rpc('accept_friend_request', { request_id: requestId });
  },

  async remove(userId: string, friendId: string) {
    const client = db();
    if (!client) return;
    await client.from('friendships').delete().eq('user_id', userId).eq('friend_id', friendId);
    await client.from('friendships').delete().eq('user_id', friendId).eq('friend_id', userId);
  },

  async block(userId: string, blockedId: string) {
    const client = db();
    if (!client) return;
    await this.remove(userId, blockedId);
    await client.from('blocks').insert({ user_id: userId, blocked_id: blockedId });
  },

  /**
   * Opportunistic weekly prize claim: no cron in this project, so any client
   * that opens the leaderboard tries this, and the RPC itself decides whether
   * 7 days have passed and whether the caller is actually #1 among friends.
   */
  async claimWeeklyPrize(userId: string): Promise<{ claimed: boolean; chips?: number; rank?: number; reason?: string }> {
    const client = db();
    if (!client || !isRemoteId(userId)) return { claimed: false };
    const { data, error } = await client.rpc('claim_weekly_prize');
    if (error || !data) return { claimed: false };
    return data as { claimed: boolean; chips?: number; rank?: number; reason?: string };
  },

  /** Live presence updates for the friend panel. */
  subscribe(userId: string, onChange: () => void) {
    const client = db();
    if (!client || !isRemoteId(userId)) return () => {};
    const channel = client
      .channel(`friends:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `to_id=eq.${userId}` }, onChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, onChange)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
