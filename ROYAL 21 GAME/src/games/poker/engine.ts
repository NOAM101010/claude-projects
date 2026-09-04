import { mulberry32, shuffle } from '@/lib/random';
import { SUITS, RANKS } from '@/games/blackjack/engine';
import { bestHand, compareScore } from './handEval';
import { computeEquity } from './equity';
import type { AvatarConfig } from '@/types';
import type {
  BlindLevel, Card, PokerAction, PokerSeat, PokerState, PotShare, ShowdownEntry, TournamentInfo,
} from './types';
import { MAX_SEATS } from './types';

export { MAX_SEATS, MIN_TO_START } from './types';

export const POKER_STAKES = [
  { sb: 5, bb: 10 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 100, bb: 200 },
  { sb: 250, bb: 500 },
] as const;

/** Standard cash-game buy-in: 100 big blinds. */
export const buyInFor = (bb: number) => bb * 100;

export function buildDeck(seed: number): Card[] {
  const base: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) base.push({ r, s });
  return shuffle(base, mulberry32(seed));
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function draw(state: PokerState): Card {
  const deck = buildDeck(state.seed);
  if (state.cursor >= deck.length) {
    state.seed = (state.seed * 31 + state.handNumber + 17) >>> 0;
    state.cursor = 0;
    return draw(state);
  }
  const card = deck[state.cursor];
  state.cursor += 1;
  return card;
}

export function createState(seed: number, sb = 25, bb = 50): PokerState {
  return {
    version: 0,
    seed,
    cursor: 0,
    handNumber: 0,
    street: 'waiting',
    seats: [],
    community: [],
    revealed: [],
    dealerSeat: -1,
    smallBlind: sb,
    bigBlind: bb,
    ante: 0,
    pot: 0,
    pots: [],
    toAct: -1,
    currentBet: 0,
    minRaise: bb,
    lastAggressorSeat: -1,
    deadline: null,
    log: [],
    showdown: null,
    lastResult: null,
    allInEquity: null,
    tournament: null,
  };
}

/** Base decision clock — fixed at the generous end (was a 15/30/60 table
 *  option that was never actually wired to the deadline). */
export const ACTION_SECONDS = 60;
/** How long a finished hand stays on screen — cards on show, countdown running — before
 *  the host deals the next one. Long enough to read the showdown and hit "show cards". */
export const NEXT_HAND_DELAY_MS = 6000;
/** Each of a player's two banked extensions adds this much. */
export const TIME_BANK_SECONDS = 60;
export const TIME_BANKS_PER_PLAYER = 2;

/** Sit & Go buy-in tiers — host picks one, everyone pays the same to sit down. */
export const SNG_BUYINS = [500, 1000, 2500, 5000, 10000] as const;
export const SNG_STARTING_STACK = 1500;
/** Every level runs this long before the next one kicks in. */
export const SNG_LEVEL_MINUTES = 2;
/** A standard turbo escalation: ante joins once stacks start getting real pressure. */
export const SNG_BLIND_LEVELS: BlindLevel[] = [
  { sb: 10, bb: 20, ante: 0 },
  { sb: 15, bb: 30, ante: 0 },
  { sb: 25, bb: 50, ante: 0 },
  { sb: 50, bb: 100, ante: 0 },
  { sb: 75, bb: 150, ante: 25 },
  { sb: 100, bb: 200, ante: 25 },
  { sb: 150, bb: 300, ante: 50 },
  { sb: 200, bb: 400, ante: 50 },
  { sb: 300, bb: 600, ante: 75 },
  { sb: 400, bb: 800, ante: 100 },
  { sb: 600, bb: 1200, ante: 150 },
  { sb: 800, bb: 1600, ante: 200 },
];

export function createTournamentState(seed: number, buyIn: number): PokerState {
  const state = createState(seed, SNG_BLIND_LEVELS[0].sb, SNG_BLIND_LEVELS[0].bb);
  state.tournament = {
    buyIn,
    startingStack: SNG_STARTING_STACK,
    levels: SNG_BLIND_LEVELS,
    levelMs: SNG_LEVEL_MINUTES * 60_000,
    startedAt: Date.now(),
    eliminated: [],
    finished: false,
    winnerId: null,
  };
  return state;
}

