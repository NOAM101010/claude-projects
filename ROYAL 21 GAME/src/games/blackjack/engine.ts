import { mulberry32, shuffle } from '@/lib/random';
import type { AvatarConfig } from '@/types';
import type { BjAction, BjHand, BjSeat, BjSide, BjState, Card, Outcome, Phase, Rank, Suit } from './types';

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const DECKS = 6;
export const MAX_SEATS = 4;
export const MAX_HANDS = 4;
export const BET_STEPS = [10, 25, 50, 100, 250, 500, 1000];

/**
 * The shoe is derived from `seed`, so every client can rebuild the exact same
 * card order and verify what the host dealt. Nothing random happens at render.
 */
export function buildShoe(seed: number): Card[] {
  const base: Card[] = [];
  for (let d = 0; d < DECKS; d++) {
    for (const s of SUITS) for (const r of RANKS) base.push({ r, s });
  }
  return shuffle(base, mulberry32(seed));
}

export const cardValue = (r: Rank) => (r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r));

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

export const isBlackjack = (hand: BjHand) =>
  hand.cards.length === 2 && !hand.fromSplit && handValue(hand.cards).total === 21;

export const isBust = (hand: BjHand) => handValue(hand.cards).total > 21;

export const canDouble = (hand: BjHand, chips: number) =>
  hand.cards.length === 2 && !hand.done && chips >= hand.bet;

export const canSplit = (hand: BjHand, seat: BjSeat, chips: number) =>
  hand.cards.length === 2 &&
  !hand.done &&
  seat.hands.length < MAX_HANDS &&
  cardValue(hand.cards[0].r) === cardValue(hand.cards[1].r) &&
  chips >= hand.bet;

export function createState(seed: number): BjState {
  return {
    version: 0,
    seed,
    cursor: 0,
    round: 0,
    phase: 'betting',
    dealer: { cards: [], hidden: true },
    seats: [],
    activeSeat: -1,
    activeHand: 0,
    lastBet: 0,
    deadline: null,
    history: [],
  };
}

