import { db } from './supabase';
import { createState, reduce } from '@/games/poker/engine';
import type { PokerAction, PokerState } from '@/games/poker/types';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer Texas Hold'em sync — same authority model as Blackjack:
 * the host runs the pure engine and is the only client allowed to write
 * `rooms.state`; everyone else sends intents into `room_actions`, the host
 * validates them through the same reducer and publishes the next state.
 */
export const pokerService = {
  async loadState(roomId: string): Promise<PokerState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as PokerState) ?? null;
  },

  async publish(roomId: string, state: PokerState) {
    const client = db();
    if (!client) return;
    await client.from('rooms').update({ state, updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  async initIfEmpty(roomId: string, sb: number, bb: number) {
    const existing = await this.loadState(roomId);
    if (existing) return existing;
    const fresh = createState(Math.floor(Math.random() * 2 ** 31), sb, bb);
    await this.publish(roomId, fresh);
    return fresh;
  },

  async sendAction(roomId: string, userId: string, action: PokerAction) {
    const client = db();
    if (!client) return;
    if (!checkLimit(userId, 'gameAction')) return;
    await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
  },

  subscribeState(roomId: string, onState: (state: PokerState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`poker-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: PokerState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Host loop: consume incoming intents, run them through the reducer, publish. */
  runHost(roomId: string, getState: () => PokerState, setState: (state: PokerState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`poker-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: PokerAction };
          const incoming = { ...row.action, userId: row.user_id } as PokerAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await pokerService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
