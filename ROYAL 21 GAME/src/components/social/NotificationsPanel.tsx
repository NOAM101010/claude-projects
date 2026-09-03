import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { GameButton } from '@/components/ui/GameButton';
import { useUI } from '@/stores/useUI';
import { useSocial } from '@/stores/useSocial';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { roomRouteFor } from '@/services/lobbyService';
import { roomsService } from '@/services/roomsService';
import { analytics } from '@/services/analyticsService';
import { fmt } from '@/lib/format';
import type { AppNotification, Friend, GameKey } from '@/types';

const icons: Record<string, string> = {
  friend_request: '👋', invite: '🎮', reward: '🎁', level: '🎖️', achievement: '🏆', system: '◆', gift: '🎁',
  podium_prize: '🏆',
};

/**
 * `notification.title` is really an internal event key (invite/accepted/
 * gift_received/milestone_reward/friend_request), not display text — the
 * server never localizes it. This resolves the real message client-side.
 */
function describe(n: AppNotification, friends: Friend[], t: (path: string, vars?: Record<string, string | number>) => string): string {
  const actor = friends.find((f) => f.id === n.actorId)?.username ?? t('common.someone');
  const payload = (n.payload ?? {}) as { game?: string; amount?: number; level?: number; chips?: number; rank?: number };
  switch (n.title) {
    case 'weekly_podium_won': return t('notifications.podiumWon', { amount: fmt(payload.amount ?? 0), rank: payload.rank ?? 1 });
    case 'invite': return t('notifications.invite', { name: actor, game: t(`games.${payload.game ?? 'blackjack'}`) });
    case 'accepted': return t('notifications.accepted', { name: actor });
    case 'friend_request': return t('notifications.friendRequest', { name: actor });
    case 'gift_received': return t('notifications.giftReceived', { amount: fmt(payload.amount ?? 0) });
    case 'milestone_reward': return t('notifications.milestoneReward', { level: payload.level ?? '', chips: fmt(payload.chips ?? 0) });
    default: return n.body || t('notifications.generic');
  }
}

export function NotificationsPanel() {
  const panel = useUI((s) => s.panel);
  const openPanel = useUI((s) => s.openPanel);
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useUI((s) => s.toast);
  const profile = usePlayer((s) => s.profile);
  const { notifications, friends, markRead, refresh, dismiss } = useSocial();
  const open = panel === 'notifications';

  useEffect(() => {
    if (open && profile.id) void refresh(profile.id);
  }, [open, profile.id, refresh]);

  const openInvite = async (notification: AppNotification) => {
    const payload = notification.payload as { room_code?: string; game?: string } | undefined;
    if (notification.title !== 'invite' || !payload?.room_code) return;
    if (!(await roomsService.isLive(payload.room_code))) {
      void dismiss(notification.id);
      toast(t('notifications.inviteExpired'), 'bad', '⚠');
      return;
    }
    analytics.track('notification_click', { kind: 'invite', surface: 'panel' });
    openPanel(null);
    navigate(roomRouteFor((payload.game ?? 'blackjack') as GameKey | 'night', payload.room_code));
  };

  return (
    <Modal open={open} onClose={() => openPanel(null)} title={t('hud.notifications')}>
      {notifications.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-[36px] mb-2">🔔</div>
          <p style={{ color: 'var(--muted)' }}>{t('friends.emptyRequests')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => {
            const clickable = notification.title === 'invite';
            return (
              <div key={notification.id}
                role={clickable ? 'button' : undefined}
                onClick={clickable ? () => void openInvite(notification) : undefined}
                className={`flex items-center gap-3 p-3 rounded-[var(--r-sm)] border border-white/[0.07] ${clickable ? 'press cursor-pointer' : ''}`}
                style={{ background: notification.read ? 'transparent' : 'rgba(227,178,60,.06)' }}>
                <span className="text-[20px]">{icons[notification.kind] ?? '◆'}</span>
                <span className="flex-1 text-[13.5px]">{describe(notification, friends, t)}</span>
                <button
                  aria-label={t('common.close')}
                  className="w-6 h-6 grid place-items-center rounded-[var(--r-xs)] text-[11px] opacity-40 hover:opacity-90 transition-opacity"
                  style={{ color: 'var(--muted)' }}
                  onClick={(event) => { event.stopPropagation(); void dismiss(notification.id); }}
                >
                  ✕
                </button>
              </div>
            );
          })}
          <GameButton tone="ghost" block className="mt-2" onClick={() => markRead(profile.id)}>
            {t('common.confirm')}
          </GameButton>
        </div>
      )}
    </Modal>
  );
}
