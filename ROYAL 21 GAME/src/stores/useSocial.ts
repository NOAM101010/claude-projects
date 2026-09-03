import { create } from 'zustand';
import { friendsService } from '@/services/friendsService';
import { dmService } from '@/services/dmService';
import { notificationService } from '@/services/notificationService';
import { roomsService } from '@/services/roomsService';
import { isOnline } from '@/services/supabase';
import { audio } from '@/audio/AudioManager';
import { usePlayer } from './usePlayer';
import { useUI } from './useUI';
import { useSettings } from './useSettings';
import { translate } from '@/i18n';
import { isFriendOnline } from '@/lib/presence';
import { fmt } from '@/lib/format';
import type { AppNotification, DirectMessage, Friend, FriendRequest } from '@/types';

interface SocialState {
  friends: Friend[];
  requests: FriendRequest[];
  notifications: AppNotification[];
  searchResults: Friend[];
  searching: boolean;
  /** Set by the realtime feed; the HUD shows it as a full-screen invite.
   *  `id` is the notification row id so an expired one can be deleted on click. */
  pendingInvite: { from: Friend | null; code: string; game: string; id: string } | null;
  /** 1:1 chat, keyed by the friend's id. */
  dmThreads: Record<string, DirectMessage[]>;
  dmUnread: Record<string, number>;
  dmOpen: string | null;
  openDM: (friendId: string) => Promise<void>;
  closeDM: () => void;
  sendDM: (friendId: string, body: string) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  search: (term: string, selfId: string) => Promise<void>;
  clearSearch: () => void;
  sendRequest: (fromId: string, to: Friend) => Promise<void>;
  respond: (requestId: string, accept: boolean, userId: string) => Promise<void>;
  remove: (userId: string, friendId: string) => Promise<void>;
  block: (userId: string, friendId: string) => Promise<void>;
  setInvite: (invite: SocialState['pendingInvite']) => void;
  markRead: (userId: string) => Promise<void>;
  /** Delete one notification (server + store), e.g. a room invite that expired. */
  dismiss: (id: string) => Promise<void>;
  listen: (userId: string) => () => void;
}

/** Age past which an unopened room invite is *checked* against the live room
 *  (and dropped only if the room is confirmed gone). A real invite can wait
 *  hours, so this is deliberately generous. */
const INVITE_TTL_MS = 12 * 60 * 60 * 1000;

/* --- "friend joined the game" toast (Stage H) -------------------------------
 * A light, non-persistent nudge when a friend flips offline -> online. Driven
 * off refresh()'s friend list (route changes + the friends realtime sub), so
 * detection is only as fresh as the last refresh — fine for a low-priority cue.
 * Never creates a notification row. Suppressed when showPresence is off. */
let friendJoinReady = false;
const friendWasOnline: Record<string, boolean> = {};
const friendJoinAnnouncedAt: Record<string, number> = {};
const FRIEND_JOIN_DEBOUNCE_MS = 10 * 60 * 1000;

function detectFriendJoins(friends: Friend[]): void {
  const showPresence = useSettings.getState().showPresence;
  const now = Date.now();
  for (const friend of friends) {
    const online = isFriendOnline(friend);
    const was = friendWasOnline[friend.id] ?? false;
    friendWasOnline[friend.id] = online;
    // Skip the very first refresh (the whole list "comes online" at once) and
    // honour the privacy toggle — but keep tracking state so the next flip fires.
    if (!friendJoinReady || !showPresence) continue;
    if (online && !was) {
      const last = friendJoinAnnouncedAt[friend.id] ?? 0;
      if (now - last < FRIEND_JOIN_DEBOUNCE_MS) continue;
      friendJoinAnnouncedAt[friend.id] = now;
      const lang = useSettings.getState().lang;
      useUI.getState().toast(translate(lang, 'friends.friendJoined', { name: friend.username }), 'good', '👋');
      audio.play('friendJoin');
    }
  }
  friendJoinReady = true;
}

