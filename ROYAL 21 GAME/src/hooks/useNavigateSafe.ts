import { useCallback } from 'react';
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';
import { useUI } from '@/stores/useUI';
import { useT } from './useT';

/** Route prefixes where a player is actively "in a game" — leaving them without
 *  a confirmation used to freeze the scene mid-hand or drop the player out of
 *  a live round with no warning. */
const IN_GAME_PREFIXES = [
  '/poker',
  '/blackjack/room',
  '/blackjack/duel',
  '/night',
  '/game/roulette',
];

export function isInGamePath(pathname: string): boolean {
  return IN_GAME_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Drop-in replacement for `useNavigate()` that pauses on an "are you sure?"
 * prompt whenever the current route is inside a live game. Same signature as
 * react-router's `navigate()`: `nav(to, options?)` or `nav(-1)`.
 *
 * Passing `{ force: true }` in options skips the confirm — used by the game's
 * own cash-out / exit flows that already know the user meant it.
 */
export function useNavigateSafe() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();
  const confirm = useUI((s) => s.confirm);

  return useCallback(
    (to: string | number, options?: NavigateOptions & { force?: boolean }) => {
      const doNavigate = () => {
        if (typeof to === 'number') navigate(to);
        else navigate(to, options);
      };
      if (options?.force || !isInGamePath(location.pathname)) {
        doNavigate();
        return;
      }
      confirm({
        title: t('common.leaveGameTitle'),
        body: t('common.leaveGameBody'),
        confirmLabel: t('common.leaveGameConfirm'),
        cancelLabel: t('common.stayInGame'),
        tone: 'danger',
        onConfirm: doNavigate,
      });
    },
    [navigate, location.pathname, confirm, t],
  );
}
