import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useT } from '@/hooks/useT';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { useSound } from '@/hooks/useSound';
import { useNavigateSafe } from '@/hooks/useNavigateSafe';

/** Scenes that are already home, or that own their own exit. */
const HIDDEN_ON = ['/', '/hub', '/login'];

/**
 * The way home, present in every scene.
 *
 * The hub is the only place the game returns to, so this always goes to `/hub`
 * rather than walking history — after a few games `history.back()` lands
 * somewhere arbitrary, which is exactly the trap this button exists to avoid.
 */
export function BackButton() {
  const navigate = useNavigateSafe();
  const location = useLocation();
  const { t } = useT();
  const compact = useIsCompact();
  const { play } = useSound();

  if (HIDDEN_ON.includes(location.pathname)) return null;

  /* A game opened from inside a game night (`?night=CODE`) goes back to that
     night's lobby instead of the hub — otherwise finishing a hand and tapping
     the one "home" affordance every scene has silently drops the player out
     of the night with no way back short of re-entering the URL by hand. */
  const nightCode = new URLSearchParams(location.search).get('night');
  const target = nightCode ? `/night/${nightCode}` : '/hub';
  const label = nightCode ? t('night.backToNight') : t('nav.backHome');

  return (
    <motion.button
      className="fixed z-[46] flex items-center gap-2 px-3.5 py-2 glass press"
      style={{
        insetInlineStart: compact ? '50%' : 'calc(62px + 22px)',
        transform: compact ? 'translateX(-50%)' : undefined,
        bottom: `calc(14px + var(--safe-b))`,
        borderRadius: 999,
        borderColor: 'var(--gold-line)',
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => { play('click', 'tap'); navigate(target); }}
      aria-label={label}
    >
      <span className="text-[15px] leading-none">{nightCode ? '🎉' : '🏠'}</span>
      <b className="text-[12.5px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-hi)' }}>
        {label}
      </b>
    </motion.button>
  );
}
