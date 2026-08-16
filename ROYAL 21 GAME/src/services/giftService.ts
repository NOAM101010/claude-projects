import { db, isRemoteId } from './supabase';
import { GIFT_DAILY_LIMIT } from '@/data/economy';

/** Why a gift did not go through, so the UI is never just "something failed". */
export type GiftFailure = 'self' | 'invalid-amount' | 'limit' | 'insufficient' | 'unknown-recipient' | 'not-signed-in' | 'server';

export interface GiftResult {
  ok: boolean;
  balance?: number;
  reason?: GiftFailure;
  detail?: string;
}

const classify = (message: string): GiftFailure => {
  if (message.includes('cannot gift yourself')) return 'self';
  if (message.includes('invalid amount')) return 'invalid-amount';
  if (message.includes('daily gift limit')) return 'limit';
  if (message.includes('insufficient')) return 'insufficient';
  if (message.includes('unknown recipient')) return 'unknown-recipient';
  return 'server';
};

export const giftService = {
  /**
   * Moves chips to a friend in one server transaction (send_gift() in
   * supabase/setup.sql) — the daily cap is enforced there, never trusted
   * from the client, the same way buy_item() never trusts a client price.
   */
  async send(toId: string, amount: number, message?: string): Promise<GiftResult> {
    const client = db();
    if (!client || !isRemoteId(toId)) return { ok: false, reason: 'not-signed-in' };

    const { data, error } = await client.rpc('send_gift', {
      p_to_id: toId,
      p_amount: amount,
      p_message: message?.trim() || null,
    });
    if (error) return { ok: false, reason: classify(error.message ?? ''), detail: error.message };
    if (data === null || data === undefined) return { ok: false, reason: 'not-signed-in' };
    return { ok: true, balance: typeof data === 'number' ? data : undefined };
  },

  /** Sum of what this player has already sent today, so the UI can show "X/500 left". */
  async sentToday(userId: string): Promise<number> {
    const client = db();
    if (!client || !isRemoteId(userId)) return 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await client
      .from('chip_gifts')
      .select('amount')
      .eq('from_id', userId)
      .gte('created_at', startOfDay.toISOString());
    return (data ?? []).reduce((sum: number, row: { amount: number }) => sum + row.amount, 0);
  },

  remaining(sentToday: number) {
    return Math.max(0, GIFT_DAILY_LIMIT - sentToday);
  },
};
