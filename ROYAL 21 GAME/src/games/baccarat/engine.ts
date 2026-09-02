import type {
  BaccaratAction, BaccaratBet, BaccaratOutcome, BaccaratSide, BaccaratState, Card, Rank, Suit,
} from './types';

/**
 * Baccarat — Punto Banco rules, the version every real casino runs.
 *
 * Card values: A=1, 2-9 face, 10/J/Q/K=0. Hand total is (sum of cards) mod 10.
 *
 * Deal: two cards each to Player and Banker. A total of 8 or 9 on the initial
 * two ("natural") ends the hand immediately. Otherwise the drawing rules
 * decide who gets a third card — Player draws on 0-5, stands on 6-7. Banker's
 * third-card rule is the historically weird one and depends on Player's third
 * card; see `bankerDraws()` below.
 *
 * Payouts:
 *   Player  ...... 1:1
 *   Banker  ...... 1:0.95  (5% commission — the house edge that keeps the game legal)
 *   (a tie pushes any Player/Banker bet — there is no Tie bet)
 * Side bets:
 *   Player Pair .. 11:1
 *   Banker Pair .. 11:1
 *   Perfect Pair . 25:1 (either side's first two cards are identical rank AND suit)
 *   Big .......... 0.54:1 (5 or 6 cards were dealt)
 *   Small ........ 1.5:1  (only 4 cards were dealt)
 */

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Card values for Baccarat scoring (very different from Blackjack). */
export function cardValue(card: Card): number {
  if (card.r === 'A') return 1;
  if (card.r === '10' || card.r === 'J' || card.r === 'Q' || card.r === 'K') return 0;
  return Number(card.r);
}

export function handTotal(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardValue(c), 0) % 10;
}

/** Deterministic RNG so multiplayer clients agree on the shoe. Same LCG used
 *  by the other engines in this repo. */
function next(state: BaccaratState): Card {
  state.cursor = (state.cursor * 1103515245 + 12345) & 0x7fffffff;
  const r = RANKS[state.cursor % RANKS.length];
  state.cursor = (state.cursor * 1103515245 + 12345) & 0x7fffffff;
  const s = SUITS[state.cursor % SUITS.length];
  return { r, s };
}

export function createState(seed: number): BaccaratState {
  return {
    version: 0,
    seed,
    cursor: seed,
    round: 0,
    phase: 'betting',
    player: [],
    banker: [],
    bet: { main: null, sides: {} },
    outcome: null,
    net: 0,
    sideResults: {},
    history: [],
    lastBet: { main: null, sides: {} },
    seats: [],
    deadline: null,
  };
}

/** Banker's third-card rule — the notoriously fiddly table every dealer memorises. */
function bankerDraws(bankerTotal: number, playerThird: Card | null): boolean {
  if (bankerTotal >= 7) return false;
  if (bankerTotal <= 2) return true;
  if (playerThird === null) {
    // Player stood (had 6 or 7) — banker draws on 0-5, stands on 6-7. Already
    // handled by the top cases; this covers total===6, which stands.
    return bankerTotal <= 5;
  }
  const p3 = cardValue(playerThird);
  if (bankerTotal === 3) return p3 !== 8;
  if (bankerTotal === 4) return p3 >= 2 && p3 <= 7;
  if (bankerTotal === 5) return p3 >= 4 && p3 <= 7;
  if (bankerTotal === 6) return p3 === 6 || p3 === 7;
  return false;
}

function isNatural(total: number) { return total === 8 || total === 9; }

function samePair(cards: Card[]): { pair: boolean; perfect: boolean } {
  if (cards.length < 2) return { pair: false, perfect: false };
  const [a, b] = cards;
  const pair = a.r === b.r;
  return { pair, perfect: pair && a.s === b.s };
}

/** Runs the deal front-to-back once bets are locked and produces the settled state. */
function playHand(state: BaccaratState): void {
  // Two cards to each side.
  state.player = [next(state), next(state)];
  state.banker = [next(state), next(state)];

  let pt = handTotal(state.player);
  let bt = handTotal(state.banker);

  // Natural on either side ends the hand right here.
  if (!isNatural(pt) && !isNatural(bt)) {
    let playerThird: Card | null = null;
    if (pt <= 5) {
      playerThird = next(state);
      state.player.push(playerThird);
      pt = handTotal(state.player);
    }
    if (bankerDraws(bt, playerThird)) {
      state.banker.push(next(state));
      bt = handTotal(state.banker);
    }
  }

  state.outcome = pt > bt ? 'player' : bt > pt ? 'banker' : 'tie';
  state.net = settlePayouts(state);
  state.history = [state.outcome, ...state.history].slice(0, 12);
  state.phase = 'settled';
}

