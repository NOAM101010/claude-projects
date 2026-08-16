import { create } from 'zustand';
import { friendsService } from '@/services/friendsService';
import { notificationService } from '@/services/notificationService';
import { isOnline } from '@/services/supabase';
import { audio } from '@/audio/AudioManager';
import { usePlayer } from './usePlayer';
import { useUI } from './useUI';
import { useSettings } from './useSettings';
import { translate } from '@/i18n';
import { fmt } from '@/lib/format';
import type { AppNotification, Friend, FriendRequest } from '@/types';

interface SocialState {
  friends: Friend[];
  requests: FriendRequest[];
  notifications: AppNotification[];
  searchResults: Friend[];
  searching: boolean;
  /** Set by the realtime feed; the HUD shows it as a full-screen invite. */
  pendingInvite: { from: Friend | null; code: string; game: string } | null;
  refresh: (userId: string) => Promise<void>;
  search: (term: string, selfId: string) => Promise<void>;
  clearSearch: () => void;
  sendRequest: (fromId: string, to: Friend) => Promise<void>;
  respond: (requestId: string, accept: boolean, userId: string) => Promise<void>;
  remove: (userId: string, friendId: string) => Promise<void>;
  block: (userId: string, friendId: string) => Promise<void>;
  setInvite: (invite: SocialState['pendingInvite']) => void;
  markRead: (userId: string) => Promise<void>;
  listen: (userId: string) => () => void;
}

export const useSocial = create<SocialState>()((set, get) => ({
  friends: [],
  requests: [],
  notifications: [],
  searchResults: [],
  searching: false,
  pendingInvite: null,

  refresh: async (userId) => {
    if (!isOnline()) return;
    const [friends, requests, notifications] = await Promise.all([
      friendsService.list(userId),
      friendsService.requests(userId),
      notificationService.list(userId),
    ]);
    set({ friends, requests, notifications });
  },

  search: async (term, selfId) => {
    set({ searching: true });
    const results = await friendsService.search(term, selfId);
    set({ searchResults: results, searching: false });
  },

  clearSearch: () => set({ searchResults: [] }),

  sendRequest: async (fromId, to) => {
    await friendsService.sendRequest(fromId, to.id);
  },

  respond: async (requestId, accept, userId) => {
    await friendsService.respond(requestId, accept);
    await get().refresh(userId);
  },

  remove: async (userId, friendId) => {
    await friendsService.remove(userId, friendId);
    await get().refresh(userId);
  },

  block: async (userId, friendId) => {
    await friendsService.block(userId, friendId);
    await get().refresh(userId);
  },

  setInvite: (pendingInvite) => set({ pendingInvite }),

  markRead: async (userId) => {
    await notificationService.markRead(userId);
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }));
  },

  listen: (userId) => {
    if (!isOnline()) return () => {};
    const offFriends = friendsService.subscribe(userId, () => void get().refresh(userId));
    const offNotifications = notificationService.subscribe(userId, (notification) => {
      set((state) => ({ notifications: [notification, ...state.notifications] }));
      audio.play('notify');
      if (notification.kind === 'invite') {
        const payload = notification.payload as { room_code?: string; game?: string } | undefined;
        const from = get().friends.find((f) => f.id === notification.actorId) ?? null;
        set({ pendingInvite: { from, code: payload?.room_code ?? '', game: payload?.game ?? 'blackjack' } });
      }
      if (notification.kind === 'friend_request') void get().refresh(userId);
      if (notification.kind === 'gift') {
        const payload = notification.payload as { amount?: number } | undefined;
        const amount = payload?.amount ?? 0;
        if (amount > 0) {
          usePlayer.getState().addChips(amount, { silent: true });
          const from = get().friends.find((f) => f.id === notification.actorId);
          const lang = useSettings.getState().lang;
          useUI.getState().toast(
            translate(lang, 'friends.giftSent', { amount: fmt(amount), name: from?.username ?? translate(lang, 'friends.title') }),
            'good', '🎁',
          );
        }
      }
    });
    return () => {
      offFriends();
      offNotifications();
    };
  },
}));
