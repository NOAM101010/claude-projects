/**
 * High / Low Survival engine — pot math, guess resolution, elimination, split.
 * Run with `npm run test:highlow`.
 */
import { createState, reduce, rank, MAX_SEATS } from '@/games/highlow/engine';
import type { HlState } from '@/games/highlow/types';

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
const ids = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));

function seatUp(seed: number, n: number, ante = 500): HlState {
  let s = createState(seed);
  for (const id of ids(n)) s = reduce(s, { type: 'join', userId: id, username: id.toUpperCase(), avatar, level: 1 });
  s = reduce(s, { type: 'nightAnte', amount: ante });
  s = reduce(s, { type: 'start', ante });
  return s;
}

console.log('\nHigh / Low — seats + ante');
{
  let s = createState(1);
  for (let i = 0; i < MAX_SEATS; i++) s = reduce(s, { type: 'join', userId: `p${i}`, username: `P${i}`, avatar, level: 1 });
  check(`fills up to MAX_SEATS (${MAX_SEATS})`, s.seats.length === MAX_SEATS);
  check('a join past capacity is rejected', reduce(s, { type: 'join', userId: 'x', username: 'X', avatar, level: 1 }) === s);
}

console.log('\nHigh / Low — pot = ante × seated players');
{
  const s = seatUp(3, 5, 500);
  check('pot is ante × N', s.pot === 500 * 5, `pot=${s.pot}`);
  check('every seat staked the ante', s.seats.every((seat) => seat.stake === 500 && seat.alive));
  check('phase is guessing with a base card', s.phase === 'guessing' && !!s.base);
}

console.log('\nHigh / Low — ante locks once the round starts');
{
  const s = seatUp(3, 3, 500);
  check('nightAnte is a no-op mid-round', reduce(s, { type: 'nightAnte', amount: 1000 }) === s);
}

console.log('\nHigh / Low — correct call survives, wrong call is out');
{
  let s = seatUp(3, 2, 500);
  const before = s.base!;
  s = reduce(s, { type: 'guess', userId: 'a', guess: 'higher' });
  s = reduce(s, { type: 'guess', userId: 'b', guess: 'lower' });
  s = reduce(s, { type: 'reveal' });
  const delta = rank(s.revealed!) - rank(before);
  const a = s.seats.find((x) => x.userId === 'a')!;
  const b = s.seats.find((x) => x.userId === 'b')!;
  if (delta > 0) check('higher was right → A alive, B out', a.alive && !b.alive && b.net === -500);
  else if (delta < 0) check('lower was right → B alive, A out', b.alive && !a.alive && a.net === -500);
  else check('a tie carried both through', a.alive && b.alive);
}

console.log('\nHigh / Low — a tie pushes the whole field');
{
  let found = false;
  for (let seed = 1; seed < 400 && !found; seed++) {
    let s = seatUp(seed, 3, 500);
    const before = s.base!;
    for (const id of ids(3)) s = reduce(s, { type: 'guess', userId: id, guess: 'higher' });
    const drawn = reduce(s, { type: 'reveal' });
    if (rank(drawn.revealed!) === rank(before)) {
      found = true;
      check('every seat still alive after a push', drawn.seats.every((seat) => seat.alive));
      check('the pushed card becomes the new base', rank(drawn.base!) === rank(drawn.revealed!));
      check('round keeps going (still guessing)', drawn.phase === 'guessing' && drawn.turn === 1);
      check('guesses cleared for the next call', drawn.seats.every((seat) => seat.guess === null));
    }
  }
  check('found a tie within 400 seeds', found);
}

console.log('\nHigh / Low — last player standing takes the whole pot (zero-sum)');
{
  let found = false;
  for (let seed = 1; seed < 400 && !found; seed++) {
    let s = seatUp(seed, 2, 500);
    const before = s.base!;
    // Peek the outcome by revealing a clone, then have A call it right and B call it wrong.
    const peek = reduce(
      reduce(reduce(s, { type: 'guess', userId: 'a', guess: 'higher' }), { type: 'guess', userId: 'b', guess: 'higher' }),
      { type: 'reveal' },
    );
    const delta = rank(peek.revealed!) - rank(before);
    if (delta === 0) continue;
    found = true;
    const right = delta > 0 ? 'higher' : 'lower';
    const wrong = delta > 0 ? 'lower' : 'higher';
    s = reduce(s, { type: 'guess', userId: 'a', guess: right });
    s = reduce(s, { type: 'guess', userId: 'b', guess: wrong });
    s = reduce(s, { type: 'reveal' });
    check('phase settled', s.phase === 'settled');
    check('exactly one winner', s.winners.length === 1 && s.winners[0] === 'a');
    const a = s.seats.find((x) => x.userId === 'a')!;
    check('winner nets the rest of the pot', a.net === s.pot - a.stake, `net=${a.net}`);
    check('net across the table is zero-sum', s.seats.reduce((sum, seat) => sum + seat.net, 0) === 0);
  }
  check('found a non-tie first card within 400 seeds', found);
}

