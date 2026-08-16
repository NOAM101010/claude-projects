import { useEffect, useState } from 'react';
import { jackpotService, type Jackpot, type JackpotGame } from '@/services/jackpotService';

/** How often to re-read the pool as a fallback for realtime. */
const POLL_INTERVAL_MS = 6000;

/**
 * Live-tracked jackpot pool for a given game.
 *
 * Two paths keep the number fresh:
 *   1. A realtime `postgres_changes` subscription — instant when the table
 *      is in the `supabase_realtime` publication (see jackpot.sql).
 *   2. A slow poll every few seconds — the safety net so this hook still
 *      updates even if realtime is misconfigured or the WebSocket drops.
 *
 * Both feed the same setState; whichever wins the race, the number moves.
 */
export function useJackpot(game: JackpotGame) {
  const [jackpot, setJackpot] = useState<Jackpot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      void jackpotService.load(game).then((j) => {
        if (!cancelled && j) setJackpot(j);
      });
    };

    // 1) Initial load
    refresh();

    // 2) Realtime — fires instantly on any UPDATE
    const unsubscribe = jackpotService.subscribe(game, (next) => {
      if (!cancelled) setJackpot(next);
    });

    // 3) Polling fallback — every few seconds, in case realtime is off
    const poll = setInterval(refresh, POLL_INTERVAL_MS);

    // Also refresh whenever the tab regains focus — cheap and catches any
    // updates that arrived while the page was hidden.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, [game]);

  return jackpot;
}
