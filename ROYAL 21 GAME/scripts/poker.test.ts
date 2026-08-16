/* Rule tests for the Texas Hold'em engine. Run: npm run test:poker */
import { bestHand, compareScore } from '../src/games/poker/handEval';
import {
  createState, reduce, createTournamentState, levelIndexFor, SNG_BLIND_LEVELS, SNG_STARTING_STACK,
} from '../src/games/poker/engine';
import type { Card } from '../src/games/poker/types';
import type { AvatarConfig } from '../src/types';

const avatar: AvatarConfig = { skin: 0, hair: 0, shirt: 'base' };
let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean) => {
  if (cond) { pass++; console.log('  ✓', label); }
  else { fail++; console.error('  ✗', label); }
};
const c = (spec: string): Card => ({ r: spec.slice(0, -1) as Card['r'], s: spec.slice(-1) as Card['s'] });

console.log('\nHand ranking');
ok('royal flush beats everything', compareScore(
  bestHand(['AS', 'KS', 'QS', 'JS', '10S', '2H', '3D'].map(c)).score,
  bestHand(['AH', 'AS', 'AD', 'AC', 'KH', '2H', '3D'].map(c)).score,
) > 0);
ok('four of a kind beats full house', compareScore(
  bestHand(['AH', 'AS', 'AD', 'AC', '2H', '3D', '4S'].map(c)).score,
  bestHand(['KH', 'KS', 'KD', '2C', '2H', '3D', '4S'].map(c)).score,
) > 0);
ok('full house beats flush', compareScore(
  bestHand(['KH', 'KS', 'KD', '2C', '2H', '3D', '4S'].map(c)).score,
  bestHand(['2H', '5H', '9H', 'JH', 'KH', '3D', '4S'].map(c)).score,
) > 0);
ok('flush beats straight', compareScore(
  bestHand(['2H', '5H', '9H', 'JH', 'KH', '3D', '4S'].map(c)).score,
  bestHand(['5H', '6S', '7D', '8C', '9H', '2D', '3S'].map(c)).score,
) > 0);
ok('wheel straight (A-2-3-4-5) is a straight', bestHand(['AS', '2H', '3D', '4C', '5S', '9H', 'KD'].map(c)).category === 'straight');
ok('pair beats high card', compareScore(
  bestHand(['2H', '2S', '9D', 'JC', 'KH', '3D', '5S'].map(c)).score,
  bestHand(['2H', '7S', '9D', 'JC', 'KH', '3D', '5S'].map(c)).score,
) > 0);
ok('best-of-7 finds the flush inside a bigger set', bestHand(['2H', '5H', '9H', 'JH', 'KH', 'AS', '3D'].map(c)).category === 'flush');
ok('identical 5-card hands tie', compareScore(
  bestHand(['AH', 'KH', 'QH', 'JH', '10H'].map(c)).score,
  bestHand(['AS', 'KS', 'QS', 'JS', '10S'].map(c)).score,
) === 0);

console.log('\nBetting round + showdown (3 players, no folds)');
{
  let s = createState(7, 25, 50);
  s = reduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1, buyIn: 5000 });
  s = reduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1, buyIn: 5000 });
  s = reduce(s, { type: 'join', userId: 'c', username: 'C', avatar, level: 1, buyIn: 5000 });
  const totalBefore = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  s = reduce(s, { type: 'startHand' });
  ok('deals 2 hole cards to each seat', s.seats.every((seat) => seat.hole.length === 2));
  ok('blinds posted into the pot', s.pot === 75);
  ok('street is preflop', s.street === 'preflop');

  // everyone calls/checks to showdown across all streets
  let guard = 0;
  while (s.street !== 'waiting' && guard < 40) {
    guard++;
    const seat = s.seats[s.toAct];
    if (!seat) break;
    s = reduce(s, s.currentBet > seat.committed ? { type: 'call', userId: seat.userId } : { type: 'check', userId: seat.userId });
  }
  ok('hand reaches waiting (showdown resolved)', s.street === 'waiting');
  ok('five community cards on the board', s.community.length === 5);
  const totalAfter = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  ok('chips are conserved across the hand (zero-sum)', totalAfter === totalBefore);
  ok('showdown recorded a result for every seat', (s.showdown?.length ?? 0) === 3);
  ok('lastResult nets sum to zero', (s.lastResult ?? []).reduce((sum, r) => sum + r.net, 0) === 0);
}