console.log('\nHigh / Low — a full wipe splits the pot across that turn\'s guessers');
{
  let found = false;
  for (let seed = 1; seed < 400 && !found; seed++) {
    let s = seatUp(seed, 2, 500);
    const before = s.base!;
    const peek = reduce(
      reduce(reduce(s, { type: 'guess', userId: 'a', guess: 'higher' }), { type: 'guess', userId: 'b', guess: 'higher' }),
      { type: 'reveal' },
    );
    const delta = rank(peek.revealed!) - rank(before);
    if (delta === 0) continue;
    found = true;
    const wrong = delta > 0 ? 'lower' : 'higher';
    s = reduce(s, { type: 'guess', userId: 'a', guess: wrong });
    s = reduce(s, { type: 'guess', userId: 'b', guess: wrong });
    s = reduce(s, { type: 'reveal' });
    check('phase settled with everyone wiped', s.phase === 'settled');
    check('both listed as winners (split)', s.winners.length === 2);
    check('pot split evenly (500 each back, net 0)', s.seats.every((seat) => seat.net === 0), s.seats.map((x) => x.net).join(','));
  }
  check('found a non-tie first card within 400 seeds', found);
}

console.log('\nHigh / Low — no call by the timer = elimination; wipe stays zero-sum');
{
  let found = false;
  for (let seed = 1; seed < 400 && !found; seed++) {
    let s = seatUp(seed, 4, 500);
    const before = s.base!;
    const peek = reduce(
      ['a', 'b', 'c'].reduce((acc, id) => reduce(acc, { type: 'guess', userId: id, guess: 'higher' }), s),
      { type: 'reveal' },
    );
    const delta = rank(peek.revealed!) - rank(before);
    if (delta === 0) continue;
    found = true;
    const wrong = delta > 0 ? 'lower' : 'higher';
    // a,b,c guess wrong; d never calls.
    for (const id of ['a', 'b', 'c']) s = reduce(s, { type: 'guess', userId: id, guess: wrong });
    s = reduce(s, { type: 'reveal' });
    const d = s.seats.find((x) => x.userId === 'd')!;
    check('the silent seat is eliminated for its stake', !d.alive && d.net === -500);
    check('phase settled (whole field gone)', s.phase === 'settled');
    const share = Math.floor(2000 / 3);
    const remainder = 2000 - 3 * share;
    check('guessers b,c each net floor(pot / 3) − stake', ['b', 'c'].every((id) => s.seats.find((x) => x.userId === id)!.net === share - 500));
    check('lowest-seated guesser (a) also takes the odd chips', s.seats.find((x) => x.userId === 'a')!.net === share - 500 + remainder);
    const total = s.seats.reduce((sum, seat) => sum + seat.net, 0);
    check('table nets exactly zero-sum', total === 0, `total=${total}`);
  }
  check('found a non-tie first card within 400 seeds', found);
}

console.log('\nHigh / Low — nobody guesses → round cancelled, every stake refunded');
{
  let s = seatUp(3, 3, 500);
  const potBefore = s.pot;
  check('pot was funded', potBefore === 1500);
  s = reduce(s, { type: 'reveal' }); // no one called
  check('phase settled', s.phase === 'settled');
  check('pot cleared', s.pot === 0);
  check('no winners recorded', s.winners.length === 0);
  check('every seat made whole (net 0)', s.seats.every((seat) => seat.net === 0));
  check('table nets zero-sum', s.seats.reduce((sum, seat) => sum + seat.net, 0) === 0);
}

console.log('\nHigh / Low — newRound reopens betting');
{
  let s = seatUp(7, 2, 500);
  for (const id of ids(2)) s = reduce(s, { type: 'guess', userId: id, guess: 'higher' });
  s = reduce(s, { type: 'reveal' });
  // settle or continue — force to settled by chaining reveals until it ends
  let guard = 0;
  while (s.phase === 'guessing' && guard < 20) {
    for (const seat of s.seats.filter((x) => x.alive)) s = reduce(s, { type: 'guess', userId: seat.userId, guess: 'higher' });
    s = reduce(s, { type: 'reveal' });
    guard++;
  }
  check('round eventually settles', s.phase === 'settled');
  const re = reduce(s, { type: 'newRound' });
  check('newRound → betting', re.phase === 'betting');
  check('stakes / cards cleared', re.seats.every((seat) => seat.stake === 0 && seat.guess === null && !seat.alive));
  check('ante mode persists', re.anteMode === true && re.anteAmount === 500);
}

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall high/low checks passed\n');
process.exit(failures ? 1 : 0);
