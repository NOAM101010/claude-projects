import { db, isRemoteId } from './supabase';
import { ITEMS, itemById } from '@/data/items';
import type { ShopItem } from '@/types';

/** Why a purchase did not go through, so the button is never silently dead. */
export type BuyFailure = 'unknown-item' | 'insufficient' | 'not-signed-in' | 'server';

export interface BuyResult {
  ok: boolean;
  chips?: number;
  reason?: BuyFailure;
  /** Raw message from Postgres, for the toast when nothing else explains it. */
  detail?: string;
}

export const shopService = {
  catalogue(): ShopItem[] {
    return ITEMS;
  },

  async ownedIds(userId: string): Promise<string[] | null> {
    const client = db();
    if (!client || !isRemoteId(userId)) return null;
    const { data } = await client.from('user_items').select('item_id').eq('user_id', userId);
    return (data ?? []).map((row) => row.item_id as string);
  },

  /**
   * Purchase is a single server-side transaction: it checks the price against
   * the catalogue, checks the balance and grants the item — so a client cannot
   * hand itself a Mythic for free.
   *
   * `dailyRarityOnly` is a *display* flag (keeps an item in the daily
   * rare-rotation slot and out of the normal grid) — it is NOT a persistence
   * flag. Every purchasable item, including these, is a real row in
   * public.items and persists through buy_item into user_items. Short-circuiting
   * the RPC here is what used to lose the 30k–75k coins on the next sign-out.
   */
  async buy(userId: string, itemId: string): Promise<BuyResult> {
    const item = itemById(itemId);
    if (!item) return { ok: false, reason: 'unknown-item' };
    const client = db();
    // Device-local players own their catalogue locally; nothing to charge server-side.
    if (!client || !isRemoteId(userId)) return { ok: true };

    const { data, error } = await client.rpc('buy_item', { p_item_id: itemId });
    if (error) {
      // buy_item() raises these by name; anything else is a genuine server fault.
      const message = error.message ?? '';
      if (message.includes('insufficient')) return { ok: false, reason: 'insufficient', detail: message };
      if (message.includes('unknown item')) return { ok: false, reason: 'unknown-item', detail: message };
      return { ok: false, reason: 'server', detail: message };
    }

    /* A null balance means the row was never touched — almost always an expired
       session, where auth.uid() is null and the UPDATE matches nothing. Treating
       that as success used to spend the chips locally and lose the item on the
       next load. */
    if (data === null || data === undefined) return { ok: false, reason: 'not-signed-in' };
    return { ok: true, chips: typeof data === 'number' ? data : undefined };
  },

  async toggleFavorite(userId: string, itemId: string, favorite: boolean) {
    const client = db();
    if (!client || !isRemoteId(userId)) return;
    await client.from('user_items').update({ favorite }).eq('user_id', userId).eq('item_id', itemId);
  },

  /**
   * Migrate ownership of a premium coin the player bought before it was a real
   * server item. The RPC never charges and is hard-limited server-side to the
   * six coin ids, so it can't be abused to grant arbitrary items. Best-effort:
   * if the migration SQL hasn't been run yet the RPC is missing and this is a
   * no-op — the local copy still shows until then.
   */
  async grantOwned(userId: string, itemId: string): Promise<boolean> {
    const client = db();
    if (!client || !isRemoteId(userId)) return false;
    const { data, error } = await client.rpc('grant_owned_item', { p_item_id: itemId });
    if (error) return false;
    return data === true;
  },
};
