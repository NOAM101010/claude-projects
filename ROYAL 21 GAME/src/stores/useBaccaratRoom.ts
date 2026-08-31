import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { baccaratService } from '@/services/baccaratService';
import { createState, reduce } from '@/games/baccarat/engine';
import type { BaccaratAction, BaccaratState } from '@/games/baccarat/types';
import { newSeed } from '@/lib/random';
import { isOnline } from '@/services/supabase';
import type { Room, RoomMember } from '@/types';

const MAX_SEATS = 6;
type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface BaccaratRoomState {
  room: Room | null;
  members: RoomMember[];
  state: BaccaratState | null;
  isHost: boolean;
  status: Status;
  cleanups: (() => void)[];

  create: (userId: string) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string) => Promise<void>;
  send: (userId: string, action: BaccaratAction) => Promise<boolean>;
  leave: (userId: string) => Promise<void>;
}

/** Baccarat multiplayer store — copied straight from the roulette pattern.
 *  Everyone sees the same shared hand; each seat's bets and net are per-user. */
export const useBaccaratRoom = create<BaccaratRoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  isHost: false,
  status: 'idle',
  cleanups: [],

  create: async (userId) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.create(userId, 'baccarat');
    if (!room) { set({ status: 'idle' }); return null; }
    await get().connect(room, userId);
    return room;
  },

  joinByCode: async (code, userId) => {
    if (!isOnline()) return null;
    set({ status: 'connecting' });
    const room = await roomsService.byCode(code);
    if (!room || room.game !== 'baccarat') { set({ status: 'idle' }); return null; }
    await roomsService.join(room.id, userId, MAX_SEATS);
    await get().connect(room, userId);
    return room;
  },

  connect: async (room, userId) => {
    get().cleanups.forEach((fn) => fn());
    const isHost = room.hostId === userId;
    set({ room, isHost, status: 'connecting', cleanups: [] });

    const initial = isHost
      ? await baccaratService.initIfEmpty(room.id)
      : await baccaratService.loadState(room.id);
    set({ state: initial ?? createState(newSeed()) });

    const cleanups: (() => void)[] = [];
    let stopHostLoop: (() => void) | null = null;
    const stepDownFromHost = () => {
      // Another client won host via reassign_room_host. Stop publishing so two
      // hosts don't fight over the room state; the liveness watcher stays up
      // and re-claims if the new host also falls quiet.
      stopHostLoop?.();
      set({ isHost: false });
    };
    const startHostLoop = () => {
      if (stopHostLoop) return;
      const stopRun = baccaratService.runHost(
        room.id,
        () => get().state ?? createState(newSeed()),
        (next) => set({ state: next }),
      );
      const stopBeat = roomsService.startHostHeartbeat(room.id, userId, () => get().isHost, stepDownFromHost);
      stopHostLoop = () => { stopRun(); stopBeat(); stopHostLoop = null; };
      cleanups.push(() => stopHostLoop?.());
    };

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(baccaratService.subscribeState(room.id, (next) => {
      const current = get().state;
      if (!current || next.version >= current.version) set({ state: next, status: 'connected' });
    }));
    // Runs on every seated client (no-ops while we're host). Lets a dead host
    // be replaced, and lets an ex-host that stepped down re-claim later.
    cleanups.push(roomsService.watchHostLiveness(room.id, userId, () => get().isHost, () => {
      set({ isHost: true });
      startHostLoop();
    }));
    if (isHost) startHostLoop();
    set({ cleanups, status: 'connected', members: await roomsService.members(room.id) });
  },

  send: async (userId, action) => {
    const { room, isHost, state } = get();
    if (!room || !state) return false;
    if (isHost) {
      const next = reduce(state, { ...action, userId } as BaccaratAction);
      set({ state: next });
      await baccaratService.publish(room.id, next);
      return true;
    }
    return baccaratService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, isHost: false, status: 'idle', cleanups: [] });
  },
}));
