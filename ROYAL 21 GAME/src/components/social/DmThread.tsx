import { useEffect, useRef, useState } from 'react';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from './Avatar';
import { PlayerName } from './PlayerName';
import { useSocial } from '@/stores/useSocial';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { isFriendOnline } from '@/lib/presence';
import { MAX_DM } from '@/services/dmService';
import type { DirectMessage, Friend } from '@/types';

const EMPTY: DirectMessage[] = [];

const clock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * 1:1 conversation, rendered in place of the friends list while a thread is
 * open. Same bubble language as the room ChatPanel — no typing indicators or
 * visible read receipts, just the messages.
 */
export function DmThread({ friend }: { friend: Friend }) {
  const { t } = useT();
  const me = usePlayer((s) => s.profile.id);
  const closeDM = useSocial((s) => s.closeDM);
  const sendDM = useSocial((s) => s.sendDM);
  const messages = useSocial((s) => s.dmThreads[friend.id]) ?? EMPTY;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await sendDM(friend.id, text);
    } finally {
      setSending(false);
    }
  };

  const status = friend.currentGame
    ? t('dm.inGame')
    : isFriendOnline(friend)
      ? t('friends.online')
      : t('dm.offline');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2.5 pb-2.5" style={{ borderBottom: '1px solid var(--glass-line)' }}>
        <GameButton size="sm" tone="ghost" onClick={closeDM} aria-label={t('dm.back')}>‹</GameButton>
        <Avatar config={friend.avatar} size={32} level={friend.level} id={friend.id} />
        <div className="min-w-0">
          <PlayerName username={friend.username} title={friend.title} nameColor={friend.nameColor} size={13} />
          <span className="block text-[10.5px] leading-tight" style={{ color: 'var(--dim)' }}>{status}</span>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto py-2.5 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="m-auto text-center px-4">
            <div className="text-[26px] mb-1">💬</div>
            <p className="text-[12.5px]" style={{ color: 'var(--dim)' }}>{t('dm.empty')}</p>
          </div>
        )}
        {messages.map((message) => {
          const mine = message.senderId === me;
          return (
            <div key={message.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[76%] ${mine ? 'text-end' : ''}`}>
                <div
                  className="inline-block px-2.5 py-1.5 text-[12.5px] leading-snug break-words"
                  style={{
                    background: mine ? 'linear-gradient(180deg, rgba(227,178,60,.20), rgba(227,178,60,.08))' : 'var(--glass)',
                    border: `1px solid ${mine ? 'var(--gold-line)' : 'var(--glass-line)'}`,
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  {message.body}
                </div>
                <span className="block text-[9.5px] mt-0.5" style={{ color: 'var(--dim)' }}>{clock(message.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex items-center gap-2 pt-2"
        style={{ borderTop: '1px solid var(--glass-line)' }}
        onSubmit={(event) => { event.preventDefault(); void send(); }}
      >
        <input
          className="flex-1 px-2.5 py-2 text-[13px] bg-transparent"
          style={{ border: '1px solid var(--glass-line)', borderRadius: 'var(--r-xs)' }}
          value={draft}
          maxLength={MAX_DM}
          placeholder={t('dm.placeholder', { name: friend.username })}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={t('dm.placeholder', { name: friend.username })}
        />
        <GameButton type="submit" size="sm" tone="gold" disabled={!draft.trim() || sending}>
          {t('dm.send')}
        </GameButton>
      </form>
    </div>
  );
}
