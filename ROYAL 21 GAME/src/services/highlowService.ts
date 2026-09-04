import { db } from './supabase';
import { createState, reduce } from '@/games/highlow/engine';
import { redactHighLow } from '@/games/highlow/redact';
import type { HlAction, HlState } from '@/games/highlow/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer High / Low Survival sync — same authority model as High Card's:
 * the host runs the pure engine and is the only client that writes `rooms.state`;
 * everyone else sends intents into `room_actions`. The published row is always
 * redacted (open guesses hidden, shoe zeroed) so only the host holds the truth.
 */
export const highlowService = {
  async loadState(roomId: string): Promise<HlState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as HlState) ?? null;
  },

  async publish(roomId: string, state: HlState) {
    const client = db();
    if (!client) return;
    await client.from('rooms').update({ state: redactHighLow(state), updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  async initIfEmpty(roomId: string) {
    const existing = await this.loadState(roomId);
    if (existing) return existing;
    const fresh = createState(newSeed());
    await this.publish(roomId, fresh);
    return fresh;
  },

  /** Players (including the host) push intents here. */
  async sendAction(roomId: string, userId: string, action: HlAction): Promise<boolean> {
    const client = db();
    if (!client) return false;
    if (!checkLimit(userId, 'gameAction')) return false;
    const { error } = await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
    return !error;
  },

  /** Every client watches the authoritative state row. */
  subscribeState(roomId: string, onState: (state: HlState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`hl-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: HlState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Host loop: consume incoming intents, run them through the reducer, publish. */
  runHost(roomId: string, getState: () => HlState, setState: (state: HlState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`hl-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: HlAction };
          const incoming = { ...row.action, userId: row.user_id } as HlAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await highlowService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
