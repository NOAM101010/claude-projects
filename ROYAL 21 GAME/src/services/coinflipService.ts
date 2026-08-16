import { db } from './supabase';
import { createState, reduce } from '@/games/coinflip/engine';
import type { CfAction, CfState } from '@/games/coinflip/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer Coin Flip sync — same authority model as Roulette's: the host
 * runs the pure engine and is the only client that writes `rooms.state`;
 * everyone else sends intents into `room_actions`.
 */
export const coinflipService = {
  async loadState(roomId: string): Promise<CfState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as CfState) ?? null;
  },

  async publish(roomId: string, state: CfState) {
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
  async sendAction(roomId: string, userId: string, action: CfAction) {
    const client = db();
    if (!client) return;
    if (!checkLimit(userId, 'gameAction')) return;
    await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
  },

  /** Every client watches the authoritative state row. */
  subscribeState(roomId: string, onState: (state: CfState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`cf-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: CfState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Host loop: consume incoming intents, run them through the reducer, publish. */
  runHost(roomId: string, getState: () => CfState, setState: (state: CfState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`cf-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: CfAction };
          const incoming = { ...row.action, userId: row.user_id } as CfAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await coinflipService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
