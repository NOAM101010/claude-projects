import { db } from './supabase';
import { createState, reduce } from '@/games/highcard/engine';
import type { HcAction, HcState } from '@/games/highcard/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer High Card sync — same authority model as Roulette's: the host
 * runs the pure engine and is the only client that writes `rooms.state`;
 * everyone else sends intents into `room_actions`.
 */
export const highcardService = {
  async loadState(roomId: string): Promise<HcState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as HcState) ?? null;
  },

  async publish(roomId: string, state: HcState) {
    const client = db();
    if (!client) return;
    await client.from('rooms').update({ state, updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  async initIfEmpty(roomId: string) {
    const existing = await this.loadState(roomId);
    if (existing) return existing;
    const fresh = createState(newSeed());
    await this.publish(roomId, fresh);
    return fresh;
  },

  /** Players (including the host) push intents here. */
  async sendAction(roomId: string, userId: string, action: HcAction): Promise<boolean> {
    const client = db();
    if (!client) return false;
    if (!checkLimit(userId, 'gameAction')) return false;
    const { error } = await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
    return !error;
  },

  /** Every client watches the authoritative state row. */
  subscribeState(roomId: string, onState: (state: HcState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`hc-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: HcState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Host loop: consume incoming intents, run them through the reducer, publish. */
  runHost(roomId: string, getState: () => HcState, setState: (state: HcState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`hc-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: HcAction };
          const incoming = { ...row.action, userId: row.user_id } as HcAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await highcardService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