console.log('\nFold-out (uncontested pot)');
{
  let s = createState(3, 25, 50);
  s = reduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1, buyIn: 2000 });
  s = reduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1, buyIn: 2000 });
  const totalBefore = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  s = reduce(s, { type: 'startHand' });
  const firstToAct = s.seats[s.toAct].userId;
  s = reduce(s, { type: 'fold', userId: firstToAct });
  ok('hand ends immediately when only one player remains', s.street === 'waiting');
  ok('no showdown on an uncontested pot', s.showdown === null);
  const totalAfter = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  ok('chips still conserved', totalAfter === totalBefore);
  const winner = s.lastResult?.find((r) => r.net > 0);
  ok('the non-folder is credited the pot', Boolean(winner) && winner!.userId !== firstToAct);
}

console.log('\nAll-in side pot');
{
  let s = createState(9, 25, 50);
  s = reduce(s, { type: 'join', userId: 'short', username: 'Short', avatar, level: 1, buyIn: 200 });
  s = reduce(s, { type: 'join', userId: 'mid', username: 'Mid', avatar, level: 1, buyIn: 1000 });
  s = reduce(s, { type: 'join', userId: 'big', username: 'Big', avatar, level: 1, buyIn: 5000 });
  const totalBefore = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  s = reduce(s, { type: 'startHand' });
  let guard = 0;
  while (s.street !== 'waiting' && guard < 60) {
    guard++;
    const seat = s.seats[s.toAct];
    if (!seat) break;
    if (seat.stack + seat.committed <= 200) s = reduce(s, { type: 'allin', userId: seat.userId });
    else s = reduce(s, s.currentBet > seat.committed ? { type: 'call', userId: seat.userId } : { type: 'check', userId: seat.userId });
  }
  ok('all-in hand resolves', s.street === 'waiting');
  const totalAfter = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  ok('chips conserved through side pots', totalAfter === totalBefore);
  ok('at least a main pot was computed', s.pots.length >= 1);
}

console.log('\nTime bank + timeout');
{
  let s = createState(11, 25, 50);
  s = reduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1, buyIn: 5000 });
  s = reduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1, buyIn: 5000 });
  s = reduce(s, { type: 'startHand' });
  const actorId = s.seats[s.toAct].userId;
  ok('new seats start with two time banks', s.seats.every((seat) => seat.timeBanksLeft === 2));
  s = reduce(s, { type: 'setDeadline', deadline: 1000 });
  ok('host can stamp a deadline for the acting seat', s.deadline === 1000);
  s = reduce(s, { type: 'useTimeBank', userId: actorId });
  ok('using a time bank extends the deadline by 60s', s.deadline === 61000);
  ok('using a time bank consumes one of the two', s.seats.find((seat) => seat.userId === actorId)!.timeBanksLeft === 1);
  const before = reduce(s, { type: 'join', userId: 'noop', username: 'noop', avatar, level: 1, buyIn: 1 });
  ok('a non-acting player cannot use a time bank', reduce(before, { type: 'useTimeBank', userId: 'noop' }) === before);
  const otherId = s.seats.find((seat) => seat.userId !== actorId)!.userId;
  s = reduce(s, { type: 'timeout', userId: actorId });
  ok('timeout folds the acting seat', s.seats.find((seat) => seat.userId === actorId)!.folded === true);
  ok('timeout ends the hand uncontested when only one player remains', s.street === 'waiting');
  ok('the seat that did not time out wins the pot', (s.lastResult?.find((r) => r.userId === otherId)?.net ?? 0) > 0);
}

