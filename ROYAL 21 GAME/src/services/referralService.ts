import { db, isRemoteId } from './supabase';

/**
 * Friend referral bonuses.
 *
 * Flow:
 *   1. A user copies their invite link — `/?ref=<userId>` — and shares it.
 *   2. A guest who opens the link has the ref stashed in localStorage.
 *   3. After they finish signing in, `attemptClaim()` calls the RPC.
 *   4. The RPC credits both sides 500 chips and records the referral so
 *      it cannot be claimed twice.
 *
 * The anti-abuse rail is server-side: the referee's auth account must be
 * less than 24 hours old, so no one can burn a URL months later.
 */

const STORAGE_KEY = 'royal21.ref';

/** Read the ?ref= param on the current page and, if present, remember it. */
export function captureRefFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (!ref) return getPendingRef();
    // Only accept UUID-shaped refs to avoid junk writes to localStorage.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
      return null;
    }
    localStorage.setItem(STORAGE_KEY, ref);
    // Remove ref param from URL so it doesn't stick around
    url.searchParams.delete('ref');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return ref;
  } catch {
    return null;
  }
}

export function getPendingRef(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingRef() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export const referralService = {
  /**
   * If we have a stashed referral and the current user is signed in, try
   * to claim it. Idempotent: server rejects a second claim for the same
   * referee. Always clears the pending ref on success so we don't spin.
   */
  async attemptClaim(userId: string): Promise<{ ok: boolean; bonusChips?: number; reason?: string }> {
    const client = db();
    if (!client || !isRemoteId(userId)) return { ok: false, reason: 'not-signed-in' };

    const ref = getPendingRef();
    if (!ref) return { ok: false, reason: 'no-pending-ref' };

    // Refuse self-referral client-side too, saves a round trip
    if (ref === userId) {
      clearPendingRef();
      return { ok: false, reason: 'self-referral' };
    }

    const { data, error } = await client.rpc('claim_referral', { p_referrer_id: ref });
    if (error) return { ok: false, reason: error.message };

    const result = data as { ok: boolean; bonus_chips?: number; reason?: string };
    // Clear on any resolved outcome — success or "already-claimed" both mean
    // there is nothing left to try.
    if (result.ok || ['already-claimed', 'account-too-old', 'invalid-referrer', 'self-referral'].includes(result.reason ?? '')) {
      clearPendingRef();
    }
    return {
      ok: result.ok,
      bonusChips: result.bonus_chips,
      reason: result.reason,
    };
  },

  /**
   * Once the referred friend reaches level 5, both sides earn a second bonus.
   * The referee's client calls this; the RPC checks their own level + guard.
   * Idempotent — a repeat call is a no-op.
   */
  async claimStage2(userId: string): Promise<{ ok: boolean; bonusChips?: number }> {
    const client = db();
    if (!client || !isRemoteId(userId)) return { ok: false };
    const { data, error } = await client.rpc('claim_referral_stage2');
    if (error || !data) return { ok: false };
    const r = data as { ok: boolean; bonus_chips?: number };
    return { ok: r.ok, bonusChips: r.bonus_chips };
  },

  /**
   * The referrer collects their next tier reward (after their 1st / 2nd / 3rd
   * completed referral). The RPC counts referrals and bumps the tier atomically.
   */
  async claimReferrerTier(userId: string): Promise<{ ok: boolean; bonusChips?: number; tier?: number }> {
    const client = db();
    if (!client || !isRemoteId(userId)) return { ok: false };
    const { data, error } = await client.rpc('claim_referrer_tier');
    if (error || !data) return { ok: false };
    const r = data as { ok: boolean; bonus_chips?: number; tier?: number };
    return { ok: r.ok, bonusChips: r.bonus_chips, tier: r.tier };
  },

  /** How many people this user has invited, chips earned, and tier progress. */
  async stats(userId: string): Promise<{ count: number; chipsEarned: number; tier: number }> {
    const client = db();
    if (!client || !isRemoteId(userId)) return { count: 0, chipsEarned: 0, tier: 0 };
    const { data } = await client
      .from('referral_stats')
      .select('referred_count, chips_earned')
      .eq('user_id', userId)
      .maybeSingle();
    const { data: prof } = await client
      .from('profiles')
      .select('referrer_tier')
      .eq('id', userId)
      .maybeSingle();
    return {
      count: data?.referred_count ?? 0,
      chipsEarned: data?.chips_earned ?? 0,
      tier: prof?.referrer_tier ?? 0,
    };
  },

  /** Build a shareable invite link. */
  inviteLink(userId: string): string {
    return `${window.location.origin}/?ref=${userId}`;
  },
};
