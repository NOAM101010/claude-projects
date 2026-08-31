import { db } from './supabase';
import { createState, reduce } from '@/games/blackjack/engine';
import { redactBjState } from '@/games/blackjack/redact';
import type { BjAction, BjState, Card } from '@/games/blackjack/types';
import { newSeed } from '@/lib/random';
import { checkLimit } from '@/lib/rateLimit';

/** `undefined` = not probed, `true` = bj-privacy migration present, `false` = absent. */
let bjPrivacyAvailable: boolean | undefined;

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '404') return true;
  return typeof error.message === 'string' && error.message.toLowerCase().includes('function');
}

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
  get bjPrivacyAvailable() { return bjPrivacyAvailable; },

  async loadState(roomId: string): Promise<BjState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as BjState) ?? null;
  },

  /**
   * Host publish. When privacy is available the host stashes the shoe secret +
   * dealer hole through `set_bj_private`, then writes a redacted state (no
   * seed/cursor, dealer hole blanked). Gated safe-by-default: until the
   * migration is run the RPC 404s, `bjPrivacyAvailable` latches to `false`, and
   * this writes the full state unchanged exactly like before.
   */
  async publish(roomId: string, state: BjState) {
    const client = db();
    if (!client) return;

    let stashed = bjPrivacyAvailable === true;
    if (bjPrivacyAvailable !== false) {
      const hole = state.dealer.hidden && state.dealer.cards.length >= 2 ? state.dealer.cards[1] : null;
      const { error } = await client.rpc('set_bj_private', {
        p_room: roomId,
        p_round: state.round,
        p_seed: state.seed,
        p_cursor: state.cursor,
        p_hole: hole,
      });
      if (!error) { bjPrivacyAvailable = true; stashed = true; }
      else if (isMissingRpc(error)) { bjPrivacyAvailable = false; stashed = false; }
      else { console.warn('[bj] set_bj_private failed (transient):', error.message); stashed = false; }
    }

    const payload = stashed ? redactBjState(state) : state;
    await client.from('rooms').update({ state: payload, updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  /** The shoe secret for the current round — readable only by the current host
   *  (RLS). Lets a promoted host rebuild the full engine state mid-round. */
  async loadHandSecret(roomId: string): Promise<{ round: number; seed: number; cursor: number; dealerHole: Card | null } | null> {
    const client = db();
    if (!client || bjPrivacyAvailable === false) return null;
    const { data, error } = await client
      .from('bj_hand_secret')
      .select('round,seed,cursor,dealer_hole')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      round: data.round as number,
      seed: Number(data.seed),
      cursor: data.cursor as number,
      dealerHole: (data.dealer_hole as Card | null) ?? null,
    };
  },

  async initIfEmpty(roomId: string) {
    const existing = await this.loadState(roomId);
    if (existing) return existing;
    const fresh = createState(newSeed());
    await this.publish(roomId, fresh);
    return fresh;
  },

  /** Players (including the host) push intents here. */
  async sendAction(roomId: string, userId: string, action: BjAction): Promise<boolean> {
    const client = db();
    if (!client) return false;
    if (!checkLimit(userId, 'gameAction')) return false;
    const { error } = await client.from('room_actions').insert({ room_id: roomId, user_id: userId, action });
    return !error;
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
