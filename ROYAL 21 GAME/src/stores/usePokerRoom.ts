import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { pokerService } from '@/services/pokerService';
import { createState, reduce } from '@/games/poker/engine';
import { MAX_SEATS } from '@/games/poker/types';
import type { PokerAction, PokerState } from '@/games/poker/types';
import { isOnline } from '@/services/supabase';
import type { Room, RoomConfig, RoomMember } from '@/types';

type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface PokerRoomState {
  room: Room | null;
  members: RoomMember[];
  state: PokerState | null;
  isHost: boolean;
  status: Status;
  cleanups: (() => void)[];

  create: (userId: string, sb: number, bb: number, config?: RoomConfig) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string, sb: number, bb: number) => Promise<void>;
  send: (userId: string, action: PokerAction) => Promise<void>;
  leave: (userId: string) => Promise<void>;
}

export const usePokerRoom = create<PokerRoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  isHost: false,
  status: 'idle',
  cleanups: [],

  create: async (userId, sb, bb, config) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    // Merge stakes into config so the table settings live in one place.
    const fullConfig: RoomConfig = { smallBlind: sb, bigBlind: bb, ...(config ?? {}) };
    const room = await roomsService.create(userId, 'poker', fullConfig);
    if (!room) { set({ status: 'idle' }); return null; }
    await get().connect(room, userId, sb, bb);
    return room;
  },

  joinByCode: async (code, userId) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.byCode(code);
    if (!room || room.game !== 'poker') { set({ status: 'idle' }); return null; }
    await roomsService.join(room.id, userId, MAX_SEATS);
    await get().connect(room, userId, 25, 50);
    return room;
  },

  connect: async (room, userId, sb, bb) => {
    get().cleanups.forEach((fn) => fn());
    const isHost = room.hostId === userId;
    set({ room, isHost, status: 'connecting', cleanups: [] });

    const initial = isHost
      ? await pokerService.initIfEmpty(room.id, sb, bb)
      : await pokerService.loadState(room.id);
    set({ state: initial ?? createState(Math.floor(Math.random() * 2 ** 31), sb, bb) });

    const cleanups: (() => void)[] = [];
    const startHostLoop = () => cleanups.push(
      pokerService.runHost(
        room.id,
        () => get().state ?? createState(Math.floor(Math.random() * 2 ** 31), sb, bb),
        (next) => set({ state: next }),
      ),
    );

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(pokerService.subscribeState(room.id, (next) => {
      const current = get().state;
      if (!current || next.version >= current.version) set({ state: next, status: 'connected' });
    }));
    if (isHost) {
      startHostLoop();
    } else {
      // A disconnected host would otherwise freeze the hand — the pot stuck
      // mid-hand forever. Someone still seated has to be able to take over.
      cleanups.push(roomsService.watchHostLiveness(room.id, userId, () => get().isHost, () => {
        set({ isHost: true });
        startHostLoop();
      }));
    }
    set({ cleanups, status: 'connected', members: await roomsService.members(room.id) });
  },

  send: async (userId, action) => {
    const { room, isHost, state } = get();
    if (!room || !state) return;
    if (isHost) {
      const next = reduce(state, { ...action, userId } as PokerAction);
      set({ state: next });
      await pokerService.publish(room.id, next);
      return;
    }
    await pokerService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, isHost: false, status: 'idle', cleanups: [] });
  },
}));