/** Which level the wall clock says a tournament should be on right now. */
export function levelIndexFor(tournament: TournamentInfo, now = Date.now()): number {
  const elapsed = Math.max(0, now - tournament.startedAt);
  return Math.min(tournament.levels.length - 1, Math.floor(elapsed / tournament.levelMs));
}

function makeSeat(userId: string, username: string, avatar: AvatarConfig, level: number, seat: number, stack: number, title: string | null = null, nameColor: string | null = null): PokerSeat {
  return {
    userId, username, avatar, level, seat, stack, title, nameColor,
    hole: [], folded: false, allIn: false, sittingOut: false,
    committed: 0, totalCommitted: 0, hasActed: false, lastAction: null, disconnected: false,
    timeBanksLeft: TIME_BANKS_PER_PLAYER,
  };
}

/**
 * Win probability per still-live contender, sampled the instant nobody can
 * act anymore and more than one player is still all-in against each other.
 * Exact enumeration is cheap with ≤2 unknown cards (flop/turn all-ins); a
 * preflop all-in leaves 5 unknown cards, where exhaustive enumeration is
 * ~1.4M boards, so that case falls back to a seeded Monte Carlo sample —
 * seeded off the hand's own seed so the reducer stays deterministic.
 */
function computeAllInEquity(state: PokerState): Record<string, number> {
  const active = contenders(state);
  if (active.length < 2) return {};
  if (5 - state.community.length <= 0) return {};
  const seed = (state.seed ^ (state.handNumber * 2654435761)) >>> 0;
  return computeEquity(active.map((s) => ({ userId: s.userId, hole: s.hole })), state.community, seed);
}

const seatOf = (state: PokerState, userId: string) => state.seats.find((s) => s.userId === userId);
const idxOf = (state: PokerState, userId: string) => state.seats.findIndex((s) => s.userId === userId);

/** Dealt into the hand currently being played. */
const dealtIn = (seat: PokerSeat) => seat.hole.length === 2;
/** Still contesting the pot: dealt in and hasn't folded. */
const contenders = (state: PokerState) => state.seats.filter((s) => dealtIn(s) && !s.folded);
/** Can still take a betting action this street. */
const canAct = (seat: PokerSeat) => dealtIn(seat) && !seat.folded && !seat.allIn && seat.stack > 0;

function pushLog(state: PokerState, line: string) {
  state.log = [...state.log, line].slice(-30);
}

/** Next seat index, occupied and eligible under `pred`, cycling from `from` (exclusive). */
function nextSeat(state: PokerState, from: number, pred: (s: PokerSeat) => boolean): number {
  if (!state.seats.length) return -1;
  for (let step = 1; step <= state.seats.length; step++) {
    const i = (from + step) % state.seats.length;
    if (pred(state.seats[i])) return i;
  }
  return -1;
}

function bettingDone(state: PokerState): boolean {
  const acting = contenders(state).filter((s) => !s.allIn);
  if (acting.length === 0) return true;
  return acting.every((s) => s.hasActed && s.committed === state.currentBet);
}

function advanceToAct(state: PokerState) {
  if (contenders(state).length <= 1) { state.toAct = -1; state.deadline = null; return; }
  if (bettingDone(state)) {
    state.toAct = -1;
    state.deadline = null;
    // Everyone left in the pot is all-in against each other with more streets still to come —
    // this is the one moment to price the runout before it happens.
    if (!state.allInEquity && contenders(state).filter((s) => !s.allIn).length === 0) {
      state.allInEquity = computeAllInEquity(state);
    }
    return;
  }
  const next = nextSeat(state, state.toAct, (s) => canAct(s) && !(s.hasActed && s.committed === state.currentBet));
  state.toAct = next;
  state.deadline = null;
}

function reopenAction(state: PokerState, exceptIdx: number) {
  state.seats.forEach((s, i) => { if (i !== exceptIdx && canAct(s)) s.hasActed = false; });
}

