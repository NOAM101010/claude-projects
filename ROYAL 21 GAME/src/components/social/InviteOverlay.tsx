import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from './Avatar';
import { useSocial } from '@/stores/useSocial';
import { useT } from '@/hooks/useT';
import { useSound } from '@/hooks/useSound';

/** An invite lands as a real moment, not a browser alert (§37, §104). */
export function InviteOverlay() {
  const invite = useSocial((s) => s.pendingInvite);
  const setInvite = useSocial((s) => s.setInvite);
  const { t } = useT();
  const navigate = useNavigate();
  const { play } = useSound();

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          className="fixed inset-x-0 z-[520] flex justify-center px-4"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
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
            <GameButton size="sm" tone="ghost" onClick={() => { play('back'); setInvite(null); }}>
              {t('friends.decline')}
            </GameButton>
            <GameButton size="sm" tone="gold" onClick={() => {
              play('friendJoin');
              setInvite(null);
              // A game-night invite has its own scene; poker has its own table; anything else is a room.
              navigate(
                invite.game === 'night' ? `/night/${invite.code}`
                  : invite.game === 'sng' ? `/poker/sng/${invite.code}`
                    : invite.game === 'poker' ? `/poker/${invite.code}`
                      : `/room/${invite.code}`,
              );
            }}>
              {t('friends.accept')}
            </GameButton>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
