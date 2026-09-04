import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsService } from '@/services/roomsService';
import type { ActiveGame } from '@/types';
import { audio } from '@/audio/AudioManager';

/**
 * Watches a room's `active_game` pointer (`rooms.active_game`, set by
 * `roomsService.setActiveGame`) and auto-navigates every client — host
 * included — into whatever game got picked. This is the "pull everyone in"
 * mechanism a room needs the moment more than one client can be sitting in
 * its lobby: without it, only whoever clicked "start" ever leaves the lobby.
 *
 * `urlFor` maps the pointer to a route; returning null means "don't navigate"
 * (e.g. an unrecognised game key). `sessionStorage` (per-tab, keyed by room
 * code) remembers the pointer this tab already acted on, so coming back to
 * the lobby while the pointer is still live doesn't bounce you straight back
 * into the game.
 *
 * `initialActiveGame` seeds the pointer from the room row this client already
 * fetched on connect (`create`/`byCode`) — without it, a player who joins
 * *after* the host already started wouldn't see the postgres UPDATE that set
 * the pointer (it fired before this hook subscribed) and would be stuck.
 */
export function useFollowHost(
  roomId: string | undefined,
  roomCode: string | undefined,
  urlFor: (activeGame: ActiveGame) => string | null,
  initialActiveGame?: ActiveGame | null,
) {
  const navigate = useNavigate();
  const [activeGame, setActiveGameState] = useState<ActiveGame | null>(initialActiveGame ?? null);
  const handled = useRef<string | null>(null);
  const storageKey = roomCode ? `follow-host:${roomCode}` : null;

  /* Re-seed whenever the room we're watching changes (a fresh connect). */
  useEffect(() => {
    setActiveGameState(initialActiveGame ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    return roomsService.subscribeActiveGame(roomId, setActiveGameState);
  }, [roomId]);

  useEffect(() => {
    if (!activeGame?.game || !storageKey) return;
    const key = `${activeGame.game}:${activeGame.code}`;
    if (handled.current === key || sessionStorage.getItem(storageKey) === key) return;
    handled.current = key;
    sessionStorage.setItem(storageKey, key);
    const url = urlFor(activeGame);
    if (url) {
      audio.play('door');
      navigate(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame?.game, activeGame?.code, storageKey]);

  return { activeGame };
}