function computePots(seats: PokerSeat[]): PotShare[] {
  const contributions = seats
    .filter((s) => s.totalCommitted > 0)
    .map((s) => ({ userId: s.userId, amount: s.totalCommitted, folded: s.folded }));
  const levels = [...new Set(contributions.map((c) => c.amount))].sort((a, b) => a - b);
  const pots: PotShare[] = [];
  let prev = 0;
  for (const level of levels) {
    const layer = level - prev;
    if (layer <= 0) { prev = level; continue; }
    const layerContributors = contributions.filter((c) => c.amount >= level);
    const amount = layer * layerContributors.length;
    const eligible = layerContributors.filter((c) => !c.folded).map((c) => c.userId);
    if (eligible.length) pots.push({ amount, eligible });
    else if (pots.length) pots[pots.length - 1].amount += amount;
    prev = level;
  }
  return pots;
}

function payWinners(state: PokerState, pot: PotShare, evalByUser: Map<string, number[]>, winnings: Map<string, number>) {
  let best: number[] | null = null;
  let winners: PokerSeat[] = [];
  for (const userId of pot.eligible) {
    const seat = seatOf(state, userId);
    const score = evalByUser.get(userId);
    if (!seat || !score) continue;
    if (!best || compareScore(score, best) > 0) { best = score; winners = [seat]; }
    else if (compareScore(score, best) === 0) winners.push(seat);
  }
  if (!winners.length) return;
  const startAfter = state.dealerSeat;
  const ordered = [...winners].sort((a, b) => {
    const da = (a.seat - startAfter + MAX_SEATS) % MAX_SEATS;
    const db = (b.seat - startAfter + MAX_SEATS) % MAX_SEATS;
    return da - db;
  });
  const share = Math.floor(pot.amount / ordered.length);
  let remainder = pot.amount - share * ordered.length;
  for (const seat of ordered) {
    const extra = remainder > 0 ? 1 : 0;
    if (extra) remainder -= 1;
    const paid = share + extra;
    seat.stack += paid;
    winnings.set(seat.userId, (winnings.get(seat.userId) ?? 0) + paid);
  }
  pushLog(state, `${ordered.map((s) => s.username).join(', ')} ${ordered.length > 1 ? 'split' : 'wins'} ${pot.amount}`);
}

function finishHand(state: PokerState, uncontested: boolean) {
  const committed = new Map(state.seats.map((s) => [s.userId, s.totalCommitted]));
  const winnings = new Map<string, number>();
  state.pots = computePots(state.seats);

  if (uncontested) {
    const winner = contenders(state)[0];
    if (winner) {
      const amount = state.pots.reduce((sum, p) => sum + p.amount, 0);
      winner.stack += amount;
      winnings.set(winner.userId, amount);
      pushLog(state, `${winner.username} wins ${amount} — everyone else folded`);
    }
    state.showdown = null;
  } else {
    const evalByUser = new Map<string, number[]>();
    const results = new Map<string, { hole: Card[]; best: Card[]; category: string }>();
    for (const seat of contenders(state)) {
      const result = bestHand([...seat.hole, ...state.community]);
      evalByUser.set(seat.userId, result.score);
      results.set(seat.userId, { hole: seat.hole, best: result.cards, category: result.category });
    }
    for (const pot of state.pots) payWinners(state, pot, evalByUser, winnings);
    state.showdown = contenders(state).map((seat) => ({
      userId: seat.userId,
      hole: results.get(seat.userId)?.hole ?? [],
      best: results.get(seat.userId)?.best ?? [],
      category: results.get(seat.userId)?.category ?? 'highCard',
      won: winnings.get(seat.userId) ?? 0,
      folded: false,
    })) as ShowdownEntry[];
  }

  // Net chips won/lost this hand — everyone who put money in, winnings minus what they staked.
  state.lastResult = [...committed.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([userId, amount]) => {
      const net = (winnings.get(userId) ?? 0) - amount;
      const equity = state.allInEquity?.[userId];
      return { userId, net, longshot: net > 0 && equity !== undefined && equity <= 0.10 };
    });

  for (const seat of state.seats) {
    seat.committed = 0;
    seat.hasActed = false;
    if (seat.stack <= 0) seat.sittingOut = true;
  }
  state.pot = 0;
  state.street = 'waiting';
  state.toAct = -1;
  state.currentBet = 0;
  state.lastAggressorSeat = -1;

  if (state.tournament) {
    const t = state.tournament;
    for (const seat of state.seats) {
      if (seat.stack <= 0 && !t.eliminated.includes(seat.userId)) {
        t.eliminated.push(seat.userId);
        pushLog(state, `${seat.username} is eliminated`);
      }
    }
    const alive = state.seats.filter((s) => s.stack > 0);
    if (alive.length <= 1 && !t.finished) {
      t.finished = true;
      t.winnerId = alive[0]?.userId ?? null;
      if (alive[0]) pushLog(state, `${alive[0].username} wins the tournament!`);
    }
  }
}

