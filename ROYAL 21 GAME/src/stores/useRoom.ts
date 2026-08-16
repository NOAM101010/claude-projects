import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { blackjackService } from '@/services/blackjackService';
import { createState, reduce } from '@/games/blackjack/engine';
import type { BjAction, BjState } from '@/games/blackjack/types';
import { newSeed } from '@/lib/random';
import { isOnline } from '@/services/supabase';
import type { GameKey, Room, RoomMember } from '@/types';

type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface RoomState {
  room: Room | null;
  members: RoomMember[];
  state: BjState | null;
  isHost: boolean;
  status: Status;
  /** Local-only game (solo). Never touches the network. */
  solo: boolean;
  cleanups: (() => void)[];

  startSolo: () => void;
  create: (userId: string, game: GameKey) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string) => Promise<void>;
  send: (userId: string, action: BjAction) => Promise<void>;
  leave: (userId: string) => Promise<void>;
  setStatus: (status: Status) => void;
}

export const useRoom = create<RoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  isHost: false,
  status: 'idle',
  solo: false,
  cleanups: [],

  startSolo: () => {
    get().cleanups.forEach((fn) => fn());
    set({ room: null, members: [], state: createState(newSeed()), isHost: true, solo: true, status: 'connected', cleanups: [] });
  },

  create: async (userId, game) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.create(userId, game);
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
    await roomsService.join(room.id, userId);
    await get().connect(room, userId);
    return room;
  },

  connect: async (room, userId) => {
    get().cleanups.forEach((fn) => fn());
    const isHost = room.hostId === userId;
    set({ room, isHost, solo: false, status: 'connecting', cleanups: [] });

    const initial = isHost
      ? await blackjackService.initIfEmpty(room.id)
      : await blackjackService.loadState(room.id);
    set({ state: initial ?? createState(newSeed()) });

    const cleanups: (() => void)[] = [];
    const startHostLoop = () => cleanups.push(
      blackjackService.runHost(
        room.id,
        () => get().state ?? createState(newSeed()),
        (next) => set({ state: next }),
      ),
    );

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(blackjackService.subscribeState(room.id, (next) => {
      const current = get().state;
      // Drop out-of-order frames, keep the newest authoritative state.
      if (!current || next.version >= current.version) set({ state: next, status: 'connected' });
    }));
    if (isHost) {
      startHostLoop();
    } else {
      // The original host may vanish mid-session — someone still seated has
      // to be able to take the wheel, or the room freezes for good.
      cleanups.push(roomsService.watchHostLiveness(room.id, userId, () => get().isHost, () => {
        set({ isHost: true });
        startHostLoop();
      }));
    }
    set({ cleanups, status: 'connected', members: await roomsService.members(room.id) });
  },

  send: async (userId, action) => {
    const { solo, room, isHost, state } = get();
    if (solo || !room) {
      if (!state) return;
      set({ state: reduce(state, { ...action, userId } as BjAction) });
      return;
    }
    if (isHost && state) {
      // The host applies its own intent immediately, then publishes it.
      const next = reduce(state, { ...action, userId } as BjAction);
      set({ state: next });
      await blackjackService.publish(room.id, next);
      return;
    }
    await blackjackService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, isHost: false, solo: false, status: 'idle', cleanups: [] });
  },

  setStatus: (status) => set({ status }),
}));
