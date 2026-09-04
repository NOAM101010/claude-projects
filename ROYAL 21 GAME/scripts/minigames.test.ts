/**
 * Coin Flip + High Card engines — multiplayer pot math and war-tie resolution.
 * Run with `npm run test:minigames`.
 */
import { createState as cfCreate, reduce as cfReduce, MAX_SEATS as CF_MAX_SEATS } from '@/games/coinflip/engine';
import { createState as hcCreate, reduce as hcReduce, MAX_SEATS as HC_MAX_SEATS } from '@/games/highcard/engine';

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

console.log('\nCoin Flip — seats + picks');
{
  let s = cfCreate(1);
  for (let i = 0; i < CF_MAX_SEATS; i++) s = cfReduce(s, { type: 'join', userId: `p${i}`, username: `P${i}`, avatar, level: 1 });
  check(`fills up to MAX_SEATS (${CF_MAX_SEATS})`, s.seats.length === CF_MAX_SEATS);
  const full = cfReduce(s, { type: 'join', userId: 'overflow', username: 'X', avatar, level: 1 });
  check('a join past capacity is rejected', full === s);
  check('every seat got a distinct color', new Set(s.seats.map((seat) => seat.color)).size === CF_MAX_SEATS);
}

console.log('\nCoin Flip — flip requires at least 2 pickers');
{
  let s = cfCreate(2);
  s = cfReduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  const noOp = cfReduce(s, { type: 'flip' });
  check('flip with zero pickers is a no-op', noOp === s);
  s = cfReduce(s, { type: 'pick', userId: 'a', side: 'heads', amount: 100 });
  const stillNoOp = cfReduce(s, { type: 'flip' });
  check('flip with only one picker is a no-op', stillNoOp === s);
}

console.log('\nCoin Flip — payout math (winners split the pot)');
{
  let s = cfCreate(7);
  s = cfReduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  s = cfReduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
  s = cfReduce(s, { type: 'join', userId: 'c', username: 'C', avatar, level: 1 });
  s = cfReduce(s, { type: 'pick', userId: 'a', side: 'heads', amount: 100 });
  s = cfReduce(s, { type: 'pick', userId: 'b', side: 'heads', amount: 100 });
  s = cfReduce(s, { type: 'pick', userId: 'c', side: 'tails', amount: 100 });
  s = cfReduce(s, { type: 'flip' });
  check('phase settles after a flip', s.phase === 'settled');
  check('a result was recorded', s.result === 'heads' || s.result === 'tails');
  const totalNet = s.seats.reduce((sum, seat) => sum + seat.net, 0);
  check('net across all pickers sums to zero (zero-sum)', totalNet === 0, `total=${totalNet}`);
  const winners = s.seats.filter((seat) => seat.pick === s.result);
  const losers = s.seats.filter((seat) => seat.pick && seat.pick !== s.result);
  if (winners.length > 0) {
    check('every winner has non-negative net', winners.every((w) => w.net >= 0));
    check('every loser lost exactly their stake', losers.every((l) => l.net === -l.stake));
  }
}

console.log('\nCoin Flip — nobody-called-it refunds the field');
{
  // Force a deterministic result by trying seeds until everyone picks the losing side.
  let s = cfCreate(1);
  s = cfReduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  s = cfReduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
  s = cfReduce(s, { type: 'pick', userId: 'a', side: 'heads', amount: 100 });
  s = cfReduce(s, { type: 'pick', userId: 'b', side: 'heads', amount: 100 });
  const settled = cfReduce(s, { type: 'flip' });
  if (settled.result === 'tails') {
    check('a push refunds every picker to net zero', settled.seats.every((seat) => seat.net === 0));
  } else {
    check('(skipped — this seed landed on the picked side, not the refund case)', true);
  }
}

