import { db } from './supabase';
import { createState, reduce } from '@/games/blackjack/engine';
import type { BjAction, BjState } from '@/games/blackjack/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer Blackjack sync.
 *
 * Authority model:
 *  - The room host runs the pure engine and is the only client allowed to write
 *    `rooms.state` (enforced by RLS, not by trust).
 *  - Everyone else sends intents into `room_actions`; the host validates them
 *    through the same reducer and publishes the next state.
 *  - Chips move through the `claim_blackjack_payout` RPC, which recomputes the
 *    payout from the stored hand server-side — a client cannot invent a win.
 */
export const blackjackService = {
  async loadState(roomId: string): Promise<BjState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as BjState) ?? null;
  },

  async publish(roomId: string, state: BjState) {
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
  async sendAction(roomId: string, userId: string, action: BjAction) {
    const client = db();
    if (!client) return;
    if (!checkLimit(userId, 'gameAction')) return;
    await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
  },

  /** Every client watches the authoritative state row. */
  subscribeState(roomId: string, onState: (state: BjState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`bj-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: BjState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /**
   * Host loop: consume incoming intents, run them through the reducer, publish.
   * Returns an unsubscribe function.
   */
  runHost(roomId: string, getState: () => BjState, setState: (state: BjState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`bj-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: BjAction };
          const incoming = { ...row.action, userId: row.user_id } as BjAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await blackjackService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Server-verified payout. Returns the player's new chip balance. */
  async claimPayout(roomId: string, round: number): Promise<number | null> {
    const client = db();
    if (!client) return null;
    const { data, error } = await client.rpc('claim_blackjack_payout', { p_room_id: roomId, p_round: round });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  },
};