/** Compute the payout for a single BaccaratBet against the resolved hand. */
export function settleOne(bet: BaccaratBet, outcome: BaccaratOutcome, player: Card[], banker: Card[]): {
  net: number; sideResults: Partial<Record<BaccaratSide, number>>;
} {
  let net = 0;
  const sideResults: Partial<Record<BaccaratSide, number>> = {};

  if (bet.main) {
    const { side, amount } = bet.main;
    if (side === outcome) {
      net += side === 'banker' ? Math.round(amount * 0.95) : amount;
    } else if (outcome === 'tie') {
      net += 0; // a tie pushes any Player/Banker bet — stake returned
    } else {
      net -= amount;
    }
  }

  const playerPair = samePair(player);
  const bankerPair = samePair(banker);
  const totalCards = player.length + banker.length;

  for (const [key, amount] of Object.entries(bet.sides)) {
    if (!amount) continue;
    const side = key as BaccaratSide;
    let payout = -amount;
    if (side === 'playerPair' && playerPair.pair) payout = amount * 11;
    else if (side === 'bankerPair' && bankerPair.pair) payout = amount * 11;
    else if (side === 'perfectPair' && (playerPair.perfect || bankerPair.perfect)) payout = amount * 25;
    else if (side === 'big' && (totalCards === 5 || totalCards === 6)) payout = Math.round(amount * 0.54);
    else if (side === 'small' && totalCards === 4) payout = Math.round(amount * 1.5);
    sideResults[side] = payout;
    net += payout;
  }
  return { net, sideResults };
}

/** Apply all payouts and return the net chip delta for the SOLO player. */
function settlePayouts(state: BaccaratState): number {
  const { net, sideResults } = settleOne(state.bet, state.outcome as BaccaratOutcome, state.player, state.banker);
  state.sideResults = sideResults;
  return net;
}

/** Total chips this bet costs to place — main + all sides. */
export function betCost(bet: BaccaratBet): number {
  const sideTotal = Object.values(bet.sides).reduce((sum, n) => sum + (n ?? 0), 0);
  return (bet.main?.amount ?? 0) + sideTotal;
}

/** Paytable rows for the rulebook / paytable modal. */
export const PAYTABLE = [
  { key: 'player', payout: '1 : 1' },
  { key: 'banker', payout: '1 : 0.95 (5% commission)' },
  { key: 'playerPair', payout: '11 : 1' },
  { key: 'bankerPair', payout: '11 : 1' },
  { key: 'perfectPair', payout: '25 : 1' },
  { key: 'big', payout: '0.54 : 1' },
  { key: 'small', payout: '1.5 : 1' },
] as const;

/** Baccarat reducer — handles solo (bet lives on state.bet) and multiplayer
 *  (bet lives per-seat, cards shared). Same shape as the other games so the
 *  scenes stay familiar. */
