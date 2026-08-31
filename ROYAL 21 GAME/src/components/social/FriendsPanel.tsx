import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { GameButton } from '@/components/ui/GameButton';
import { Tabs } from '@/components/ui/Tabs';
import { PlayerBadge } from './PlayerBadge';
import { Avatar } from './Avatar';
import { GiftModal } from './GiftModal';
import { useSocial } from '@/stores/useSocial';
import { usePlayer } from '@/stores/usePlayer';
import { useUI } from '@/stores/useUI';
import { useT } from '@/hooks/useT';
import { isOnline, isRemoteId } from '@/services/supabase';
import { notificationService } from '@/services/notificationService';
import { friendsService } from '@/services/friendsService';
import { referralService } from '@/services/referralService';
import { useRoom } from '@/stores/useRoom';
import { fmt } from '@/lib/format';
import type { Friend } from '@/types';

type Tab = 'online' | 'all' | 'requests' | 'add';

/** Slides in over the world — never a separate page (§33). */
export function FriendsPanel() {
  const panel = useUI((s) => s.panel);
  const openPanel = useUI((s) => s.openPanel);
  const toast = useUI((s) => s.toast);
  const { t } = useT();
  const navigate = useNavigate();
  const profile = usePlayer((s) => s.profile);
  const addChips = usePlayer((s) => s.addChips);
  const { friends, requests, searchResults, refresh, search, sendRequest, respond, remove, clearSearch } = useSocial();
  const [tab, setTab] = useState<Tab>('online');
  const [term, setTerm] = useState('');
  const [giftTarget, setGiftTarget] = useState<Friend | null>(null);
  const [refStats, setRefStats] = useState<{ count: number; chipsEarned: number }>({ count: 0, chipsEarned: 0 });
  const room = useRoom((s) => s.room);

  // Refresh referral stats when the Add tab opens
  useEffect(() => {
    if (tab !== 'add' || !isRemoteId(profile.id)) return;
    void referralService.stats(profile.id).then(setRefStats);
  }, [tab, profile.id]);

  const inviteLink = isRemoteId(profile.id) ? referralService.inviteLink(profile.id) : '';

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast(t('common.copied'), 'good', '📋');
    } catch {
      toast(inviteLink, 'neutral');
    }
  };

  const shareOnWhatsApp = () => {
    if (!inviteLink) return;
    const message = t('friends.inviteMessage', { link: inviteLink });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const open = panel === 'friends';

  useEffect(() => {
    if (open && profile.id) void refresh(profile.id);
  }, [open, profile.id, refresh]);

  useEffect(() => {
    if (!open || !isRemoteId(profile.id)) return;
    void friendsService.claimWeeklyPrize(profile.id).then((result) => {
      if (result.claimed && result.chips) {
        addChips(result.chips, { silent: true });
        toast(t('friends.weeklyPrizeWon', { amount: fmt(result.chips) }), 'good', '🏆');
      }
    });
    // Fires once when the panel opens, not on every friends/profile refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile.id]);

  const online = friends.filter((f) => f.presence !== 'offline');
  const list = tab === 'online' ? online : friends;

  const invite = async (friend: Friend) => {
    if (!isOnline()) {
      toast(t('rooms.needsBackend'), 'bad', '⚠');
      return;
    }
    let code = room?.code;
    if (!code) {
      const created = await useRoom.getState().create(profile.id, 'blackjack');
      code = created?.code;
    }
    if (!code) return;
    await notificationService.invite(profile.id, friend.id, code, 'blackjack');
    toast(t('friends.requestSent', { name: friend.username }), 'good', '🎮');
    openPanel(null);
    navigate(`/room/${code}`);
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[450] flex"
          style={{ background: 'rgba(4,5,7,.6)', backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => openPanel(null)}
        >
          <motion.div
            className="ms-auto h-full w-full max-w-[420px]"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
          >
            <GlassPanel animate={false} gold className="h-full rounded-none p-4 flex flex-col gap-3 overflow-auto">
              <div className="flex items-center justify-between">
                <h2>{t('friends.title')}</h2>
                <button className="w-9 h-9 rounded-[var(--r-xs)] border border-white/10" onClick={() => openPanel(null)}>✕</button>
              </div>

              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: 'online', label: t('friends.online'), badge: online.length || undefined },
                  { key: 'all', label: t('friends.allFriends') },
                  { key: 'requests', label: t('friends.requests'), badge: requests.length || undefined },
                  { key: 'add', label: t('friends.add') },
                ]}
              />

              {!isOnline() && (
                <p className="text-[12px] p-2.5 rounded-[var(--r-xs)]" style={{ background: 'rgba(168,65,62,.14)', color: 'var(--crimson-hi)' }}>
                  {t('rooms.needsBackend')}
                </p>
              )}

              {tab === 'add' ? (
                <div className="flex flex-col gap-2.5">
                  {/* Invite link / referral bonus card */}
                  {inviteLink && (
                    <div
                      className="p-3 rounded-[var(--r-sm)]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(227,178,60,.10), rgba(74,168,200,.06))',
                        border: '1px solid var(--gold-line)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[22px]">🎁</span>
                        <b className="text-[13px]">{t('friends.inviteTitle')}</b>
                      </div>
                      <p className="text-[11.5px] mb-2" style={{ color: 'var(--muted)' }}>
                        {t('friends.inviteSubtitle', { chips: '500' })}
                      </p>
                      {refStats.count > 0 && (
                        <p className="text-[11.5px] mb-2" style={{ color: 'var(--gold-hi)' }}>
                          ✨ {t('friends.inviteStats', { count: refStats.count, chips: fmt(refStats.chipsEarned) })}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <GameButton size="sm" tone="gold" block onClick={shareOnWhatsApp}>
                          💬 {t('common.whatsapp')}
                        </GameButton>
                        <GameButton size="sm" tone="ghost" block onClick={copyInvite}>
                          🔗 {t('common.copy')}
                        </GameButton>
                      </div>
                    </div>
                  )}

                  <div className="eyebrow mt-1" style={{ fontSize: 10 }}>{t('friends.searchTitle')}</div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2.5 rounded-[var(--r-xs)] border border-white/10 bg-white/5 outline-none"
                      placeholder={t('friends.searchPlaceholder')}
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && search(term, profile.id)}
                    />
                    <GameButton tone="gold" onClick={() => search(term, profile.id)}>🔍</GameButton>
                  </div>
                  {searchResults.length === 0 && term.length > 1 && (
                    <p className="text-[13px] text-center py-6" style={{ color: 'var(--muted)' }}>{t('friends.noResults')}</p>
                  )}
                  {searchResults.map((friend) => (
                    <PlayerBadge
                      key={friend.id}
                      friend={friend}
                      onClick={() => navigate(`/profile/${friend.id}`)}
                      right={
                        <GameButton size="sm" tone="gold" onClick={async () => {
                          await sendRequest(profile.id, friend);
                          toast(t('friends.requestSent', { name: friend.username }), 'good', '👋');
                          clearSearch();
                        }}>
                          {t('friends.sendRequest')}
                        </GameButton>
                      }
                    />
                  ))}
                </div>
              ) : tab === 'requests' ? (
                <div className="flex flex-col gap-2.5">
                  {requests.length === 0 && (
                    <p className="text-[13px] text-center py-8" style={{ color: 'var(--muted)' }}>{t('friends.emptyRequests')}</p>
                  )}
                  {requests.map((request) => (
                    <div key={request.id} className="p-3 rounded-[var(--r-sm)] border border-white/10" style={{ background: 'rgba(255,255,255,.03)' }}>
                      <div className="flex items-center gap-3 mb-2.5">
                        <Avatar config={request.from.avatar} size={40} level={request.from.level} id={request.from.id} />
                        <b>{t('friends.wantsToBeFriend', { name: request.from.username })}</b>
                      </div>
                      <div className="flex gap-2">
                        <GameButton size="sm" tone="jade" block onClick={() => respond(request.id, true, profile.id)}>
                          {t('friends.accept')}
                        </GameButton>
                        <GameButton size="sm" tone="ghost" block onClick={() => respond(request.id, false, profile.id)}>
                          {t('friends.decline')}
                        </GameButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {list.length === 0 && (
                    <div className="text-center py-10 px-4">
                      <div className="text-[40px] mb-2 ambient-float">🛋️</div>
                      <p style={{ color: 'var(--muted)' }}>
                        {tab === 'online' ? t('friends.emptyOnline') : t('friends.emptyAll')}
                      </p>
                      <GameButton tone="gold" className="mt-4" onClick={() => setTab('add')}>{t('friends.add')}</GameButton>
                    </div>
                  )}
                  {list.map((friend) => (
                    <PlayerBadge
                      key={friend.id}
                      friend={friend}
                      onClick={() => { openPanel(null); navigate(`/profile/${friend.id}`); }}
                      right={
                        <div className="flex gap-1.5">
                          {isRemoteId(profile.id) && (
                            <GameButton size="sm" tone="metal" onClick={() => setGiftTarget(friend)}>🎁</GameButton>
                          )}
                          {friend.presence !== 'offline' && (
                            <GameButton size="sm" tone="gold" onClick={() => invite(friend)}>{t('friends.invite')}</GameButton>
                          )}
                          <GameButton size="sm" tone="ghost" onClick={() => remove(profile.id, friend.id)}>✕</GameButton>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <GiftModal friend={giftTarget} onClose={() => setGiftTarget(null)} />
    </>
  );
}