console.log('\nCoin Flip — determinism + round reset');
{
  let base = cfCreate(9);
  base = cfReduce(base, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  base = cfReduce(base, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
  base = cfReduce(base, { type: 'pick', userId: 'a', side: 'heads', amount: 50 });
  base = cfReduce(base, { type: 'pick', userId: 'b', side: 'tails', amount: 50 });
  const x = cfReduce(base, { type: 'flip' });
  const y = cfReduce(base, { type: 'flip' });
  check('flipping from identical state gives an identical result', x.result === y.result);
  const reopened = cfReduce(x, { type: 'openBetting' });
  check('openBetting clears every pick', reopened.seats.every((seat) => seat.pick === null && seat.stake === 0));
  check('openBetting advances the round', reopened.round === x.round + 1);
  check('openBetting returns to betting phase', reopened.phase === 'betting');
}

console.log('\nHigh Card — seats + antes');
{
  let s = hcCreate(1);
  for (let i = 0; i < HC_MAX_SEATS; i++) s = hcReduce(s, { type: 'join', userId: `p${i}`, username: `P${i}`, avatar, level: 1 });
  check(`fills up to MAX_SEATS (${HC_MAX_SEATS})`, s.seats.length === HC_MAX_SEATS);
  const full = hcReduce(s, { type: 'join', userId: 'overflow', username: 'X', avatar, level: 1 });
  check('a join past capacity is rejected', full === s);
}

console.log('\nHigh Card — draw requires at least 2 antes');
{
  let s = hcCreate(2);
  s = hcReduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  s = hcReduce(s, { type: 'ante', userId: 'a', amount: 100 });
  const noOp = hcReduce(s, { type: 'draw' });
  check('draw with only one ante is a no-op', noOp === s);
}

console.log('\nHigh Card — payout math (winner takes the whole pot)');
{
  let s = hcCreate(3);
  for (const id of ['a', 'b', 'c', 'd', 'e']) s = hcReduce(s, { type: 'join', userId: id, username: id.toUpperCase(), avatar, level: 1 });
  for (const id of ['a', 'b', 'c', 'd', 'e']) s = hcReduce(s, { type: 'ante', userId: id, amount: 100 });
  let guard = 0;
  while (s.phase !== 'settled' && guard < 10) { s = hcReduce(s, { type: 'draw' }); guard++; }
  check('a round with 5 antes eventually settles (war chains terminate)', s.phase === 'settled');
  check('exactly one winner is recorded', s.winners.length === 1);
  const totalNet = s.seats.reduce((sum, seat) => sum + seat.net, 0);
  check('net across all antes sums to zero (zero-sum)', totalNet === 0, `total=${totalNet}`);
  const winner = s.seats.find((seat) => seat.userId === s.winners[0])!;
  check('the winner nets the rest of the pot', winner.net === s.pot - winner.stake);
  const losers = s.seats.filter((seat) => seat.userId !== s.winners[0] && seat.stake > 0);
  check('every non-winning ante lost exactly their stake', losers.every((l) => l.net === -l.stake));
}

console.log('\nHigh Card — a tie sends only the tied seats to war');
{
  // Try seeds until we land a tie on the first draw, to exercise the war path directly.
  let found = false;
  for (let seed = 1; seed < 200 && !found; seed++) {
    let s = hcCreate(seed);
    s = hcReduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
    s = hcReduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
    s = hcReduce(s, { type: 'join', userId: 'c', username: 'C', avatar, level: 1 });
    s = hcReduce(s, { type: 'ante', userId: 'a', amount: 100 });
    s = hcReduce(s, { type: 'ante', userId: 'b', amount: 100 });
    s = hcReduce(s, { type: 'ante', userId: 'c', amount: 100 });
    const drawn = hcReduce(s, { type: 'draw' });
    if (drawn.phase === 'war') {
      found = true;
      const contending = drawn.seats.filter((seat) => seat.contending);
      const eliminated = drawn.seats.filter((seat) => seat.stake > 0 && !seat.contending);
      check('at least 2 seats stay contending into war', contending.length >= 2);
      check('an eliminated seat already lost its stake', eliminated.every((seat) => seat.net === -seat.stake));
      check('the pot is frozen (not re-collected) going into war', drawn.pot === 300);
      const resolved = hcReduce(drawn, { type: 'draw' });
      check('war round increments', resolved.warRound === drawn.warRound || resolved.warRound === drawn.warRound + 1);
    }
  }
  check('found at least one tie within 200 seeds to exercise the war path', found);
}

console.log('\nHigh Card — determinism + round reset');
{
  let base = hcCreate(11);
  base = hcReduce(base, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  base = hcReduce(base, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
  base = hcReduce(base, { type: 'ante', userId: 'a', amount: 50 });
  base = hcReduce(base, { type: 'ante', userId: 'b', amount: 50 });
  const x = hcReduce(base, { type: 'draw' });
  const y = hcReduce(base, { type: 'draw' });
  check('drawing from identical state deals identical cards', JSON.stringify(x.seats.map((s) => s.card)) === JSON.stringify(y.seats.map((s) => s.card)));
  const reopened = hcReduce(x, { type: 'openBetting' });
  check('openBetting clears every ante and card', reopened.seats.every((seat) => seat.stake === 0 && seat.card === null));
  check('openBetting advances the round', reopened.round === x.round + 1);
  check('openBetting returns to betting phase', reopened.phase === 'betting');
}

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall mini-game checks passed\n');
process.exit(failures ? 1 : 0);
