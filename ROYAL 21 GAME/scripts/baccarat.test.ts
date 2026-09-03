/* Payout regression tests for the Baccarat engine. Run: npm run test:baccarat
 *
 * Guards the bug a player hit: a winning Banker bet paying far less than the
 * 1:0.95 it should. Covers solo settle, the tunable commission, and the
 * multiplayer per-seat settle path in the reducer. */
import {
  createState, reduce, settleOne, DEFAULT_BANKER_PAYOUT, baccaratPaytable,
} from '../src/games/baccarat/engine';
import type { BaccaratBet, Card } from '../src/games/baccarat/types';
import type { AvatarConfig } from '../src/types';

let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean) => {
  if (cond) { pass++; console.log('  ✓', label); }
  else { fail++; console.error('  ✗', label); }
};

const noCards: Card[] = [];
const mainBet = (side: 'player' | 'banker', amount: number): BaccaratBet => ({ main: { side, amount }, sides: {} });

console.log('\nSolo settle — main bet');
ok('banker 100 wins → net +95 (5% commission)',
  settleOne(mainBet('banker', 100), 'banker', noCards, noCards).net === 95);
ok('player 100 wins → net +100',
  settleOne(mainBet('player', 100), 'player', noCards, noCards).net === 100);
ok('banker 100 loses → net -100',
  settleOne(mainBet('banker', 100), 'player', noCards, noCards).net === -100);
ok('player 100 loses → net -100',
  settleOne(mainBet('player', 100), 'banker', noCards, noCards).net === -100);
ok('tie pushes banker bet → net 0',
  settleOne(mainBet('banker', 100), 'tie', noCards, noCards).net === 0);
ok('tie pushes player bet → net 0',
  settleOne(mainBet('player', 100), 'tie', noCards, noCards).net === 0);
ok('default banker payout is 0.95', DEFAULT_BANKER_PAYOUT === 0.95);

console.log('\nTunable commission');
ok('banker 100 wins at 1.0 (no commission) → net +100',
  settleOne(mainBet('banker', 100), 'banker', noCards, noCards, 1).net === 100);
ok('banker 200 wins at 0.9 → net +180',
  settleOne(mainBet('banker', 200), 'banker', noCards, noCards, 0.9).net === 180);
ok('paytable reflects the live commission',
  baccaratPaytable(1).find((r) => r.key === 'banker')?.payout === '1 : 1');
ok('paytable default shows 5% commission',
  (baccaratPaytable().find((r) => r.key === 'banker')?.payout ?? '').includes('5% commission'));

console.log('\nMultiplayer — per-seat settle via reducer');
const avatar: AvatarConfig = { skin: 0, hair: 0, shirt: 'base' };
function room(bankerPayout?: number) {
  let s = createState(1);
  s = reduce(s, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
  s = reduce(s, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
  s = reduce(s, { type: 'setMainBet', userId: 'a', side: 'banker', amount: 100 });
  s = reduce(s, { type: 'setMainBet', userId: 'b', side: 'player', amount: 100 });
  s = reduce(s, { type: 'deal', bankerPayout });
  return s;
}
{
  const s = room();
  const seatA = s.seats.find((x) => x.userId === 'a')!;
  const seatB = s.seats.find((x) => x.userId === 'b')!;
  ok('deal bakes bankerPayout into shared state', s.bankerPayout === 0.95);
  // Exactly one of P/B wins (or a tie pushes both). Whatever the shoe dealt,
  // each seat's net must match settleOne against the shared outcome.
  const expectA = settleOne(seatA.bet, s.outcome!, s.player, s.banker, s.bankerPayout).net;
  const expectB = settleOne(seatB.bet, s.outcome!, s.player, s.banker, s.bankerPayout).net;
  ok('seat A net matches settleOne', seatA.net === expectA);
  ok('seat B net matches settleOne', seatB.net === expectB);
  if (s.outcome === 'banker') ok('banker winner seat A net = +95', seatA.net === 95);
  if (s.outcome === 'player') ok('player winner seat B net = +100', seatB.net === 100);
  if (s.outcome === 'tie') ok('tie pushes both seats', seatA.net === 0 && seatB.net === 0);
}
{
  const s = room(1);
  ok('host can push a no-commission table', s.bankerPayout === 1);
  const seatA = s.seats.find((x) => x.userId === 'a')!;
  if (s.outcome === 'banker') ok('banker winner at 1.0 → net +100', seatA.net === 100);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