export function makeSeat(userId: string, username: string, avatar: AvatarConfig, level: number): BjSeat {
  return { userId, username, avatar, level, bet: 0, ready: false, hands: [], spectator: false, net: 0 };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Draws from the deterministic shoe, reshuffling with a derived seed near the end. */
function draw(state: BjState): Card {
  const shoe = buildShoe(state.seed);
  if (state.cursor >= shoe.length - 20) {
    state.seed = (state.seed * 31 + state.round + 17) >>> 0;
    state.cursor = 0;
    return draw(state);
  }
  const card = shoe[state.cursor];
  state.cursor += 1;
  return card;
}

const newHand = (bet: number, fromSplit = false): BjHand => ({
  cards: [], bet, done: false, doubled: false, fromSplit,
});

const activePlayers = (state: BjState) => state.seats.filter((s) => !s.spectator && s.bet > 0);

/* ------------------------------------------------------------------ side bets -- */

const isRedSuit = (s: Suit) => s === 'H' || s === 'D';
/** A=1 … K=13 for straight detection. */
const rankRank = (r: Rank) => RANKS.indexOf(r) + 1;

/** Whether three ranks form a run of 3, with the Ace allowed high (Q-K-A) or low (A-2-3). */
function threeStraight(rs: Rank[]): boolean {
  const base = rs.map(rankRank);
  const variants = base.includes(1) ? [base, base.map((n) => (n === 1 ? 14 : n))] : [base];
  return variants.some((v) => {
    const s = [...v].sort((a, b) => a - b);
    return new Set(s).size === 3 && s[1] === s[0] + 1 && s[2] === s[1] + 1;
  });
}

/**
 * Payout multiplier for each side bet given the opening cards. A missing key
 * means the side lost. Pure — called once inside `deal`.
 *
 *   Perfect Pairs (player's first two): perfect 25 · coloured 12 · mixed 6
 *   21+3 (player's two + dealer up, as a poker hand):
 *     suited trips 100 · straight flush 40 · trips 30 · straight 10 · flush 5
 */
export function evalSideBets(playerFirstTwo: Card[], dealerUp: Card | undefined): Partial<Record<BjSide, number>> {
  const out: Partial<Record<BjSide, number>> = {};
  if (playerFirstTwo.length !== 2 || !dealerUp) return out;
  const [a, b] = playerFirstTwo;

  if (a.r === b.r) {
    if (a.s === b.s) out.pairs = 25;
    else if (isRedSuit(a.s) === isRedSuit(b.s)) out.pairs = 12;
    else out.pairs = 6;
  }

  const three = [a, b, dealerUp];
  const sameSuit = three.every((c) => c.s === a.s);
  const trips = a.r === b.r && b.r === dealerUp.r;
  const straight = threeStraight(three.map((c) => c.r));
  if (trips && sameSuit) out.trio = 100;
  else if (straight && sameSuit) out.trio = 40;
  else if (trips) out.trio = 30;
  else if (straight) out.trio = 10;
  else if (sameSuit) out.trio = 5;

  return out;
}

/** Resolve a seat's side bets against its opening two + the dealer up card. */
function settleSideBets(seat: BjSeat, dealerUp: Card | undefined) {
  if (!seat.sideBets) return;
  const firstTwo = seat.hands[0]?.cards.slice(0, 2) ?? [];
  const mult = evalSideBets(firstTwo, dealerUp);
  const results: Partial<Record<BjSide, number>> = {};
  for (const key of Object.keys(seat.sideBets) as BjSide[]) {
    const amount = seat.sideBets[key] ?? 0;
    if (amount <= 0) continue;
    const m = mult[key];
    results[key] = m ? amount * m : -amount;
  }
  seat.sideResults = results;
}

/** Moves the turn pointer to the next unfinished hand, or to the dealer. */
function advance(state: BjState) {
  let seatIndex = state.activeSeat;
  let handIndex = state.activeHand;
  while (seatIndex < state.seats.length) {
    const seat = state.seats[seatIndex];
    if (seat && !seat.spectator && seat.hands.length) {
      while (handIndex < seat.hands.length) {
        const hand = seat.hands[handIndex];
        if (!hand.done && !isBust(hand) && handValue(hand.cards).total < 21) {
          state.activeSeat = seatIndex;
          state.activeHand = handIndex;
          return;
        }
        hand.done = true;
        handIndex++;
      }
    }
    seatIndex++;
    handIndex = 0;
  }
  state.activeSeat = -1;
  state.activeHand = 0;
  state.phase = 'dealer';
}

function settle(state: BjState) {
  const dealerTotal = handValue(state.dealer.cards).total;
  const dealerBj = state.dealer.cards.length === 2 && dealerTotal === 21;
  const dealerBust = dealerTotal > 21;

  for (const seat of state.seats) {
    seat.net = 0;
    for (const hand of seat.hands) {
      const total = handValue(hand.cards).total;
      let outcome: Outcome;
      let payout = 0;
      if (total > 21) {
        outcome = 'bust';
        payout = 0;
      } else if (isBlackjack(hand) && !dealerBj) {
        outcome = 'blackjack';
        payout = hand.bet + Math.floor(hand.bet * 1.5); // 3:2
      } else if (dealerBj && !isBlackjack(hand)) {
        outcome = 'lose';
        payout = 0;
      } else if (dealerBj && isBlackjack(hand)) {
        outcome = 'push';
        payout = hand.bet;
      } else if (dealerBust || total > dealerTotal) {
        outcome = 'win';
        payout = hand.bet * 2;
      } else if (total === dealerTotal) {
        outcome = 'push';
        payout = hand.bet;
      } else {
        outcome = 'lose';
        payout = 0;
      }
      hand.outcome = outcome;
      hand.payout = payout;
      seat.net += payout - hand.bet;
      state.history.push({
        round: state.round, userId: seat.userId, username: seat.username, game: 'blackjack', outcome, net: payout - hand.bet,
      });
    }
    // Side bets were decided at deal time — fold their signed net in once.
    if (seat.sideResults) {
      seat.net += Object.values(seat.sideResults).reduce((sum, v) => sum + (v ?? 0), 0);
    }
  }
  state.history = state.history.slice(-40);
  state.phase = 'settled';
  state.dealer.hidden = false;
}

/**
 * The single source of truth for a hand of Blackjack.
 * Pure: same state + same action always produces the same next state, which is
 * what makes host-authoritative multiplayer verifiable by every client.
 */
export function reduce(prev: BjState, action: BjAction): BjState {
  const state = clone(prev);
  state.version = prev.version + 1;
  const seatOf = (userId: string) => state.seats.find((s) => s.userId === userId);

  switch (action.type) {
    case 'join': {
      if (seatOf(action.userId) || state.seats.length >= MAX_SEATS) return prev;
      const seat = makeSeat(action.userId, action.username, action.avatar, action.level);
      // Joining mid-hand means watching until the next round (§67).
      seat.spectator = state.phase !== 'betting';
      state.seats.push(seat);
      return state;
    }
    case 'leave': {
      state.seats = state.seats.filter((s) => s.userId !== action.userId);
      // Duel with a player gone before the match is decided: the last one
      // standing wins the pot by forfeit (a 2-player duel minus 1 = "not
      // enough players → the remaining player wins"). duelWinner() returns
      // null on a tie / incomplete score, so without this a walkout would
      // leave the match unresolved forever.
      if (state.duel && !state.duel.winner) {
        const left = state.seats.filter((s) => !s.spectator);
        if (left.length < 2) {
          state.duel = { ...state.duel, winner: left[0]?.userId ?? state.seats[0]?.userId ?? null };
        }
      }
      if (state.phase === 'playing') {
        advance(state);
        // If advance() ran off the last player and transitioned to the dealer
        // phase, run resolveDealer inline. Every other action does this at its
        // tail; leave used to skip it, and now that pagehide + ghost cleanup
        // routinely dispatch leave during a hand, the table used to hang
        // forever in 'dealer' phase with nothing dealing the dealer's cards.
        if ((state.phase as Phase) === 'dealer') return reduce(state, { type: 'resolveDealer' });
      }
      return state;
    }
    case 'bet': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting' || action.amount <= 0) return prev;
      seat.bet += action.amount;
      seat.spectator = false;
      return state;
    }
    case 'clearBet': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting') return prev;
      seat.bet = 0;
      seat.ready = false;
      seat.sideBets = undefined;
      return state;
    }
    case 'sideBet': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting') return prev;
      const bets: Partial<Record<BjSide, number>> = { ...(seat.sideBets ?? {}) };
      if (action.amount <= 0) delete bets[action.side];
      else bets[action.side] = (bets[action.side] ?? 0) + action.amount;
      seat.sideBets = Object.keys(bets).length ? bets : undefined;
      seat.spectator = false;
      return state;
    }
    case 'ready': {
      const seat = seatOf(action.userId);
      // Duel has no per-hand bet — readiness alone seats you.
      if (!seat || state.phase !== 'betting' || (!state.duel && seat.bet <= 0)) return prev;
      seat.ready = true;
      return state;
    }
    case 'openBetting': {
      // Only accept a new betting window from a settled state. Without this,
      // a rogue openBetting mid-round (double-click "new round", stale
      // action queued behind the settle) wiped every seat's placed bets —
      // chips deducted client-side, no refund. Silently dropping the intent
      // preserves the round in flight.
      if (state.phase !== 'settled' && state.phase !== 'betting') return prev;
      // While already in 'betting' with no active bets/hands, treat as a
      // no-op to be safe against double-fires. Only refresh round if we
      // came from a settled round.
      if (state.phase === 'betting') {
        // Already open; nothing to reset. Ignore.
        return prev;
      }
      state.phase = 'betting';
      state.round += 1;
      state.dealer = { cards: [], hidden: true };
      state.activeSeat = -1;
      state.activeHand = 0;
      state.deadline = null;
      for (const seat of state.seats) {
        seat.bet = 0;
        // Duel: the buy-in already bought into the whole match, so every hand
        // auto-arms — no re-ready between hands (it's a race to points).
        seat.ready = Boolean(state.duel);
        seat.hands = [];
        seat.spectator = false;
        seat.net = 0;
        seat.sideBets = undefined;
        seat.sideResults = undefined;
      }
      return state;
    }
    case 'setDeadline': {
      // Cheap on its own — the whole point is to avoid the openBetting reset
      // when the host just wants to arm the countdown timer.
      if (state.phase !== 'betting') return prev;
      state.deadline = action.deadline;
      return state;
    }
    case 'deal': {
      if (state.phase !== 'betting') return prev;
      if (state.duel) {
        // Duel: no per-hand bet — every ready seat is dealt in with a zero
        // bet (chips never move per hand; only the pot at match end does).
        const inHand = state.seats.filter((s) => !s.spectator && s.ready);
        if (!inHand.length) return prev;
        for (const seat of state.seats) {
          seat.spectator = !seat.ready;
          seat.hands = seat.ready ? [newHand(0)] : [];
        }
      } else {
        const players = activePlayers(state);
        if (!players.length) return prev;
        for (const seat of state.seats) {
          seat.spectator = seat.bet <= 0;
          seat.hands = seat.bet > 0 ? [newHand(seat.bet)] : [];
        }
        state.lastBet = players[0]?.bet ?? state.lastBet;
      }
      state.dealer.cards = [];
      state.dealer.hidden = true;
      // Two passes, players first — the way a real shoe is dealt.
      for (let pass = 0; pass < 2; pass++) {
        for (const seat of state.seats) if (seat.hands[0]) seat.hands[0].cards.push(draw(state));
        state.dealer.cards.push(draw(state));
      }
      // Side bets resolve the instant the opening cards + dealer up card are out
      // (solo only — no seat carries sideBets in cash/duel).
      for (const seat of state.seats) settleSideBets(seat, state.dealer.cards[0]);
      // Dealer natural blackjack ends the hand right here — nobody gets to act.
      // settle() already pays it out correctly (players lose, or push on their
      // own blackjack); the side bets are already scored above.
      if (state.dealer.cards.length === 2 && handValue(state.dealer.cards).total === 21) {
        state.phase = 'dealer';
        state.activeSeat = -1;
        state.activeHand = 0;
        return reduce(state, { type: 'resolveDealer' });
      }
      state.phase = 'playing';
      state.activeSeat = 0;
      state.activeHand = 0;
      advance(state);
      if ((state.phase as Phase) === 'dealer') return reduce(state, { type: 'resolveDealer' });
      return state;
    }
    case 'hit': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'playing' || state.seats[state.activeSeat] !== seat) return prev;
      const hand = seat.hands[state.activeHand];
      if (!hand || hand.done) return prev;
      hand.cards.push(draw(state));
      if (isBust(hand) || handValue(hand.cards).total === 21) hand.done = true;
      advance(state);
      if ((state.phase as Phase) === 'dealer') return reduce(state, { type: 'resolveDealer' });
      return state;
    }
    case 'stand': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'playing' || state.seats[state.activeSeat] !== seat) return prev;
      const hand = seat.hands[state.activeHand];
      if (!hand) return prev;
      hand.done = true;
      advance(state);
      if ((state.phase as Phase) === 'dealer') return reduce(state, { type: 'resolveDealer' });
      return state;
    }
    case 'double': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'playing' || state.seats[state.activeSeat] !== seat) return prev;
      const hand = seat.hands[state.activeHand];
      if (!hand || hand.cards.length !== 2 || hand.done) return prev;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(draw(state));
      hand.done = true;
      advance(state);
      if ((state.phase as Phase) === 'dealer') return reduce(state, { type: 'resolveDealer' });
      return state;
    }
    case 'split': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'playing' || state.seats[state.activeSeat] !== seat) return prev;
      const hand = seat.hands[state.activeHand];
      if (!hand || hand.cards.length !== 2 || seat.hands.length >= MAX_HANDS) return prev;
      if (cardValue(hand.cards[0].r) !== cardValue(hand.cards[1].r)) return prev;
      const moved = hand.cards.pop() as Card;
      const extra = newHand(hand.bet, true);
      extra.cards.push(moved);
      hand.fromSplit = true;
      hand.cards.push(draw(state));
      extra.cards.push(draw(state));
      seat.hands.splice(state.activeHand + 1, 0, extra);
      advance(state);
      if ((state.phase as Phase) === 'dealer') return reduce(state, { type: 'resolveDealer' });
      return state;
    }
    case 'resolveDealer': {
      if (state.phase !== 'dealer') return prev;
      state.dealer.hidden = false;
      const anyLive = state.seats.some((s) => s.hands.some((h) => !isBust(h)));
      if (anyLive) {
        // Dealer stands on all 17s (§58: no soft-17 hit rule in this house).
        while (handValue(state.dealer.cards).total < 17) state.dealer.cards.push(draw(state));
      }
      settle(state);
      return state;
    }
    case 'emote': {
      const seat = seatOf(action.userId);
      if (!seat) return prev;
      seat.emote = { id: action.emote, at: Date.now() };
      return state;
    }
    case 'reportResult': {
      state.history.push({
        round: state.round, userId: action.userId, username: action.username,
        game: action.game, outcome: action.outcome, net: action.net,
      });
      state.history = state.history.slice(-40);
      return state;
    }
    case 'setActiveMiniGame': {
      state.activeMiniGame = action.game
        ? { game: action.game, code: action.code, by: action.userId }
        : null;
      return state;
    }
    default:
      return prev;
  }
}

/** Chips a player must have on hand for an action (used for enable/disable). */
export const actionCost = (hand: BjHand | undefined) => hand?.bet ?? 0;

export const seatOf = (state: BjState, userId: string) => state.seats.find((s) => s.userId === userId);

export const totalStaked = (seat: BjSeat) => seat.hands.reduce((sum, h) => sum + h.bet, 0) || seat.bet;
