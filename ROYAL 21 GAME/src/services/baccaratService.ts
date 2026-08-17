import { db } from './supabase';
import { createState, reduce } from '@/games/baccarat/engine';
import type { BaccaratAction, BaccaratState } from '@/games/baccarat/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer Baccarat sync — same authority model as Roulette. Everyone
 * shares one hand; each seat's bets and payouts are per-player.
 */
export const baccaratService = {
  async loadState(roomId: string): Promise<BaccaratState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as BaccaratState) ?? null;
  },

  async publish(roomId: string, state: BaccaratState) {
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

  async sendAction(roomId: string, userId: string, action: BaccaratAction): Promise<boolean> {
    const client = db();
    if (!client) return false;
    if (!checkLimit(userId, 'gameAction')) return false;
    const { error } = await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
    return !error;
  },

  subscribeState(roomId: string, onState: (state: BaccaratState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`bc-state:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const next = (payload.new as { state: BaccaratState | null }).state;
          if (next) onState(next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  runHost(roomId: string, getState: () => BaccaratState, setState: (state: BaccaratState) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`bc-actions:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_actions', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const row = payload.new as { user_id: string; action: BaccaratAction };
          const incoming = { ...row.action, userId: row.user_id } as BaccaratAction;
          const next = reduce(getState(), incoming);
          setState(next);
          await baccaratService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