export const useSocial = create<SocialState>()((set, get) => ({
  friends: [],
  requests: [],
  notifications: [],
  searchResults: [],
  searching: false,
  pendingInvite: null,
  dmThreads: {},
  dmUnread: {},
  dmOpen: null,

  openDM: async (friendId) => {
    set({ dmOpen: friendId });
    const me = usePlayer.getState().profile.id;
    const history = await dmService.history(me, friendId);
    set((state) => ({
      dmThreads: { ...state.dmThreads, [friendId]: history },
      dmUnread: { ...state.dmUnread, [friendId]: 0 },
    }));
    await dmService.markRead(me, friendId);
  },

  closeDM: () => set({ dmOpen: null }),

  sendDM: async (friendId, body) => {
    const me = usePlayer.getState().profile.id;
    await dmService.send(me, friendId, body);
  },

  refresh: async (userId) => {
    if (!isOnline()) return;
    const [friends, requests, notifications, dmUnread] = await Promise.all([
      friendsService.list(userId),
      friendsService.requests(userId),
      notificationService.list(userId),
      dmService.unreadCounts(userId),
    ]);
    set({ friends, requests, notifications, dmUnread });
    detectFriendJoins(friends);
    // Prune old room invites — but only the ones whose room is *confirmed* dead.
    // isLive() returns true on any check failure, so a blip never nukes a real
    // invite; and we never guess from age alone.
    const cutoff = Date.now() - INVITE_TTL_MS;
    const old = notifications.filter(
      (n) => n.kind === 'invite' && new Date(n.createdAt).getTime() < cutoff,
    );
    for (const n of old) {
      const code = (n.payload as { room_code?: string } | undefined)?.room_code;
      if (!code || (await roomsService.isLive(code))) continue;
      if (await notificationService.delete(n.id)) {
        set((s) => ({ notifications: s.notifications.filter((x) => x.id !== n.id) }));
      }
    }
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

  dismiss: async (id) => {
    // Await the server first — only touch the store if the row is really gone,
    // otherwise a failed RLS/network delete would hide it locally forever.
    const ok = await notificationService.delete(id);
    if (!ok) {
      const lang = useSettings.getState().lang;
      useUI.getState().toast(translate(lang, 'common.retry'), 'bad', '⚠');
      return;
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      pendingInvite: state.pendingInvite?.id === id ? null : state.pendingInvite,
    }));
  },

  listen: (userId) => {
    if (!isOnline()) return () => {};
    // Fresh session: re-arm the "friend joined" detector so the first refresh
    // after sign-in doesn't announce the whole friend list.
    friendJoinReady = false;
    const offFriends = friendsService.subscribe(userId, () => void get().refresh(userId));
    const offDM = dmService.subscribe(userId, (msg) => {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const incoming = msg.senderId !== userId;
      const isOpen = get().dmOpen === otherId;
      set((state) => {
        const thread = state.dmThreads[otherId] ?? [];
        if (thread.some((m) => m.id === msg.id)) return state;
        return {
          dmThreads: { ...state.dmThreads, [otherId]: [...thread, msg].slice(-120) },
          dmUnread: incoming && !isOpen
            ? { ...state.dmUnread, [otherId]: (state.dmUnread[otherId] ?? 0) + 1 }
            : state.dmUnread,
        };
      });
      if (incoming && !isOpen) audio.play('notify');
      if (incoming && isOpen) void dmService.markRead(userId, otherId);
    });
    const offNotifications = notificationService.subscribe(userId, (notification) => {  // onInsert
      set((state) => ({ notifications: [notification, ...state.notifications] }));
      audio.play('notify');
      if (notification.kind === 'invite') {
        const payload = notification.payload as { room_code?: string; game?: string } | undefined;
        const from = get().friends.find((f) => f.id === notification.actorId) ?? null;
        set({ pendingInvite: { from, code: payload?.room_code ?? '', game: payload?.game ?? 'blackjack', id: notification.id } });
      }
      if (notification.kind === 'friend_request') void get().refresh(userId);
      if (notification.kind === 'podium_prize') {
        // The RPC already credited the chips server-side; this is the receipt.
        // Adopt the post-credit balance it carries (no realtime sub on our own
        // profiles row) — setChips stamps it as the synced baseline so persist()
        // never pushes it again. Fall back to a server pull for pre-migration rows.
        audio.play('bigWin');
        const payload = notification.payload as { amount?: number; new_balance?: number } | undefined;
        if (typeof payload?.new_balance === 'number') usePlayer.getState().setChips(payload.new_balance);
        else void usePlayer.getState().refreshFromServer();
        const lang = useSettings.getState().lang;
        useUI.getState().toast(
          translate(lang, 'friends.weeklyPrizeWon', { amount: fmt(payload?.amount ?? 0) }),
          'good', '🏆',
        );
      }
      if (notification.kind === 'gift') {
        // send_gift() already credited the chips server-side; this is only the
        // receipt (same as podium_prize above). Adopt the post-credit balance it
        // carries — crediting a delta here would let persist() push it back up
        // and double the gift. Fall back to a server pull for pre-migration rows.
        const payload = notification.payload as { amount?: number; new_balance?: number } | undefined;
        const amount = payload?.amount ?? 0;
        if (amount > 0) {
          audio.play('coin');
          if (typeof payload?.new_balance === 'number') usePlayer.getState().setChips(payload.new_balance);
          else void usePlayer.getState().refreshFromServer();
          const from = get().friends.find((f) => f.id === notification.actorId);
          const lang = useSettings.getState().lang;
          useUI.getState().toast(
            translate(lang, 'friends.giftSent', { amount: fmt(amount), name: from?.username ?? translate(lang, 'friends.title') }),
            'good', '🎁',
          );
        }
      }
    }, (id) => {  // onDelete — a notification was cleaned up elsewhere
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        pendingInvite: state.pendingInvite?.id === id ? null : state.pendingInvite,
      }));
    });
    return () => {
      offFriends();
      offNotifications();
      offDM();
    };
  },
}));
