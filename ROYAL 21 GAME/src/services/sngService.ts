import { db } from './supabase';
import { createTournamentState, reduce } from '@/games/poker/engine';
import type { PokerAction, PokerState } from '@/games/poker/types';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Sit & Go sync — identical transport to the cash poker table (`pokerService`):
 * host runs the pure reducer against `rooms.state`, everyone else's intents go
 * through `room_actions`. The only difference is what seeds the very first
 * state, so this is a thin wrapper rather than a fork.
 */
export const sngService = {
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

  async initIfEmpty(roomId: string, buyIn: number) {
    const existing = await this.loadState(roomId);
    if (existing) return existing;
    const fresh = createTournamentState(Math.floor(Math.random() * 2 ** 31), buyIn);
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
      .channel(`sng-state:${roomId}`)
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
      .channel(`sng-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: PokerAction };
          const incoming = { ...row.action, userId: row.user_id } as PokerAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await sngService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