function dealCommunity(state: PokerState, count: number) {
  draw(state); // burn
  for (let i = 0; i < count; i++) state.community.push(draw(state));
}

function openNewStreet(state: PokerState) {
  for (const seat of state.seats) {
    seat.committed = 0;
    seat.hasActed = false;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.lastAggressorSeat = -1;
  const first = nextSeat(state, state.dealerSeat, (s) => canAct(s));
  state.toAct = first;
  advanceToAct(state);
}

function resolveStreetEnd(state: PokerState) {
  if (contenders(state).length <= 1) { finishHand(state, true); return; }
  if (state.street === 'river') { finishHand(state, false); return; }

  if (state.street === 'preflop') { dealCommunity(state, 3); state.street = 'flop'; pushLog(state, 'Flop'); }
  else if (state.street === 'flop') { dealCommunity(state, 1); state.street = 'turn'; pushLog(state, 'Turn'); }
  else if (state.street === 'turn') { dealCommunity(state, 1); state.street = 'river'; pushLog(state, 'River'); }

  openNewStreet(state);
  if (state.toAct === -1) resolveStreetEnd(state);
}

function startHand(state: PokerState) {
  if (state.tournament?.finished) return;
  const eligible = state.seats.filter((s) => !s.sittingOut && s.stack > 0);
  if (eligible.length < 2) return;

  // Blinds/ante for a Sit & Go are a pure function of the wall clock, re-read fresh every hand
  // so a level change never needs its own action or depends on anyone dispatching it in time.
  if (state.tournament) {
    const level = state.tournament.levels[levelIndexFor(state.tournament)];
    state.smallBlind = level.sb;
    state.bigBlind = level.bb;
    state.ante = level.ante;
  }

  for (const seat of state.seats) {
    seat.hole = [];
    seat.folded = true;
    seat.allIn = false;
    seat.committed = 0;
    seat.totalCommitted = 0;
    seat.hasActed = false;
    seat.lastAction = null;
  }
  for (const seat of eligible) seat.folded = false;

  state.handNumber += 1;
  state.community = [];
  state.revealed = [];
  state.pot = 0;
  state.pots = [];
  state.showdown = null;
  state.lastResult = null;
  state.allInEquity = null;
  state.log = [];

  state.dealerSeat = state.dealerSeat < 0
    ? state.seats.findIndex((s) => s.userId === eligible[0].userId)
    : nextSeat(state, state.dealerSeat, (s) => !s.sittingOut && s.stack > 0);

  const heads = eligible.length === 2;
  const sbIdx = heads ? state.dealerSeat : nextSeat(state, state.dealerSeat, (s) => !s.sittingOut && s.stack > 0);
  const bbIdx = nextSeat(state, sbIdx, (s) => !s.sittingOut && s.stack > 0);

  // Dead money, straight into the pot — doesn't count toward what a seat has "committed" this street.
  if (state.ante > 0) {
    for (const seat of eligible) {
      const paid = Math.min(state.ante, seat.stack);
      seat.stack -= paid;
      seat.totalCommitted += paid;
      state.pot += paid;
      if (seat.stack === 0) seat.allIn = true;
    }
    pushLog(state, `Ante ${state.ante} from everyone`);
  }

  const postBlind = (idx: number, amount: number) => {
    const seat = state.seats[idx];
    const paid = Math.min(amount, seat.stack);
    seat.stack -= paid;
    seat.committed = paid;
    // += , not =: an ante may already have put this seat's totalCommitted above zero this hand.
    seat.totalCommitted += paid;
    seat.hasActed = false;
    seat.lastAction = 'post';
    if (seat.stack === 0) seat.allIn = true;
    state.pot += paid;
  };
  postBlind(sbIdx, state.smallBlind);
  postBlind(bbIdx, state.bigBlind);
  pushLog(state, `${state.seats[sbIdx].username} posts small blind ${state.smallBlind}`);
  pushLog(state, `${state.seats[bbIdx].username} posts big blind ${state.bigBlind}`);

  // Two-pass deal, starting left of the button, to everyone still in the hand.
  for (let pass = 0; pass < 2; pass++) {
    let idx = state.dealerSeat;
    for (let n = 0; n < eligible.length; n++) {
      idx = nextSeat(state, idx, (s) => !s.folded);
      state.seats[idx].hole.push(draw(state));
    }
  }

  state.street = 'preflop';
  state.currentBet = state.bigBlind;
  state.minRaise = state.bigBlind;
  state.lastAggressorSeat = bbIdx;
  state.toAct = nextSeat(state, bbIdx, (s) => canAct(s));
  advanceToAct(state);
  if (state.toAct === -1) resolveStreetEnd(state);
}

function applyContribution(state: PokerState, seat: PokerSeat, toLevel: number): number {
  const delta = Math.max(0, Math.min(toLevel - seat.committed, seat.stack));
  seat.stack -= delta;
  seat.committed += delta;
  seat.totalCommitted += delta;
  state.pot += delta;
  if (seat.stack === 0) seat.allIn = true;
  return delta;
}

export function reduce(prev: PokerState, action: PokerAction): PokerState {
  const state = clone(prev);
  state.version = prev.version + 1;

  switch (action.type) {
    case 'join': {
      if (seatOf(state, action.userId) || state.seats.length >= MAX_SEATS) return prev;
      // Sit & Go: fixed buy-in, no seating after the first hand — no late registration, no rebuys.
      if (state.tournament && state.handNumber > 0) return prev;
      const taken = new Set(state.seats.map((s) => s.seat));
      let seatNo = 0;
      while (taken.has(seatNo) && seatNo < MAX_SEATS) seatNo += 1;
      const buyIn = state.tournament ? state.tournament.startingStack : Math.max(0, Math.round(action.buyIn));
      const seat = makeSeat(action.userId, action.username, action.avatar, action.level, seatNo, buyIn, action.title ?? null, action.nameColor ?? null);
      seat.sittingOut = state.street !== 'waiting';
      state.seats.push(seat);
      state.seats.sort((a, b) => a.seat - b.seat);
      pushLog(state, `${seat.username} sits down with ${seat.stack}`);
      return state;
    }
    case 'leave': {
      // Remember which userId was about to act (if any) so we can re-find
      // their new index — or advance past them — after the filter shifts every
      // seat left of them.
      const wasActingId = state.toAct >= 0 ? state.seats[state.toAct]?.userId : null;
      const wasDealerId = state.dealerSeat >= 0 ? state.seats[state.dealerSeat]?.userId : null;
      const wasAggressorId = state.lastAggressorSeat >= 0 ? state.seats[state.lastAggressorSeat]?.userId : null;

      state.seats = state.seats.filter((s) => s.userId !== action.userId);

      // Re-anchor dealer/aggressor to their new indices. If they were the
      // leaver, hand the button to the seat that *would* have been to their
      // left (post-filter, this is the index one before where they sat).
      // Setting dealerSeat=-1 broke button rotation for the rest of the hand
      // and started openNewStreet from index 0 — unfair to whoever happened
      // to be seated there.
      const dealerLeft = state.dealerSeat >= 0 && wasDealerId === action.userId
        ? Math.max(0, Math.min(state.dealerSeat - 1, state.seats.length - 1))
        : -1;
      state.dealerSeat = wasDealerId === action.userId
        ? dealerLeft
        : (wasDealerId ? state.seats.findIndex((s) => s.userId === wasDealerId) : -1);
      state.lastAggressorSeat = wasAggressorId && wasAggressorId !== action.userId
        ? state.seats.findIndex((s) => s.userId === wasAggressorId)
        : -1;

      if (contenders(state).length <= 1 && state.street !== 'waiting') {
        finishHand(state, true);
        return state;
      }

      // Reset toAct correctly. If the leaver was the one about to act, or their
      // old index no longer resolves to the same player, pick the next seat
      // that can still act starting from where the leaver was.
      if (wasActingId === action.userId || wasActingId === null) {
        // Leaver was to act — advance to the next eligible seat, or -1 if
        // nobody can (which triggers street resolution above via bettingDone).
        const anchor = state.dealerSeat >= 0 ? state.dealerSeat : 0;
        const next = nextSeat(state, anchor - 1 + state.seats.length, (s) => canAct(s) && !(s.hasActed && s.committed === state.currentBet));
        state.toAct = next;
        state.deadline = null;
        if (state.toAct === -1 && state.street !== 'waiting') resolveStreetEnd(state);
      } else {
        // Leaver was NOT to act — re-find the actor at their new index.
        const newIdx = state.seats.findIndex((s) => s.userId === wasActingId);
        state.toAct = newIdx;
        if (newIdx === -1) state.deadline = null;
      }
      return state;
    }
    case 'topUp': {
      const seat = seatOf(state, action.userId);
      if (!seat || action.amount <= 0) return prev;
      seat.stack += Math.round(action.amount);
      if (seat.stack > 0) seat.sittingOut = state.street !== 'waiting' ? seat.sittingOut : false;
      return state;
    }
    case 'sitOut': {
      const seat = seatOf(state, action.userId);
      if (!seat) return prev;
      seat.sittingOut = true;
      return state;
    }
    case 'sitIn': {
      const seat = seatOf(state, action.userId);
      if (!seat || seat.stack <= 0) return prev;
      seat.sittingOut = false;
      return state;
    }
    case 'startHand': {
      if (state.street !== 'waiting') return prev;
      startHand(state);
      return state;
    }
    case 'fold': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      seat.folded = true;
      seat.hasActed = true;
      seat.lastAction = 'fold';
      pushLog(state, `${seat.username} folds`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    case 'check': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      if (seat.committed !== state.currentBet) return prev;
      seat.hasActed = true;
      seat.lastAction = 'check';
      pushLog(state, `${seat.username} checks`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    case 'call': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      const paid = applyContribution(state, seat, state.currentBet);
      seat.hasActed = true;
      seat.lastAction = seat.allIn ? 'allin' : 'call';
      pushLog(state, `${seat.username} ${seat.allIn ? 'calls all-in' : 'calls'} ${paid}`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    case 'bet': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      if (state.currentBet !== 0) return prev;
      const amount = Math.max(0, Math.min(Math.round(action.amount), seat.stack));
      if (amount < Math.min(state.bigBlind, seat.stack)) return prev;
      applyContribution(state, seat, amount);
      state.currentBet = amount;
      state.minRaise = amount;
      state.lastAggressorSeat = idx;
      seat.lastAction = seat.allIn ? 'allin' : 'bet';
      reopenAction(state, idx);
      seat.hasActed = true;
      pushLog(state, `${seat.username} ${seat.allIn ? 'bets all-in' : 'bets'} ${amount}`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    case 'raise': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      // Short-all-in guard: if this seat already acted this street at a lower
      // current bet, they're being asked to call because a subsequent short
      // jam only bumped the price. Standard tournament rule — they may
      // call or fold, but not raise. Without this the seat could re-raise off
      // a short all-in that had no legal reopen.
      if (seat.hasActed && seat.committed < state.currentBet) return prev;
      const maxLevel = seat.committed + seat.stack;
      const requested = Math.round(action.amount);
      const minLevel = state.currentBet + state.minRaise;
      if (requested <= state.currentBet) return prev;
      const level = Math.min(requested < minLevel ? maxLevel : requested, maxLevel);
      if (level <= state.currentBet && level < maxLevel) return prev;
      const raiseSize = level - state.currentBet;
      applyContribution(state, seat, level);
      if (raiseSize >= state.minRaise || level === maxLevel) state.minRaise = Math.max(state.minRaise, raiseSize);
      state.currentBet = level;
      state.lastAggressorSeat = idx;
      seat.lastAction = seat.allIn ? 'allin' : 'raise';
      reopenAction(state, idx);
      seat.hasActed = true;
      pushLog(state, `${seat.username} ${seat.allIn ? 'raises all-in to' : 'raises to'} ${level}`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    case 'allin': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      const level = seat.committed + seat.stack;
      const isRaise = level > state.currentBet;
      // Short-all-in guard, same rationale as the raise case. A seat that
      // already acted at a lower current bet can call (level<=currentBet) but
      // can't re-jam over it as a raise.
      if (seat.hasActed && seat.committed < state.currentBet && isRaise) return prev;
      applyContribution(state, seat, level);
      seat.lastAction = 'allin';
      if (isRaise) {
        const raiseSize = level - state.currentBet;
        // Standard tournament rule: a short all-in — a jam that comes to less
        // than a full min-raise — is treated as a call, not a raise. The
        // current bet climbs to accommodate it, but players who already acted
        // this street do NOT get another decision. Previously the engine
        // always reopened action, letting someone re-raise off a short jam.
        const isFullRaise = raiseSize >= state.minRaise;
        if (isFullRaise) {
          state.minRaise = raiseSize;
          state.currentBet = level;
          state.lastAggressorSeat = idx;
          reopenAction(state, idx);
        } else {
          // Short all-in: bump the price to call for anyone still to act, but
          // don't reopen action for players already square with the pot.
          state.currentBet = level;
        }
      }
      seat.hasActed = true;
      pushLog(state, `${seat.username} is all-in for ${level}`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    case 'showCards': {
      // End of hand only. The sender flips their own hole for the whole table —
      // a folded bluff-show or a slow-roll reveal. Anyone dealt into the hand
      // just played may show; nobody else, and never mid-hand.
      if (state.street !== 'waiting') return prev;
      const seat = seatOf(state, action.userId);
      if (!seat || seat.hole.length !== 2) return prev;
      if (state.revealed.includes(action.userId)) return prev;
      state.revealed = [...state.revealed, action.userId];
      pushLog(state, `${seat.username} shows their hand`);
      return state;
    }
    case 'setDeadline': {
      if (state.toAct === -1) return prev;
      state.deadline = action.deadline;
      return state;
    }
    case 'useTimeBank': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      if (seat.timeBanksLeft <= 0) return prev;
      seat.timeBanksLeft -= 1;
      state.deadline = (state.deadline ?? Date.now()) + TIME_BANK_SECONDS * 1000;
      return state;
    }
    case 'timeout': {
      const idx = idxOf(state, action.userId);
      if (idx === -1 || state.toAct !== idx) return prev;
      const seat = state.seats[idx];
      seat.folded = true;
      seat.hasActed = true;
      seat.lastAction = 'fold';
      pushLog(state, `${seat.username} ran out of time and folds`);
      advanceToAct(state);
      if (state.toAct === -1) resolveStreetEnd(state);
      return state;
    }
    default:
      return prev;
  }
}

export const seatIndexOf = idxOf;
export const seatByUser = seatOf;
export const isContender = (seat: PokerSeat) => dealtIn(seat) && !seat.folded;
export const canSeatAct = canAct;

/** Chips a call currently costs a seat. */
export const callCost = (state: PokerState, seat: PokerSeat) => Math.max(0, Math.min(state.currentBet - seat.committed, seat.stack));
/** Smallest legal raise-to level for a seat right now. */
export const minRaiseTo = (state: PokerState, seat: PokerSeat) =>
  Math.min(state.currentBet + state.minRaise, seat.committed + seat.stack);
