import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GameButton } from '@/components/ui/GameButton';
import { Avatar } from '@/components/social/Avatar';
import { chatService, MAX_MESSAGE } from '@/services/chatService';
import { usePlayer } from '@/stores/usePlayer';
import { useT } from '@/hooks/useT';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { isOnline } from '@/services/supabase';
import { audio } from '@/audio/AudioManager';
import type { ChatMessage, RoomMember } from '@/types';

interface Props {
  roomId: string;
  /** Used to fill in the author on live messages, which arrive without a join. */
  members: RoomMember[];
}

const clock = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * Room chat: the thing that turns four people in a browser into an evening.
 *
 * Docked and collapsible so it never covers the table, with an unread count
 * while it is shut. History is persisted, so someone who joins late can read
 * what they walked in on.
 */
export function ChatPanel({ roomId, members }: Props) {
  const { t } = useT();
  const compact = useIsCompact();
  const profile = usePlayer((s) => s.profile);
  const [open, setOpen] = useState(!compact);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const byId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  /* Fill in author details the realtime payload does not carry. */
  const decorate = (message: ChatMessage): ChatMessage => {
    if (message.username !== 'Player') return message;
    const member = byId.get(message.userId);
    return member ? { ...message, username: member.username, avatar: member.avatar } : message;
  };

  useEffect(() => {
    if (!roomId) return;
    let live = true;
    void chatService.history(roomId).then((rows) => { if (live) setMessages(rows); });
    const off = chatService.subscribe(roomId, (message) => {
      setMessages((current) => (
        current.some((m) => m.id === message.id) ? current : [...current, message].slice(-120)
      ));
      if (message.userId !== profile.id) {
        audio.play('notify');
        if (!openRef.current) setUnread((count) => count + 1);
      }
    });
    return () => { live = false; off(); };
  }, [roomId, profile.id]);

  /* Pin to the newest message whenever the thread grows while open. */
  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  useEffect(() => { if (open) setUnread(0); }, [open]);

  if (!isOnline()) return null;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await chatService.send(roomId, profile.id, text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed z-[47]"
      style={{
        insetInlineEnd: compact ? 10 : 16,
        bottom: `calc(14px + var(--safe-b))`,
        width: open ? (compact ? 'calc(100vw - 20px)' : 340) : 'auto',
      }}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="glass mb-2 flex flex-col overflow-hidden"
            style={{ borderColor: 'var(--gold-line)', height: compact ? '46dvh' : 380 }}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--glass-line)' }}>
              <div>
                <span className="eyebrow" style={{ fontSize: 9 }}>{t('chat.title')}</span>
                <b className="block text-[12.5px]" style={{ fontFamily: 'var(--font-display)' }}>
                  {t('chat.members', { count: members.length })}
                </b>
              </div>
              <GameButton size="sm" tone="ghost" onClick={() => setOpen(false)} aria-label={t('common.close')}>✕</GameButton>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
              {messages.length === 0 && (
                <div className="m-auto text-center px-4">
                  <div className="text-[26px] mb-1">💬</div>
                  <p className="text-[12.5px]" style={{ color: 'var(--dim)' }}>{t('chat.empty')}</p>
                </div>
              )}
              {messages.map((raw) => {
                const message = decorate(raw);
                const mine = message.userId === profile.id;
                return (
                  <div key={message.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && (
                      <Avatar config={message.avatar ?? profile.avatar} size={26} id={`chat-${message.userId}`} />
                    )}
                    <div className={`max-w-[76%] ${mine ? 'text-end' : ''}`}>
                      {!mine && (
                        <span className="block text-[10.5px] leading-tight" style={{ color: 'var(--gold)' }}>
                          {message.username}
                        </span>
                      )}
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
              className="flex items-center gap-2 p-2"
              style={{ borderTop: '1px solid var(--glass-line)' }}
              onSubmit={(event) => { event.preventDefault(); void send(); }}
            >
              <input
                className="flex-1 px-2.5 py-2 text-[13px] bg-transparent"
                style={{ border: '1px solid var(--glass-line)', borderRadius: 'var(--r-xs)' }}
                value={draft}
                maxLength={MAX_MESSAGE}
                placeholder={t('chat.placeholder')}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={t('chat.placeholder')}
              />
              <GameButton type="submit" size="sm" tone="gold" disabled={!draft.trim() || sending}>
                {t('chat.send')}
              </GameButton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          className="relative flex items-center gap-2 px-3.5 py-2 glass press ms-auto"
          style={{ borderRadius: 999, borderColor: 'var(--gold-line)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2 }}
          onClick={() => setOpen(true)}
        >
          <span className="text-[15px] leading-none">💬</span>
          <b className="text-[12.5px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-hi)' }}>
            {t('chat.title')}
          </b>
          {unread > 0 && (
            <span
              className="grid place-items-center rounded-full text-[9.5px] font-black"
              style={{ minWidth: 17, height: 17, padding: '0 4px', background: 'var(--crimson)', color: '#fff' }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </motion.button>
      )}
    </div>
  );
}
