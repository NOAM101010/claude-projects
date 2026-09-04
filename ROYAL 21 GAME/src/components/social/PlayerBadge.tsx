import { Avatar } from './Avatar';
import { PlayerName } from './PlayerName';
import { useT } from '@/hooks/useT';
import type { Friend, Presence } from '@/types';

const presenceKey: Record<Presence, string> = {
  online: 'friends.inLobby', hub: 'friends.inLobby', blackjack: 'friends.inGame',
  duel: 'friends.inGame', roulette: 'friends.inGame', away: 'friends.away', offline: 'friends.offline',
};

export function PlayerBadge({ friend, size = 40, onClick, right }: {
  friend: Friend; size?: number; onClick?: () => void; right?: React.ReactNode;
}) {
  const { t } = useT();
  const status = presenceKey[friend.presence];
  const label = status === 'friends.inGame'
    ? t('friends.inGame', { game: t(`games.${friend.currentGame ?? 'blackjack'}`) })
    : t(status);

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-[var(--r-sm)] border border-white/[0.07] w-full text-start"
      style={{ background: 'rgba(255,255,255,.025)' }}
    >
      <button className="flex items-center gap-3 flex-1 text-start press" onClick={onClick}>
        <Avatar config={friend.avatar} size={size} level={friend.level} presence={friend.presence} id={friend.id} />
        <span className="min-w-0">
          <PlayerName username={friend.username} title={friend.title} nameColor={friend.nameColor} size={14} />
          <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {t('common.level')} {friend.level} · {label}
          </span>
        </span>
      </button>
      {right}
    </div>
  );
}