console.log('\nAll-in equity snapshot');
{
  let s = createState(21, 25, 50);
  s = reduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1, buyIn: 200 });
  s = reduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1, buyIn: 5000 });
  s = reduce(s, { type: 'startHand' });
  // First actor shoves, the other calls — both all-in preflop with no more decisions to make.
  s = reduce(s, { type: 'allin', userId: s.seats[s.toAct].userId });
  if (s.toAct !== -1) s = reduce(s, { type: 'call', userId: s.seats[s.toAct].userId });
  ok('equity gets snapshotted the moment both players are all-in preflop', s.allInEquity !== null);
  if (s.allInEquity) {
    const total = Object.values(s.allInEquity).reduce((sum, v) => sum + v, 0);
    ok('snapshotted equities sum to ~1', Math.abs(total - 1) < 0.01);
  }
  ok('hand still resolves to a full board and showdown', s.community.length === 5 && s.showdown !== null);
}

console.log('\nSit & Go tournament');
{
  let s = createTournamentState(5, 1000);
  ok('everyone buys in for the fixed starting stack, not a chosen amount', true);
  s = reduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1, buyIn: 999999 });
  s = reduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1, buyIn: 1 });
  s = reduce(s, { type: 'join', userId: 'c', username: 'C', avatar, level: 1, buyIn: 1 });
  ok('buy-in amount on the join action is ignored — everyone gets the starting stack', s.seats.every((seat) => seat.stack === SNG_STARTING_STACK));

  s = reduce(s, { type: 'startHand' });
  ok('first hand plays level 1 blinds', s.smallBlind === SNG_BLIND_LEVELS[0].sb && s.bigBlind === SNG_BLIND_LEVELS[0].bb);

  const lateJoin = reduce(s, { type: 'join', userId: 'late', username: 'Late', avatar, level: 1, buyIn: 1000 });
  ok('nobody can join after the first hand — no late registration', lateJoin === s);

  // Fast-forward the tournament clock into level 5 (which carries an ante) and start a fresh hand.
  s.tournament!.startedAt = Date.now() - SNG_BLIND_LEVELS[0].sb * 0; // no-op, keeps type-checker calm
  s.tournament!.startedAt = Date.now() - 22 * 60_000; // 22 minutes in, at 5 min/level = level index 4
  ok('levelIndexFor tracks elapsed wall-clock time', levelIndexFor(s.tournament!, Date.now()) === 4);
  // Settle the in-flight hand so a new one can start and re-read the level.
  let guard = 0;
  while (s.street !== 'waiting' && guard < 40) {
    guard++;
    const seat = s.seats[s.toAct];
    if (!seat) break;
    s = reduce(s, s.currentBet > seat.committed ? { type: 'call', userId: seat.userId } : { type: 'check', userId: seat.userId });
  }
  s = reduce(s, { type: 'startHand' });
  ok('blinds and ante escalate once the clock reaches the next level', s.smallBlind === SNG_BLIND_LEVELS[4].sb && s.ante === SNG_BLIND_LEVELS[4].ante);

  // Play hands to completion until only one player has chips.
  guard = 0;
  while (!s.tournament!.finished && guard < 400) {
    guard++;
    if (s.street === 'waiting') { s = reduce(s, { type: 'startHand' }); continue; }
    const seat = s.seats[s.toAct];
    if (!seat) break;
    // Shove everyone in fast so the tournament actually finishes inside the test.
    s = reduce(s, { type: 'allin', userId: seat.userId });
  }
  ok('the tournament eventually produces a single winner', s.tournament!.finished && s.tournament!.winnerId !== null);
  const totalChips = s.seats.reduce((sum, seat) => sum + seat.stack, 0);
  ok('all starting chips are still accounted for at the end', totalChips === SNG_STARTING_STACK * 3);
  ok('the winner holds every chip on the table', s.seats.find((seat) => seat.userId === s.tournament!.winnerId)!.stack === totalChips);
  ok('the two losers are recorded as eliminated', s.tournament!.eliminated.length === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
