import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { highlowService } from '@/services/highlowService';
import { createState, reduce, MAX_SEATS } from '@/games/highlow/engine';
import type { HlAction, HlState } from '@/games/highlow/types';
import { newSeed } from '@/lib/random';
import { isOnline } from '@/services/supabase';
import type { Room, RoomMember } from '@/types';

type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface HlRoomState {
  room: Room | null;
  members: RoomMember[];
  state: HlState | null;
  isHost: boolean;
  status: Status;
  cleanups: (() => void)[];

  create: (userId: string) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string) => Promise<void>;
  send: (userId: string, action: HlAction) => Promise<boolean>;
  leave: (userId: string) => Promise<void>;
}

export const useHighLowRoom = create<HlRoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  isHost: false,
  status: 'idle',
  cleanups: [],

  create: async (userId) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.create(userId, 'highlow');
    if (!room) {
      set({ status: 'idle' });
      return null;
    }
    await get().connect(room, userId);
    return room;
  },

  joinByCode: async (code, userId) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.byCode(code);
    if (!room) {
      set({ status: 'idle' });
      return null;
    }
    await roomsService.join(room.id, userId, MAX_SEATS);
    await get().connect(room, userId);
    return room;
  },

  connect: async (room, userId) => {
    get().cleanups.forEach((fn) => fn());
    const isHost = room.hostId === userId;
    set({ room, isHost, status: 'connecting', cleanups: [] });

    const initial = isHost
      ? await highlowService.initIfEmpty(room.id)
      : await highlowService.loadState(room.id);
    set({ state: initial ?? createState(newSeed()) });

    const cleanups: (() => void)[] = [];
    let stopHostLoop: (() => void) | null = null;
    const stepDownFromHost = () => {
      stopHostLoop?.();
      set({ isHost: false });
    };
    const startHostLoop = () => {
      if (stopHostLoop) return;
      const stopRun = highlowService.runHost(
        room.id,
        () => get().state ?? createState(newSeed()),
        (next) => set({ state: next }),
      );
      const stopBeat = roomsService.startHostHeartbeat(room.id, userId, () => get().isHost, stepDownFromHost);
      stopHostLoop = () => { stopRun(); stopBeat(); stopHostLoop = null; };
      cleanups.push(() => stopHostLoop?.());
    };

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(highlowService.subscribeState(room.id, (next) => {
      // The host is authoritative and holds the un-redacted state in memory —
      // consuming its own redacted echo would wipe live guesses.
      if (get().isHost) return;
      const current = get().state;
      if (!current || next.version >= current.version) set({ state: next, status: 'connected' });
    }));
    cleanups.push(roomsService.watchHostLiveness(room.id, userId, () => get().isHost, () => {
      set({ isHost: true });
      startHostLoop();
    }));
    if (isHost) startHostLoop();
    set({ cleanups, status: 'connected', members: await roomsService.members(room.id) });
  },

  send: async (userId, action) => {
    const { room, isHost, state } = get();
    if (!room) {
      if (!state) return true;
      set({ state: reduce(state, { ...action, userId } as HlAction) });
      return true;
    }
    if (isHost && state) {
      const next = reduce(state, { ...action, userId } as HlAction);
      set({ state: next });
      await highlowService.publish(room.id, next);
      return true;
    }
    return highlowService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, isHost: false, status: 'idle', cleanups: [] });
  },
}));
