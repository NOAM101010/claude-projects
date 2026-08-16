import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { sngService } from '@/services/sngService';
import { createTournamentState, reduce } from '@/games/poker/engine';
import { MAX_SEATS } from '@/games/poker/types';
import type { PokerAction, PokerState } from '@/games/poker/types';
import { isOnline } from '@/services/supabase';
import type { Room, RoomMember } from '@/types';

type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface SngRoomState {
  room: Room | null;
  members: RoomMember[];
  state: PokerState | null;
  isHost: boolean;
  status: Status;
  cleanups: (() => void)[];

  create: (userId: string, buyIn: number) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string, buyIn: number) => Promise<void>;
  send: (userId: string, action: PokerAction) => Promise<void>;
  leave: (userId: string) => Promise<void>;
}

export const useSngRoom = create<SngRoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  isHost: false,
  status: 'idle',
  cleanups: [],

  create: async (userId, buyIn) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.create(userId, 'sng');
    if (!room) { set({ status: 'idle' }); return null; }
    await get().connect(room, userId, buyIn);
    return room;
  },

  joinByCode: async (code, userId) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.byCode(code);
    if (!room || room.game !== 'sng') { set({ status: 'idle' }); return null; }
    await roomsService.join(room.id, userId, MAX_SEATS);
    await get().connect(room, userId, 1000);
    return room;
  },

  connect: async (room, userId, buyIn) => {
    get().cleanups.forEach((fn) => fn());
    const isHost = room.hostId === userId;
    set({ room, isHost, status: 'connecting', cleanups: [] });

    const initial = isHost
      ? await sngService.initIfEmpty(room.id, buyIn)
      : await sngService.loadState(room.id);
    set({ state: initial ?? createTournamentState(Math.floor(Math.random() * 2 ** 31), buyIn) });

    const cleanups: (() => void)[] = [];
    const startHostLoop = () => cleanups.push(
      sngService.runHost(
        room.id,
        () => get().state ?? createTournamentState(Math.floor(Math.random() * 2 ** 31), buyIn),
        (next) => set({ state: next }),
      ),
    );

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(sngService.subscribeState(room.id, (next) => {
      const current = get().state;
      if (!current || next.version >= current.version) set({ state: next, status: 'connected' });
    }));
    if (isHost) {
      startHostLoop();
    } else {
      // A disconnected host would otherwise freeze the tournament mid-hand.
      // Someone still seated has to be able to take over running it.
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
      await sngService.publish(room.id, next);
      return;
    }
    await sngService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, isHost: false, status: 'idle', cleanups: [] });
  },
}));
