import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useSocial } from '@/stores/useSocial';
import { useT } from '@/hooks/useT';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { useSound } from '@/hooks/useSound';
import { useNavigateSafe } from '@/hooks/useNavigateSafe';

const RAIL = 62;
const OPEN = 214;

interface Entry {
  icon: string;
  labelKey: string;
  hintKey: string;
  /** Route to push, or a panel to open instead. */
  to?: string;
  panel?: 'friends' | 'notifications';
  /** Marks the start of a new group in the rail. */
  divide?: boolean;
  /** Only drawn for an account the server has flagged as an admin. */
  adminOnly?: boolean;
}

const ENTRIES: Entry[] = [
  { icon: '🏠', labelKey: 'nav.hub', hintKey: 'nav.hubHint', to: '/hub' },
  { icon: '♠', labelKey: 'nav.blackjack', hintKey: 'nav.blackjackHint', to: '/blackjack/solo', divide: true },
  { icon: '⚔', labelKey: 'nav.duel', hintKey: 'nav.duelHint', to: '/room/new?game=duel' },
  { icon: '🎉', labelKey: 'nav.gameNight', hintKey: 'nav.gameNightHint', to: '/night/new' },
  { icon: '🎰', labelKey: 'nav.slots', hintKey: 'nav.slotsHint', to: '/game/slots', divide: true },
  { icon: '🪙', labelKey: 'nav.coinflip', hintKey: 'nav.coinflipHint', to: '/game/coinflip' },
  { icon: '🂡', labelKey: 'nav.highcard', hintKey: 'nav.highcardHint', to: '/game/highcard' },
  { icon: '🎫', labelKey: 'nav.scratch', hintKey: 'nav.scratchHint', to: '/game/scratch' },
  { icon: '👥', labelKey: 'nav.friends', hintKey: 'nav.friendsHint', panel: 'friends', divide: true },
  { icon: '🏛', labelKey: 'nav.vault', hintKey: 'nav.vaultHint', to: '/vault' },
  { icon: '🎒', labelKey: 'nav.inventory', hintKey: 'nav.inventoryHint', to: '/inventory' },
  { icon: '🚪', labelKey: 'nav.myRoom', hintKey: 'nav.myRoomHint', to: '/profile/me' },
  { icon: '⚙️', labelKey: 'nav.settings', hintKey: 'nav.settingsHint', to: '/settings', divide: true },
  { icon: '🛠', labelKey: 'nav.admin', hintKey: 'nav.adminHint', to: '/admin', adminOnly: true },
];

/**
 * The side menu: one reachable list of every room in the game.
 *
 * Desktop keeps a slim icon rail that widens on hover, so the world stays the
 * hero but nothing is more than one click away. Compact screens get the same
 * list as a drawer behind the HUD's menu button.
 */
export function SideNav() {
  const navigate = useNavigateSafe();
  const location = useLocation();
  const { t } = useT();
  const compact = useIsCompact();
  const { play } = useSound();
  const profileId = usePlayer((s) => s.profile.id);
  const isAdmin = usePlayer((s) => Boolean(s.profile.isAdmin));
  const navOpen = useUI((s) => s.navOpen);
  const setNavOpen = useUI((s) => s.setNavOpen);
  const openPanel = useUI((s) => s.openPanel);
  const requests = useSocial((s) => s.requests.length);
  const [hovered, setHovered] = useState(false);

  /* A route change closes the drawer; leaving it open over the new scene reads
     as a bug on a phone. */
  useEffect(() => { setNavOpen(false); }, [location.pathname, setNavOpen]);

  useEffect(() => {
    if (!compact || !navOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact, navOpen, setNavOpen]);

  if (!profileId) return null;

  const expanded = compact ? true : hovered;

  const go = (entry: Entry) => {
    play('click', 'tap');
    if (entry.panel) { openPanel(entry.panel); setNavOpen(false); return; }
    if (!entry.to) return;
    navigate(entry.to === '/profile/me' ? `/profile/${profileId}` : entry.to);
  };

  const isActive = (entry: Entry) => {
    if (!entry.to) return false;
    const path = entry.to === '/profile/me' ? `/profile/${profileId}` : entry.to.split('?')[0];
    return location.pathname === path;
  };

  const list = (
    <nav
      className="flex flex-col gap-1 py-3 px-2 h-full overflow-y-auto"
      aria-label={t('nav.title')}
    >
      {ENTRIES.filter((entry) => !entry.adminOnly || isAdmin).map((entry) => {
        const active = isActive(entry);
        return (
          <div key={entry.labelKey}>
            {entry.divide && <div className="my-1.5 mx-2 h-px" style={{ background: 'var(--glass-line)' }} />}
            <button
              className="relative w-full flex items-center gap-3 rounded-[var(--r-sm)] px-2.5 py-2 press"
              style={{
                background: active ? 'linear-gradient(180deg, rgba(227,178,60,.16), rgba(227,178,60,.04))' : 'transparent',
                border: `1px solid ${active ? 'var(--gold-line)' : 'transparent'}`,
                color: active ? 'var(--gold-hi)' : 'var(--text)',
              }}
              onClick={() => go(entry)}
              title={expanded ? undefined : t(entry.labelKey)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="grid place-items-center text-[17px] shrink-0" style={{ width: 26 }}>{entry.icon}</span>
              {entry.panel === 'friends' && !!requests && (
                <span
                  className="absolute top-1 grid place-items-center rounded-full text-[9px] font-black"
                  style={{ insetInlineStart: 24, width: 15, height: 15, background: 'var(--crimson)', color: '#fff' }}
                >
                  {requests}
                </span>
              )}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.span
                    className="text-start overflow-hidden whitespace-nowrap"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <b className="block text-[13px] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                      {t(entry.labelKey)}
                    </b>
                    <span className="block text-[10.5px] leading-tight" style={{ color: 'var(--dim)' }}>
                      {t(entry.hintKey)}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        );
      })}
    </nav>
  );

  if (compact) {
    return (
      <AnimatePresence>
        {navOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(4,5,7,.62)', backdropFilter: 'blur(3px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNavOpen(false)}
            />
            <motion.aside
              className="fixed top-0 bottom-0 z-[61] glass"
              style={{
                insetInlineStart: 0,
                width: OPEN,
                borderRadius: 0,
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'var(--safe-b)',
              }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              /* RTL flips the drawer to the right edge automatically via
                 insetInlineStart; the transform is mirrored by dir=rtl. */
            >
              {list}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.aside
      className="fixed z-[45] glass hidden md:block"
      style={{
        insetInlineStart: 8,
        top: 'calc(var(--hud-h) + 14px)',
        bottom: 14,
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
      animate={{ width: expanded ? OPEN : RAIL }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {list}
    </motion.aside>
  );
}
