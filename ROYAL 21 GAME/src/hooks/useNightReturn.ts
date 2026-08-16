import { useSearchParams } from 'react-router-dom';

/**
 * Reads the `?night=CODE` a scene was opened with when launched from inside a
 * game night, so its own "back" control can return there instead of the hub —
 * without this, finishing a quick game or a hand drops the player out of the
 * night with no way back short of re-entering the URL by hand.
 */
export function useNightReturn(): string | null {
  const [params] = useSearchParams();
  const code = params.get('night');
  return code ? `/night/${code}` : null;
}
