import { db } from './supabase';
import { createState, reduce } from '@/games/poker/engine';
import { redactPokerState, pokerHoleDeals } from '@/games/poker/redact';
import type { Card, PokerAction, PokerState } from '@/games/poker/types';
import { checkLimit } from '@/lib/rateLimit';

/**
 * Multiplayer Texas Hold'em sync — same authority model as Blackjack:
 * the host runs the pure engine and is the only client allowed to write
 * `rooms.state`; everyone else sends intents into `room_actions`, the host
 * validates them through the same reducer and publishes the next state.
 *
 * Card privacy (see supabase/poker-privacy.sql): the host stashes every seat's
 * real hole cards + the RNG secret through `set_poker_private`, then publishes a
 * REDACTED state (no seed/cursor, opponents' holes blanked). Each client reads
 * its own hole back from `poker_hole`. This is gated safe-by-default: until the
 * migration is run the RPC 404s, `holePrivacyAvailable` latches to `false`, and
 * `publish` writes the full state unchanged exactly like before.
 */

/** `undefined` = not probed yet, `true` = migration present, `false` = absent. */
let holePrivacyAvailable: boolean | undefined;

/** A missing-function error means the migration hasn't been run — flip the gate
 *  off. Anything else (network, RLS, transient) must NOT disable privacy. */
function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '404') return true;
  return typeof error.message === 'string' && error.message.toLowerCase().includes('function');
}

export const pokerService = {
  get holePrivacyAvailable() { return holePrivacyAvailable; },

  async loadState(roomId: string): Promise<PokerState | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client.from('rooms').select('state').eq('id', roomId).maybeSingle();
    return (data?.state as PokerState) ?? null;
  },

  /**
   * Host publish. When privacy is available (or not yet ruled out) the host
   * first stashes the hand's private data, then writes a redacted state.
   * On any sign the migration is missing, latch the gate off and fall back to
   * publishing the full state — identical to the pre-privacy behaviour.
   */
  async publish(roomId: string, state: PokerState) {
    const client = db();
    if (!client) return;

    let stashed = holePrivacyAvailable === true;
    if (holePrivacyAvailable !== false) {
      const { error } = await client.rpc('set_poker_private', {
        p_room: roomId,
        p_hand: state.handNumber,
        p_deals: pokerHoleDeals(state),
        p_seed: state.seed,
        p_cursor: state.cursor,
      });
      if (!error) {
        holePrivacyAvailable = true;
        stashed = true;
      } else if (isMissingRpc(error)) {
        holePrivacyAvailable = false;
        stashed = false;
      } else {
        // Transient — keep privacy enabled but don't publish a redacted state
        // this round (that would hide cards the clients can't fetch back yet).
        console.warn('[poker] set_poker_private failed (transient):', error.message);
        stashed = false;
      }
    }

    const payload = stashed ? redactPokerState(state, null) : state;
    await client.from('rooms').update({ state: payload, updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  /** The caller's own hole cards for a hand, read from the privacy table. */
  async loadHole(roomId: string, userId: string): Promise<{ cards: Card[]; handNumber: number } | null> {
    const client = db();
    if (!client || holePrivacyAvailable === false) return null;
    const { data, error } = await client
      .from('poker_hole')
      .select('cards,hand_number')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return { cards: data.cards as Card[], handNumber: data.hand_number as number };
  },

  /** The hand RNG secret — readable only by the current host (RLS). Used by a
   *  promoted host to reconstruct the full engine state mid-hand. */
  async loadHandSecret(roomId: string): Promise<{
    handNumber: number; seed: number; cursor: number; seats: { userId: string; cards: Card[] }[];
  } | null> {
    const client = db();
    if (!client || holePrivacyAvailable === false) return null;
    const { data, error } = await client
      .from('poker_hand_secret')
      .select('hand_number,seed,cursor,seats')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      handNumber: data.hand_number as number,
      seed: Number(data.seed),
      cursor: data.cursor as number,
      seats: (data.seats as { userId: string; cards: Card[] }[]) ?? [],
    };
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
  runHost(roomId: string, getState: () => PokerState, onNext: (next: PokerState) => void) {
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
          onNext(next);
          await pokerService.publish(roomId, next);
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
