import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRoom } from '@/stores/useRoom';
import { usePlayer } from '@/stores/usePlayer';
import { isOnline } from '@/services/supabase';
import type { Outcome } from '@/games/blackjack/types';

/**
 * Lets a solo table (slots, coin flip, high card, scratch) contribute its own
 * round results to a Night's shared scoreboard when opened via `?night=CODE`.
 * Reuses the same global room connection Night/Blackjack already share — a
 * `reportResult` action just appends a tagged history entry, no seat needed,
 * so this never turns the solo game into a synced multiplayer table.
 */
export function useNightScoring(game: string) {
  const [params] = useSearchParams();
  const nightCode = params.get('night');
  const profile = usePlayer((s) => s.profile);
  const room = useRoom((s) => s.room);
  const send = useRoom((s) => s.send);
  const joinByCode = useRoom((s) => s.joinByCode);
  const booting = useRef(false);

  useEffect(() => {
    if (!nightCode || !isOnline()) return;
    if (room?.code === nightCode) return;
    if (booting.current) return;
    booting.current = true;
    void joinByCode(nightCode, profile.id).finally(() => { booting.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightCode, room?.code, profile.id]);

  return (outcome: Outcome, net: number) => {
    if (!nightCode || room?.code !== nightCode) return;
    void send(profile.id, { type: 'reportResult', userId: profile.id, username: profile.username, game, outcome, net });
  };
}
