import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from './Avatar';
import { useSocial } from '@/stores/useSocial';
import { useUI } from '@/stores/useUI';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { useSound } from '@/hooks/useSound';
import { roomsService } from '@/services/roomsService';
import { analytics } from '@/services/analyticsService';
import { roomRouteFor } from '@/services/lobbyService';
import type { GameKey } from '@/types';

/** An invite lands as a real moment, not a browser alert (§37, §104). */
export function InviteOverlay() {
  const invite = useSocial((s) => s.pendingInvite);
  const setInvite = useSocial((s) => s.setInvite);
  const dismiss = useSocial((s) => s.dismiss);
  const markRead = useSocial((s) => s.markRead);
  const selfId = usePlayer((s) => s.profile.id);
  const toast = useUI((s) => s.toast);
  const { t } = useT();
  const navigate = useNavigate();
  const { play } = useSound();

  const decline = () => {
    play('back');
    setInvite(null);
    void markRead(selfId);
  };

  const accept = async () => {
    if (!invite) return;
    if (!(await roomsService.isLive(invite.code))) {
      // The room is gone / empty — kill the dead invite instead of stranding
      // the player alone at a frozen table.
      void dismiss(invite.id);
      setInvite(null);
      toast(t('notifications.inviteExpired'), 'bad', '⚠');
      return;
    }
    analytics.track('notification_click', { kind: 'invite', surface: 'overlay' });
    play('friendJoin');
    setInvite(null);
    navigate(roomRouteFor((invite.game || 'blackjack') as GameKey, invite.code));
  };

  if (!invite) return null;
  return (
        <motion.div
          className="fixed inset-x-0 z-[520] flex justify-center px-4"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <GlassPanel gold animate={false} className="p-4 w-full max-w-[440px] flex items-center gap-3">
            {invite.from && <Avatar config={invite.from.avatar} size={44} level={invite.from.level} id="invite" />}
            <div className="flex-1 min-w-0">
              <b className="block text-[14px]">
                {t('notifications.invite', {
                  name: invite.from?.username ?? t('common.someone'),
                  game: t(`games.${invite.game}`),
                })}
              </b>
              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                {t('rooms.code')} {invite.code}
              </span>
            </div>
            <GameButton size="sm" tone="ghost" onClick={decline}>
              {t('friends.decline')}
            </GameButton>
            <GameButton size="sm" tone="gold" onClick={() => void accept()}>
              {t('friends.accept')}
            </GameButton>
          </GlassPanel>
        </motion.div>
  );
}
