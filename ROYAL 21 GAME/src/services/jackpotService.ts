import { db } from './supabase';

export type JackpotGame = 'slots' | 'poker';

export interface Jackpot {
  game: JackpotGame;
  pool: number;
  lastWonAt: string | null;
  lastWonBy: string | null;
  lastWonAmount: number;
}

export interface JackpotWin {
  id: number;
  userId: string;
  game: JackpotGame;
  amount: number;
  wonAt: string;
}

/**
 * Progressive jackpot — one pool per game (slots, poker).
 *
 * How it works:
 *   • Every qualifying bet calls addContribution(); the RPC adds 1% to the pool.
 *   • When a player hits the win condition (7-7-7 slots, royal flush poker),
 *     the client calls claim(). The RPC atomically:
 *       - reads the current pool
 *       - resets the pool to its seed (default 10,000)
 *       - credits the player's chip balance
 *       - records the win in jackpot_wins
 *
 * The state lives entirely server-side, so every device sees the same pot
 * live via the realtime subscription.
 */
export const jackpotService = {
  async load(game: JackpotGame): Promise<Jackpot | null> {
    const client = db();
    if (!client) return null;
    const { data } = await client
      .from('jackpots')
      .select('game, pool, last_won_at, last_won_by, last_won_amount')
      .eq('game', game)
      .maybeSingle();
    if (!data) return null;
    return {
      game: data.game as JackpotGame,
      pool: Number(data.pool),
      lastWonAt: data.last_won_at,
      lastWonBy: data.last_won_by,
      lastWonAmount: Number(data.last_won_amount ?? 0),
    };
  },

  /** Realtime updates to a jackpot pool. */
  subscribe(game: JackpotGame, onUpdate: (jackpot: Jackpot) => void) {
    const client = db();
    if (!client) return () => {};
    const channel = client
      .channel(`jackpot:${game}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jackpots', filter: `game=eq.${game}` },
        (payload) => {
          const row = payload.new as {
            game: JackpotGame; pool: number;
            last_won_at: string | null; last_won_by: string | null;
            last_won_amount: number;
          };
          onUpdate({
            game: row.game,
            pool: Number(row.pool),
            lastWonAt: row.last_won_at,
            lastWonBy: row.last_won_by,
            lastWonAmount: Number(row.last_won_amount ?? 0),
          });
        },
      )
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },

  /** Contribute part of this bet to the jackpot. Returns the new pool. */
  async addContribution(game: JackpotGame, bet: number): Promise<number | null> {
    const client = db();
    if (!client) return null;
    if (bet <= 0) return null;
    const { data, error } = await client.rpc('add_to_jackpot', {
      p_game: game,
      p_bet: bet,
    });
    if (error) return null;
    return Number(data);
  },

  /** Try to claim the jackpot. Only call after verifying the win condition. */
  async claim(game: JackpotGame): Promise<{ ok: boolean; amount?: number; reason?: string }> {
    const client = db();
    if (!client) return { ok: false, reason: 'offline' };
    const { data, error } = await client.rpc('claim_jackpot', { p_game: game });
    if (error) return { ok: false, reason: error.message };
    const result = data as { ok: boolean; amount?: number; reason?: string };
    return {
      ok: result.ok,
      amount: result.amount ? Number(result.amount) : undefined,
      reason: result.reason,
    };
  },

  /** Recent big jackpot wins (last 10). */
  async recentWins(limit = 10): Promise<JackpotWin[]> {
    const client = db();
    if (!client) return [];
    const { data } = await client
      .from('jackpot_wins')
      .select('id, user_id, game, amount, won_at')
      .order('won_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      game: row.game as JackpotGame,
      amount: Number(row.amount),
      wonAt: row.won_at,
    }));
  },
};
