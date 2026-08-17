import { db } from './supabase';
import { createState, reduce } from '@/games/roulette/engine';
import type { RouletteAction, RouletteState } from '@/games/roulette/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer Roulette sync — same authority model as Blackjack's:
 * the host runs the pure engine and is the only client that writes
 * `rooms.state`; everyone else sends intents into `room_actions`.
 *
 * Chips settle client-side, like the other quick games (coin flip, high
 * card, slots) — there is no server-verified payout RPC for Roulette.
 */
export const rouletteService = {
  async loadState(roomId: string): Promise<RouletteState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as RouletteState) ?? null;
  },

  async publish(roomId: string, state: RouletteState) {
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
  async sendAction(roomId: string, userId: string, action: RouletteAction): Promise<boolean> {
    const client = db();
    if (!client) return false;
    if (!checkLimit(userId, 'gameAction')) return false;
    const { error } = await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
    return !error;
  },

  /** Every client watches the authoritative state row. */
  subscribeState(roomId: string, onState: (state: RouletteState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`rl-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: RouletteState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Host loop: consume incoming intents, run them through the reducer, publish. */
  runHost(roomId: string, getState: () => RouletteState, setState: (state: RouletteState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`rl-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: RouletteAction };
          const incoming = { ...row.action, userId: row.user_id } as RouletteAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await rouletteService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