export function reduce(prev: BaccaratState, action: BaccaratAction): BaccaratState {
  const state: BaccaratState = {
    ...prev,
    version: prev.version + 1,
    bet: { main: prev.bet.main, sides: { ...prev.bet.sides } },
    seats: prev.seats.map((s) => ({
      ...s, bet: { main: s.bet.main, sides: { ...s.bet.sides } },
      sideResults: { ...s.sideResults },
      lastBet: { main: s.lastBet.main, sides: { ...s.lastBet.sides } },
    })),
  };

  const isMulti = state.seats.length > 0 || action.type === 'join';
  const seatOf = (userId: string | undefined) =>
    userId ? state.seats.find((s) => s.userId === userId) : null;

  switch (action.type) {
    case 'join': {
      if (state.seats.some((s) => s.userId === action.userId)) return prev;
      state.seats.push({
        userId: action.userId, username: action.username, avatar: action.avatar, level: action.level,
        bet: { main: null, sides: {} }, net: 0, sideResults: {},
        lastBet: { main: null, sides: {} }, ready: false,
      });
      return state;
    }
    case 'leave': {
      state.seats = state.seats.filter((s) => s.userId !== action.userId);
      return state;
    }
    case 'setReady': {
      const seat = seatOf(action.userId);
      if (!seat || state.phase !== 'betting') return prev;
      seat.ready = action.ready;
      return state;
    }
    case 'setDeadline': {
      if (state.phase !== 'betting') return prev;
      state.deadline = action.deadline;
      return state;
    }
    case 'setMainBet': {
      if (state.phase !== 'betting') return prev;
      if (action.amount <= 0) return prev;
      if (isMulti && action.userId) {
        const seat = seatOf(action.userId);
        if (!seat) return prev;
        seat.bet.main = { side: action.side, amount: action.amount };
      } else {
        state.bet.main = { side: action.side, amount: action.amount };
      }
      return state;
    }
    case 'setSideBet': {
      if (state.phase !== 'betting') return prev;
      if (isMulti && action.userId) {
        const seat = seatOf(action.userId);
        if (!seat) return prev;
        if (action.amount <= 0) delete seat.bet.sides[action.side];
        else seat.bet.sides[action.side] = action.amount;
      } else {
        if (action.amount <= 0) delete state.bet.sides[action.side];
        else state.bet.sides[action.side] = action.amount;
      }
      return state;
    }
    case 'clearBet': {
      if (state.phase !== 'betting') return prev;
      if (isMulti && action.userId) {
        const seat = seatOf(action.userId);
        if (!seat) return prev;
        seat.bet = { main: null, sides: {} };
      } else {
        state.bet = { main: null, sides: {} };
      }
      return state;
    }
    case 'repeatLast': {
      if (state.phase !== 'betting') return prev;
      if (isMulti && action.userId) {
        const seat = seatOf(action.userId);
        if (!seat) return prev;
        if (!seat.lastBet.main && Object.keys(seat.lastBet.sides).length === 0) return prev;
        seat.bet = {
          main: seat.lastBet.main ? { ...seat.lastBet.main } : null,
          sides: { ...seat.lastBet.sides },
        };
      } else {
        if (!prev.lastBet.main && Object.keys(prev.lastBet.sides).length === 0) return prev;
        state.bet = { main: prev.lastBet.main ? { ...prev.lastBet.main } : null, sides: { ...prev.lastBet.sides } };
      }
      return state;
    }
    case 'deal': {
      if (state.phase !== 'betting') return prev;
      if (isMulti) {
        // At least one seat must have a bet.
        if (!state.seats.some((s) => s.bet.main || Object.keys(s.bet.sides).length > 0)) return prev;
      } else {
        if (!state.bet.main && Object.keys(state.bet.sides).length === 0) return prev;
      }
      state.phase = 'dealing';
      state.round += 1;
      state.deadline = null;
      // Fresh host randomness at deal time defeats the "read seed+cursor, predict
      // the hand, bet on it" exploit. No nonce (solo/tests) keeps the old shoe.
      if (action.nonce !== undefined) state.cursor = action.nonce;
      if (isMulti) {
        state.seats.forEach((seat) => {
          seat.lastBet = { main: seat.bet.main ? { ...seat.bet.main } : null, sides: { ...seat.bet.sides } };
        });
      } else {
        state.lastBet = { main: state.bet.main ? { ...state.bet.main } : null, sides: { ...state.bet.sides } };
      }
      playHand(state);
      if (isMulti) {
        // Compute per-seat net from the shared hand.
        state.seats.forEach((seat) => {
          const res = settleOne(seat.bet, state.outcome as BaccaratOutcome, state.player, state.banker);
          seat.net = res.net;
          seat.sideResults = res.sideResults;
        });
      }
      return state;
    }
    case 'newRound': {
      state.phase = 'betting';
      state.player = [];
      state.banker = [];
      state.outcome = null;
      state.net = 0;
      state.sideResults = {};
      state.deadline = null;
      if (isMulti) {
        state.seats.forEach((seat) => {
          seat.bet = { main: null, sides: {} };
          seat.net = 0;
          seat.sideResults = {};
          seat.ready = false;
        });
      } else {
        state.bet = { main: null, sides: {} };
      }
      return state;
    }
    default:
      return prev;
  }
}

/** Suggested chip values for the rail — same tiers as other games. */
export const BACCARAT_BETS = [25, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000] as const;

export function outcomeLabel(o: BaccaratOutcome): string {
  return o === 'player' ? 'P' : o === 'banker' ? 'B' : 'T';
}
