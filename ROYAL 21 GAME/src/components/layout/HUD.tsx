import { motion } from 'framer-motion';
import { Avatar } from '@/components/social/Avatar';
import { Meter } from '@/components/ui/Meter';
import { GameButton } from '@/components/ui/GameButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { VipBadge } from '@/components/ui/VipBadge';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { usePlayer } from '@/stores/usePlayer';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { useCountUp } from '@/hooks/useCountUp';
import { xpForLevel } from '@/services/profileService';
import { chipGlyphOf } from '@/components/game/CoinFace';
import { fmt } from '@/lib/format';
import { useNavigateSafe } from '@/hooks/useNavigateSafe';

/**
 * Minimal top bar (§31). The world is still the main navigation, but the menu
 * button and the SideNav rail mean nothing is ever more than one click away.
 */
export function HUD({ compact }: { compact?: boolean }) {
  const navigate = useNavigateSafe();
  const { t } = useT();
  const profile = usePlayer((s) => s.profile);
  const daily = usePlayer((s) => s.daily);
  const openPanel = useUI((s) => s.openPanel);
  const toggleNav = useUI((s) => s.toggleNav);
  const unread = useSocial((s) => s.notifications.filter((n) => !n.read).length);
  const requests = useSocial((s) => s.requests.length);
  const dmUnread = useSocial((s) => Object.values(s.dmUnread).reduce((sum, n) => sum + n, 0));
  const friendsBadge = requests + dmUnread;
  const chips = useCountUp(profile.chips);

  if (!profile.id) return null;

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'linear-gradient(180deg, rgba(8,9,11,.9), rgba(8,9,11,.45) 70%, transparent)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="mx-auto flex items-center gap-2.5 px-3 py-2.5" style={{ maxWidth: 1280 }}>
        <Tooltip label={t('nav.title')} hint={t('nav.menuHint')} side="bottom">
          <GameButton size="sm" tone="ghost" className="md:hidden" onClick={toggleNav} aria-label={t('nav.title')}>
            ☰
          </GameButton>
        </Tooltip>

        <button
          className="flex items-center gap-2.5 rounded-full p-1 pe-3 press"
          onClick={() => navigate(`/profile/${profile.id}`)}
          aria-label={t('profile.title')}
        >
          <Avatar config={profile.avatar} size={38} level={profile.level} frame={profile.equipped.frame} presence="online" id="hud" />
          {!compact && (
            <span className="text-start">
              <b className="block text-[13.5px] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {profile.username}
              </b>
              <span className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold" style={{ color: 'var(--gold)' }}>
                  {t('common.level')} {profile.level}
                </span>
                <VipBadge profile={profile} />
                {daily.day > 0 && <StreakBadge day={daily.day} />}
                {profile.isAdmin && (
                  <span
                    className="px-1.5 rounded-full text-[8.5px] font-black tracking-[.14em]"
                    style={{ background: 'var(--crimson)', color: '#fff' }}
                  >
                    ADMIN
                  </span>
                )}
              </span>
            </span>
          )}
        </button>

        {!compact && (
          <div className="hidden sm:block w-20">
            <Meter value={profile.xp} max={xpForLevel(profile.level)} height={4} />
          </div>
        )}

        <Tooltip label={t('hud.balance')} hint={t('hud.balanceHint')} side="bottom">
        <motion.button
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border mx-auto press"
          style={{
            borderColor: 'var(--gold-line)',
            background: 'linear-gradient(180deg, rgba(227,178,60,.12), rgba(227,178,60,.03))',
          }}
          whileTap={{ scale: 0.96 }}
          onClick={() => openPanel('chips')}
          aria-label={t('hud.balance')}
        >
          <span
            className="grid place-items-center rounded-full text-[11px] font-black"
            style={{ width: 20, height: 20, background: 'var(--brushed-gold)', color: '#4a3a12' }}
          >
            {profile.equipped.currencySkin ? chipGlyphOf(profile.equipped.currencySkin) : '★'}
          </span>
          <b className="num text-[15px]" style={{ fontFamily: 'var(--font-display)' }}>{fmt(chips)}</b>
          <span className="text-[15px] leading-none" style={{ color: 'var(--gold)' }}>+</span>
        </motion.button>
        </Tooltip>

        <Tooltip label={t('friends.title')} hint={t('nav.friendsHint')} side="bottom">
          <GameButton size="sm" tone="ghost" onClick={() => openPanel('friends')} className="relative">
            👥
            {!!friendsBadge && (
              <span className="absolute -top-1 -end-1 w-4 h-4 grid place-items-center rounded-full text-[9px] font-black"
                style={{ background: 'var(--crimson)', color: '#fff' }}>{friendsBadge > 9 ? '9+' : friendsBadge}</span>
            )}
          </GameButton>
        </Tooltip>
        <Tooltip label={t('hud.notifications')} hint={t('nav.notificationsHint')} side="bottom">
          <GameButton size="sm" tone="ghost" onClick={() => openPanel('notifications')} className="relative">
            🔔
            {!!unread && (
              <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--crimson)' }} />
            )}
          </GameButton>
        </Tooltip>
        <Tooltip label={t('settings.title')} hint={t('nav.settingsHint')} side="bottom">
          <GameButton size="sm" tone="ghost" onClick={() => openPanel('settings')}>⚙️</GameButton>
        </Tooltip>
      </div>
    </header>
  );
}
