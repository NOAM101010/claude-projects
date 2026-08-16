/**
 * Roulette engine — odds, payout math, and bet-shape validation.
 * Run with `npm run test:roulette`.
 *
 * The last group here (bet-shape validation) exists specifically because a
 * pre-launch review found the engine originally priced a bet by `kind` alone
 * (e.g. "straight" = 35:1) without checking how many numbers it actually
 * covered — a crafted `numbers` array could cover all 36 at that price. These
 * tests pin the fix down so it can't silently regress.
 */
import {
  BET_PAYOUTS, MAX_SEATS, WHEEL_ORDER, PLAYER_COLORS,
  isRed, isBlack, createState, makeSeat, reduce,
  columnNumbers, dozenNumbers,
} from '@/games/roulette/engine';
import type { RouletteBetKind, RouletteState } from '@/games/roulette/types';

let failures = 0;
const check = (name: string, condition: boolean, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const avatar = { skin: 0, hair: 0, shirt: 'base' as const };

console.log('\nWheel + odds');
check('European wheel has 37 pockets (single zero)', WHEEL_ORDER.length === 37);
check('every pocket 0-36 appears exactly once', new Set(WHEEL_ORDER).size === 37);
check('straight pays 35:1', BET_PAYOUTS.straight === 35);
check('split pays 17:1', BET_PAYOUTS.split === 17);
check('street pays 11:1', BET_PAYOUTS.street === 11);
check('corner pays 8:1', BET_PAYOUTS.corner === 8);
check('line pays 5:1', BET_PAYOUTS.line === 5);
check('column pays 2:1', BET_PAYOUTS.column === 2);
check('dozen pays 2:1', BET_PAYOUTS.dozen === 2);
check('even-money bets all pay 1:1', ['red', 'black', 'even', 'odd', 'low', 'high'].every((k) => BET_PAYOUTS[k as RouletteBetKind] === 1));
check('0 is neither red nor black', !isRed(0) && !isBlack(0));
check('every non-zero number is red xor black', WHEEL_ORDER.filter((n) => n !== 0).every((n) => isRed(n) !== isBlack(n)));

console.log('\nSeats + colors');
{
  let state = createState(1);
  for (let i = 0; i < MAX_SEATS; i += 1) {
    state = reduce(state, { type: 'join', userId: `p${i}`, username: `P${i}`, avatar, level: 1 });
  }
  check(`fills up to MAX_SEATS (${MAX_SEATS})`, state.seats.length === MAX_SEATS);
  const rejected = reduce(state, { type: 'join', userId: 'overflow', username: 'X', avatar, level: 1 });
  check('a 6th join is rejected once full', rejected.seats.length === MAX_SEATS);
  check('every seat got a distinct color', new Set(state.seats.map((s) => s.color)).size === MAX_SEATS);
  check('colors come from PLAYER_COLORS', state.seats.every((s) => PLAYER_COLORS.some((c) => c.hex === s.color)));
}

console.log('\nBet-shape validation (placeBet)');
const seated = (): RouletteState => reduce(createState(1), { type: 'join', userId: 'p0', username: 'P0', avatar, level: 1 });

const place = (kind: RouletteBetKind, numbers: number[], amount = 100) =>
  reduce(seated(), { type: 'placeBet', userId: 'p0', kind, numbers, amount });

check('straight with 1 number is accepted', place('straight', [17]).seats[0].bets.length === 1);
check('straight with 36 numbers is rejected (the exploit)', place('straight', Array.from({ length: 36 }, (_, i) => i + 1)).seats[0].bets.length === 0);
check('straight with 2 numbers is rejected', place('straight', [1, 2]).seats[0].bets.length === 0);
check('split needs exactly 2 numbers', place('split', [1, 2]).seats[0].bets.length === 1 && place('split', [1, 2, 3]).seats[0].bets.length === 0);
check('street needs exactly 3 numbers', place('street', [1, 2, 3]).seats[0].bets.length === 1 && place('street', [1, 2]).seats[0].bets.length === 0);
check('corner needs exactly 4 numbers', place('corner', [1, 2, 4, 5]).seats[0].bets.length === 1 && place('corner', [1, 2, 4]).seats[0].bets.length === 0);
check('line needs exactly 6 numbers', place('line', [1, 2, 3, 4, 5, 6]).seats[0].bets.length === 1 && place('line', [1, 2, 3, 4, 5]).seats[0].bets.length === 0);
check('column needs exactly 12 numbers', place('column', columnNumbers(0)).seats[0].bets.length === 1 && place('column', columnNumbers(0).slice(0, 11)).seats[0].bets.length === 0);
check('dozen needs exactly 12 numbers', place('dozen', dozenNumbers(1)).seats[0].bets.length === 1 && place('dozen', dozenNumbers(1).slice(0, 11)).seats[0].bets.length === 0);
check('red/black/even/odd/low/high take no numbers', place('red', []).seats[0].bets.length === 1);
check('red with numbers attached is rejected', place('red', [1]).seats[0].bets.length === 0);
check('duplicate numbers within a bet are rejected', place('corner', [1, 1, 2, 3]).seats[0].bets.length === 0);
check('an out-of-range number (37) is rejected', place('straight', [37]).seats[0].bets.length === 0);
check('a negative number is rejected', place('straight', [-1]).seats[0].bets.length === 0);
check('a non-integer number is rejected', place('straight', [1.5]).seats[0].bets.length === 0);

console.log('\nPayout math (settle via spin)');
{
  // Bet every number straight-up at once — whatever hits, the payout must match
  // the 35:1 price for exactly the number of chips staked on that one pocket.
  let state = seated();
  for (let n = 0; n <= 36; n += 1) {
    state = reduce(state, { type: 'placeBet', userId: 'p0', kind: 'straight', numbers: [n], amount: 10 });
  }
  check('all 37 straight-up bets were accepted', state.seats[0].bets.length === 37);
  const settled = reduce(state, { type: 'spin' });
  const stake = 37 * 10;
  const expectedPayout = 10 * (BET_PAYOUTS.straight + 1); // the one winning pocket
  check('winning number is in range 0-36', settled.winningNumber !== null && settled.winningNumber! >= 0 && settled.winningNumber! <= 36);
  check('net equals the single winning payout minus total stake', settled.seats[0].net === expectedPayout - stake, `net=${settled.seats[0].net}`);
  check('the winning number was recorded in history', settled.history[0] === settled.winningNumber);
}
{
  // A losing outside bet: net must be exactly -stake, never a partial refund.
  let state = seated();
  state = reduce(state, { type: 'placeBet', userId: 'p0', kind: 'red', numbers: [], amount: 100 });
  const settled = reduce(state, { type: 'spin' });
  const n = settled.winningNumber as number;
  const won = isRed(n);
  const expectedNet = won ? 100 * BET_PAYOUTS.red : -100;
  check('red bet nets exactly stake*payout when it wins, or -stake when it loses', settled.seats[0].net === expectedNet, `n=${n} net=${settled.seats[0].net}`);
}

console.log('\nDeterminism');
{
  // Same seed and same sequence of actions must always produce the same spin —
  // this is what lets every client verify the host's result independently.
  const base = seated();
  const a = reduce(base, { type: 'spin' });
  const b = reduce(base, { type: 'spin' });
  check('spinning from identical state gives an identical winning number', a.winningNumber === b.winningNumber);
  check('spinning from identical state gives an identical cursor', a.cursor === b.cursor);
}

console.log('\nRound lifecycle');
{
  let state = seated();
  state = reduce(state, { type: 'placeBet', userId: 'p0', kind: 'red', numbers: [], amount: 50 });
  state = reduce(state, { type: 'spin' });
  check('phase is settled after spin', state.phase === 'settled');
  const reopened = reduce(state, { type: 'openBetting' });
  check('openBetting clears bets', reopened.seats[0].bets.length === 0);
  check('openBetting resets net', reopened.seats[0].net === 0);
  check('openBetting advances the round', reopened.round === state.round + 1);
  check('openBetting returns to betting phase', reopened.phase === 'betting');
}

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall roulette checks passed\n');
process.exit(failures ? 1 : 0);
