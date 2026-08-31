import { create } from 'zustand';
import { roomsService } from '@/services/roomsService';
import { pokerService } from '@/services/pokerService';
import { createState, reduce } from '@/games/poker/engine';
import { redactPokerState } from '@/games/poker/redact';
import { MAX_SEATS } from '@/games/poker/types';
import type { Card, PokerAction, PokerState } from '@/games/poker/types';
import { isOnline } from '@/services/supabase';
import type { Room, RoomConfig, RoomMember } from '@/types';

type Status = 'idle' | 'connecting' | 'connected' | 'lost';

interface PokerRoomState {
  room: Room | null;
  members: RoomMember[];
  /** What the scene renders. For a non-host this is the redacted server row with
   *  our own hole merged back in; for the host it's `fullState` redacted to us. */
  state: PokerState | null;
  /** Host only: the un-redacted engine state the reducer must run against.
   *  Never rendered — keeping it out of `state` stops the host seeing opponents'
   *  cards in devtools. Null for a non-host. */
  fullState: PokerState | null;
  isHost: boolean;
  status: Status;
  cleanups: (() => void)[];

  create: (userId: string, sb: number, bb: number, config?: RoomConfig) => Promise<Room | null>;
  joinByCode: (code: string, userId: string) => Promise<Room | null>;
  connect: (room: Room, userId: string, sb: number, bb: number) => Promise<void>;
  send: (userId: string, action: PokerAction) => Promise<void>;
  leave: (userId: string) => Promise<void>;
}

/** Inject our own hole cards (fetched from `poker_hole`) into the redacted state
 *  the server sent us. No-op when privacy is off or the row isn't for this hand. */
function withOwnHole(state: PokerState, userId: string, hole: { cards: Card[]; handNumber: number } | null): PokerState {
  if (!hole || hole.handNumber !== state.handNumber || hole.cards.length === 0) return state;
  const idx = state.seats.findIndex((s) => s.userId === userId);
  if (idx === -1 || state.seats[idx].hole.length === 0) return state;
  const seats = state.seats.map((s, i) => (i === idx ? { ...s, hole: hole.cards } : s));
  return { ...state, seats };
}

export const usePokerRoom = create<PokerRoomState>()((set, get) => ({
  room: null,
  members: [],
  state: null,
  fullState: null,
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
    set({ room, isHost, status: 'connecting', cleanups: [], fullState: null });

    // Cache of our own hole for the current hand, keyed by handNumber.
    let holeCache: { cards: Card[]; handNumber: number } | null = null;

    /** Fetch our hole for `hand` and patch it into `state` if still current. */
    const fetchAndMergeHole = async (hand: number) => {
      if (pokerService.holePrivacyAvailable === false) return;
      if (holeCache?.handNumber === hand) return;
      const row = await pokerService.loadHole(room.id, userId);
      if (!row) return;
      holeCache = row;
      const cur = get().state;
      if (cur && cur.handNumber === row.handNumber && !get().isHost) {
        set({ state: withOwnHole(cur, userId, row) });
      }
    };

    /** Apply an incoming server row for a non-host: render it immediately, then
     *  reconcile our own hole asynchronously. */
    const applyServerState = (next: PokerState) => {
      const merged = withOwnHole(next, userId, holeCache);
      set({ state: merged, status: 'connected' });
      void fetchAndMergeHole(next.handNumber);
    };

    const seed0 = () => createState(Math.floor(Math.random() * 2 ** 31), sb, bb);

    /** Turn a redacted `rooms.state` row back into a runnable engine state by
     *  folding in the hand secret (seed/cursor/holes). RLS only lets the current
     *  host read the secret. Missing secret ⇒ return the redacted state as-is
     *  (same as today when a host resumes with no stored secret). Used both on
     *  the initial host connect (self-reload) and on mid-session promotion. */
    const hydrateFullState = async (redacted: PokerState): Promise<PokerState> => {
      const secret = await pokerService.loadHandSecret(room.id);
      if (!secret || secret.handNumber !== redacted.handNumber) return redacted;
      const holeByUser = new Map(secret.seats.map((s) => [s.userId, s.cards]));
      return {
        ...redacted,
        seed: secret.seed,
        cursor: secret.cursor,
        seats: redacted.seats.map((s) => {
          const cards = holeByUser.get(s.userId);
          return cards && s.hole.length === 2 ? { ...s, hole: cards } : s;
        }),
      };
    };

    const initial = isHost
      ? await pokerService.initIfEmpty(room.id, sb, bb)
      : await pokerService.loadState(room.id);
    if (isHost) {
      const full = await hydrateFullState(initial ?? seed0());
      set({ fullState: full, state: redactPokerState(full, userId) });
    } else {
      const base = initial ?? seed0();
      set({ state: withOwnHole(base, userId, holeCache) });
      void fetchAndMergeHole(base.handNumber);
    }

    const cleanups: (() => void)[] = [];
    let stopHostLoop: (() => void) | null = null;
    const stepDownFromHost = () => {
      stopHostLoop?.();
      set({ isHost: false, fullState: null });
    };
    const startHostLoop = () => {
      if (stopHostLoop) return;
      const stopRun = pokerService.runHost(
        room.id,
        () => get().fullState ?? get().state ?? seed0(),
        (next) => set({ fullState: next, state: redactPokerState(next, userId) }),
      );
      const stopBeat = roomsService.startHostHeartbeat(room.id, userId, () => get().isHost, stepDownFromHost);
      stopHostLoop = () => { stopRun(); stopBeat(); stopHostLoop = null; };
      cleanups.push(() => stopHostLoop?.());
    };

    cleanups.push(roomsService.subscribeMembers(room.id, (members) => set({ members })));
    cleanups.push(pokerService.subscribeState(room.id, (next) => {
      // The host ignores its own published (redacted) row — it renders from fullState.
      if (get().isHost) return;
      const current = get().state;
      if (!current || next.version >= current.version) applyServerState(next);
    }));
    // Runs on every seated client (no-ops while we're host). Lets a dead host
    // be replaced, and lets an ex-host that stepped down re-claim later.
    cleanups.push(roomsService.watchHostLiveness(room.id, userId, () => get().isHost, async () => {
      // Promoted to host mid-session: rebuild the full engine state from the
      // redacted row + the hand secret (RLS now lets us read it). If the secret
      // is missing we stay on the redacted state — same as today when a host
      // drops mid-hand, not a new regression.
      const full = await hydrateFullState(get().state ?? seed0());
      set({ isHost: true, fullState: full, state: redactPokerState(full, userId) });
      startHostLoop();
    }));
    if (isHost) startHostLoop();
    set({ cleanups, status: 'connected', members: await roomsService.members(room.id) });
  },

  send: async (userId, action) => {
    const { room, isHost, fullState, state } = get();
    if (!room) return;
    if (isHost) {
      const base = fullState ?? state;
      if (!base) return;
      const next = reduce(base, { ...action, userId } as PokerAction);
      set({ fullState: next, state: redactPokerState(next, userId) });
      await pokerService.publish(room.id, next);
      return;
    }
    await pokerService.sendAction(room.id, userId, action);
  },

  leave: async (userId) => {
    const { room, cleanups } = get();
    cleanups.forEach((fn) => fn());
    if (room) await roomsService.leave(room.id, userId);
    set({ room: null, members: [], state: null, fullState: null, isHost: false, status: 'idle', cleanups: [] });
  },
}));
