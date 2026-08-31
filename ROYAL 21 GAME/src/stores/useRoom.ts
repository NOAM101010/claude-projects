import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { blackjackService } from '@/services/blackjackService';
import { createState, reduce } from '@/games/blackjack/engine';
import { redactBjState } from '@/games/blackjack/redact';
import type { BjAction, BjState } from '@/games/blackjack/types';
import { newSeed } from '@/lib/random';
import { isOnline } from '@/services/supabase';
import type { GameKey, Room, RoomMember } from '@/types';

type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface RoomState {
  room: Room | null;
  members: RoomMember[];
  state: BjState | null;
  /** MP host only: the un-redacted engine state the reducer runs against. Never
   *  rendered — keeps the dealer hole out of the host's devtools. Null otherwise
   *  (non-host, or solo where `state` is already the full engine state). */
  fullState: BjState | null;
  isHost: boolean;
  status: Status;
  /** Local-only game (solo). Never touches the network. */
  solo: boolean;
  cleanups: (() => void)[];

  startSolo: () => void;
  create: (userId: string, game: GameKey) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string) => Promise<void>;
  send: (userId: string, action: BjAction) => Promise<boolean>;
  leave: (userId: string) => Promise<void>;
  setStatus: (status: Status) => void;
}

export const useRoom = create<RoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  fullState: null,
  isHost: false,
  status: 'idle',
  solo: false,
  cleanups: [],

  startSolo: () => {
    get().cleanups.forEach((fn) => fn());
    set({ room: null, members: [], state: createState(newSeed()), fullState: null, isHost: true, solo: true, status: 'connected', cleanups: [] });
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
    set({ room, isHost, solo: false, status: 'connecting', cleanups: [], fullState: null });

    /** Rebuild a runnable engine state from a redacted `rooms.state` row by
     *  folding in the shoe secret (seed/cursor/dealer hole). RLS only lets the
     *  current host read it. Missing secret ⇒ redacted row as-is (same as today
     *  when a host resumes with nothing stored). Used on initial host connect
     *  (self-reload) and on mid-session promotion. */
    const hydrateFullState = async (redacted: BjState): Promise<BjState> => {
      const secret = await blackjackService.loadHandSecret(room.id);
      if (!secret || secret.round !== redacted.round) return redacted;
      const cards = redacted.dealer.cards.map((card, i) =>
        i === 1 && redacted.dealer.hidden && secret.dealerHole ? secret.dealerHole : card);
      return { ...redacted, seed: secret.seed, cursor: secret.cursor, dealer: { ...redacted.dealer, cards } };
    };

    const initial = isHost
      ? await blackjackService.initIfEmpty(room.id)
      : await blackjackService.loadState(room.id);
    if (isHost) {
      const full = await hydrateFullState(initial ?? createState(newSeed()));
      set({ fullState: full, state: redactBjState(full) });
    } else {
      set({ state: initial ?? createState(newSeed()) });
    }

    const cleanups: (() => void)[] = [];
    let stopHostLoop: (() => void) | null = null;
    const stepDownFromHost = () => {
      // Another client won host via reassign_room_host. Stop publishing so two
      // hosts don't fight over the room state; the liveness watcher stays up
      // and re-claims if the new host also falls quiet.
      stopHostLoop?.();
      set({ isHost: false, fullState: null });
    };
    const startHostLoop = () => {
      if (stopHostLoop) return;
      const stopRun = blackjackService.runHost(
        room.id,
        () => get().fullState ?? get().state ?? createState(newSeed()),
        (next) => set({ fullState: next, state: redactBjState(next) }),
      );
      const stopBeat = roomsService.startHostHeartbeat(room.id, userId, () => get().isHost, stepDownFromHost);
      stopHostLoop = () => { stopRun(); stopBeat(); stopHostLoop = null; };
      cleanups.push(() => stopHostLoop?.());
    };

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(blackjackService.subscribeState(room.id, (next) => {
      // The host renders from fullState, not its own redacted published row.
      if (get().isHost) return;
      const current = get().state;
      // Drop out-of-order frames, keep the newest authoritative state.
      if (!current || next.version >= current.version) set({ state: next, status: 'connected' });
    }));
    // Runs on every seated client (no-ops while we're host). Lets a dead host
    // be replaced, and lets an ex-host that stepped down re-claim later.
    cleanups.push(roomsService.watchHostLiveness(room.id, userId, () => get().isHost, async () => {
      // Promoted to host mid-session: rebuild the full engine state from the
      // redacted row + the shoe secret (RLS now lets us read it). Missing
      // secret ⇒ stay on the redacted state, same as today when a host drops.
      const full = await hydrateFullState(get().state ?? createState(newSeed()));
      set({ isHost: true, fullState: full, state: redactBjState(full) });
      startHostLoop();
    }));
    if (isHost) startHostLoop();
    set({ cleanups, status: 'connected', members: await roomsService.members(room.id) });
  },

  send: async (userId, action) => {
    const { solo, room, isHost, state } = get();
    if (solo || !room) {
      if (!state) return true;
      set({ state: reduce(state, { ...action, userId } as BjAction) });
      return true;
    }
    if (isHost) {
      const base = get().fullState ?? state;
      if (!base) return true;
      // The host applies its own intent immediately, then publishes it.
      const next = reduce(base, { ...action, userId } as BjAction);
      set({ fullState: next, state: redactBjState(next) });
      await blackjackService.publish(room.id, next);
      return true;
    }
    return blackjackService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, fullState: null, isHost: false, solo: false, status: 'idle', cleanups: [] });
  },

  setStatus: (status) => set({ status }),
}));
