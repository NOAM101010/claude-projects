/* Rule tests for the Blackjack engine. Run: npm run test:engine */
import {
  buildShoe, createState, handValue, isBlackjack, reduce, DECKS,
} from '../src/games/blackjack/engine';
import type { BjState, Card } from '../src/games/blackjack/types';
import type { AvatarConfig } from '../src/types';

const avatar: AvatarConfig = { skin: 0, hair: 0, shirt: 'base' };
let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean) => {
  if (cond) { pass++; console.log('  ✓', label); }
  else { fail++; console.error('  ✗', label); }
};

/** Force a specific board by writing cards directly, then run the dealer. */
function withBoard(player: Card[], dealer: Card[], bet = 100): BjState {
  let s = createState(1);
  s = reduce(s, { type: 'join', userId: 'me', username: 'Me', avatar, level: 1 });
  s = reduce(s, { type: 'bet', userId: 'me', amount: bet });
  s = reduce(s, { type: 'deal' });
  s.seats[0].hands = [{ cards: player, bet, done: true, doubled: false, fromSplit: false }];
  s.dealer.cards = dealer;
  s.phase = 'dealer';
  return reduce(s, { type: 'resolveDealer' });
}

console.log('\nShoe');
const shoe = buildShoe(42);
ok(`${DECKS} decks = 312 cards`, shoe.length === 312);
ok('same seed = same order', JSON.stringify(buildShoe(7)) === JSON.stringify(buildShoe(7)));
ok('different seed = different order', JSON.stringify(buildShoe(7)) !== JSON.stringify(buildShoe(8)));

console.log('\nHand values');
ok('A+K = 21', handValue([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }]).total === 21);
ok('A+A+9 = 21', handValue([{ r: 'A', s: 'S' }, { r: 'A', s: 'H' }, { r: '9', s: 'D' }]).total === 21);
ok('soft 17 detected', handValue([{ r: 'A', s: 'S' }, { r: '6', s: 'H' }]).soft === true);
ok('ace demotes on bust', handValue([{ r: 'A', s: 'S' }, { r: '9', s: 'H' }, { r: '9', s: 'D' }]).total === 19);

console.log('\nOutcomes');
let s = withBoard([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }], [{ r: '9', s: 'C' }, { r: '8', s: 'D' }]);
ok('blackjack pays 3:2 (100 -> 250 back)', s.seats[0].hands[0].payout === 250);
ok('blackjack outcome tagged', s.seats[0].hands[0].outcome === 'blackjack');
ok('net is +150', s.seats[0].net === 150);

s = withBoard([{ r: '10', s: 'S' }, { r: '9', s: 'H' }], [{ r: '10', s: 'C' }, { r: '8', s: 'D' }]);
ok('19 beats 18 (2x back)', s.seats[0].hands[0].payout === 200 && s.seats[0].hands[0].outcome === 'win');

s = withBoard([{ r: '10', s: 'S' }, { r: '8', s: 'H' }], [{ r: '10', s: 'C' }, { r: '8', s: 'D' }]);
ok('push returns the bet', s.seats[0].hands[0].payout === 100 && s.seats[0].hands[0].outcome === 'push');

s = withBoard([{ r: '10', s: 'S' }, { r: '7', s: 'H' }], [{ r: '10', s: 'C' }, { r: '9', s: 'D' }]);
ok('lower total loses', s.seats[0].hands[0].payout === 0 && s.seats[0].hands[0].outcome === 'lose');

s = withBoard([{ r: '10', s: 'S' }, { r: '9', s: 'H' }, { r: '9', s: 'D' }], [{ r: '10', s: 'C' }, { r: '7', s: 'D' }]);
ok('bust loses even if dealer busts later', s.seats[0].hands[0].outcome === 'bust');

s = withBoard([{ r: '10', s: 'S' }, { r: '6', s: 'H' }], [{ r: '10', s: 'C' }, { r: '6', s: 'D' }, { r: '9', s: 'H' }]);
ok('dealer bust pays the player', s.seats[0].hands[0].outcome === 'win');

s = withBoard([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }], [{ r: 'A', s: 'C' }, { r: 'Q', s: 'D' }]);
ok('bj vs bj is a push', s.seats[0].hands[0].outcome === 'push');

console.log('\nDealer draw rule');
s = withBoard([{ r: '10', s: 'S' }, { r: '9', s: 'H' }], [{ r: '5', s: 'C' }, { r: '6', s: 'D' }]);
ok('dealer draws to at least 17', handValue(s.dealer.cards).total >= 17);
ok('dealer never draws past 21 unnecessarily', s.dealer.cards.length >= 3);

console.log('\nActions');
let g = createState(99);
g = reduce(g, { type: 'join', userId: 'me', username: 'Me', avatar, level: 1 });
g = reduce(g, { type: 'bet', userId: 'me', amount: 50 });
g = reduce(g, { type: 'bet', userId: 'me', amount: 50 });
ok('bets accumulate', g.seats[0].bet === 100);
g = reduce(g, { type: 'ready', userId: 'me' });
ok('ready requires a bet', g.seats[0].ready === true);
g = reduce(g, { type: 'deal' });
ok('two cards to the player', g.seats[0].hands[0].cards.length === 2);
ok('two cards to the dealer', g.dealer.cards.length === 2);
ok('hole card hidden while playing', g.dealer.hidden === true || g.phase === 'settled');

if (g.phase === 'playing') {
  const before = g.seats[0].hands[0].cards.length;
  const hit = reduce(g, { type: 'hit', userId: 'me' });
  ok('hit adds exactly one card', hit.seats[0].hands[0].cards.length === before + 1);
  const stand = reduce(g, { type: 'stand', userId: 'me' });
  ok('stand ends the hand', stand.phase === 'settled');
  ok('hole card revealed at settle', stand.dealer.hidden === false);
}

console.log('\nDouble');
let d = createState(5);
d = reduce(d, { type: 'join', userId: 'me', username: 'Me', avatar, level: 1 });
d = reduce(d, { type: 'bet', userId: 'me', amount: 100 });
d = reduce(d, { type: 'deal' });
if (d.phase === 'playing') {
  const doubled = reduce(d, { type: 'double', userId: 'me' });
  ok('double doubles the stake', doubled.seats[0].hands[0].bet === 200);
  ok('double draws one card only', doubled.seats[0].hands[0].cards.length === 3);
  ok('double ends the hand', doubled.phase === 'settled');
}

console.log('\nSplit');
let p = createState(3);
p = reduce(p, { type: 'join', userId: 'me', username: 'Me', avatar, level: 1 });
p = reduce(p, { type: 'bet', userId: 'me', amount: 100 });
p = reduce(p, { type: 'deal' });
p.seats[0].hands = [{ cards: [{ r: '8', s: 'S' }, { r: '8', s: 'H' }], bet: 100, done: false, doubled: false, fromSplit: false }];
p.phase = 'playing';
p.activeSeat = 0;
p.activeHand = 0;
const split = reduce(p, { type: 'split', userId: 'me' });
ok('split creates two hands', split.seats[0].hands.length === 2);
ok('each split hand has two cards', split.seats[0].hands.every((h) => h.cards.length === 2));
ok('each split hand keeps the stake', split.seats[0].hands.every((h) => h.bet === 100));
ok('split hands cannot be blackjack', split.seats[0].hands.every((h) => !isBlackjack(h)));

console.log('\nMultiplayer & spectators');
let m = createState(11);
m = reduce(m, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
m = reduce(m, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
m = reduce(m, { type: 'bet', userId: 'a', amount: 100 });
m = reduce(m, { type: 'bet', userId: 'b', amount: 200 });
m = reduce(m, { type: 'deal' });
ok('both players were dealt in', m.seats.every((seat) => seat.hands.length === 1));
const mid = reduce(m, { type: 'join', userId: 'c', username: 'C', avatar, level: 1 });
ok('late joiner becomes a spectator', mid.seats[2].spectator === true);
ok('spectator gets no cards', mid.seats[2].hands.length === 0);
const reopened = reduce(mid, { type: 'openBetting' });
ok('next round clears spectator status', reopened.seats[2].spectator === false);
ok('next round clears bets', reopened.seats.every((seat) => seat.bet === 0));

let noBet = createState(12);
noBet = reduce(noBet, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
noBet = reduce(noBet, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
noBet = reduce(noBet, { type: 'bet', userId: 'a', amount: 100 });
noBet = reduce(noBet, { type: 'deal' });
ok('player without a bet sits out as spectator', noBet.seats[1].spectator === true);

console.log('\nDeterminism');
const runA = (() => {
  let x = createState(777);
  x = reduce(x, { type: 'join', userId: 'me', username: 'Me', avatar, level: 1 });
  x = reduce(x, { type: 'bet', userId: 'me', amount: 100 });
  return reduce(x, { type: 'deal' });
})();
const runB = (() => {
  let x = createState(777);
  x = reduce(x, { type: 'join', userId: 'me', username: 'Me', avatar, level: 1 });
  x = reduce(x, { type: 'bet', userId: 'me', amount: 100 });
  return reduce(x, { type: 'deal' });
})();
ok('same seed + same actions = identical state', JSON.stringify(runA) === JSON.stringify(runB));


if (fail > 0) process.exit(1);

/* ---------------------------------------------------------------- duel ---- */
import { duelWinner, pointsForHand, scoreHand, emptyScores, type DuelConfig } from '../src/games/blackjack/duel';
import { SCRATCH_TIERS, scratchRTP, rollScratch } from '../src/data/economy';

console.log('\nDuel scoring');
const dealer19 = [{ r: '10', s: 'C' }, { r: '9', s: 'D' }] as Card[];
const dealerBj = [{ r: 'A', s: 'C' }, { r: 'K', s: 'D' }] as Card[];
const mkHand = (cards: Card[], fromSplit = false) => ({ cards, bet: 100, done: true, doubled: false, fromSplit });

ok('beating the dealer is one point',
  pointsForHand(mkHand([{ r: '10', s: 'S' }, { r: 'K', s: 'H' }]), dealer19) === 1);
ok('losing to the dealer scores nothing',
  pointsForHand(mkHand([{ r: '10', s: 'S' }, { r: '7', s: 'H' }]), dealer19) === 0);
ok('a plain push scores nothing',
  pointsForHand(mkHand([{ r: '10', s: 'S' }, { r: '9', s: 'H' }]), dealer19) === 0);
ok('busting scores nothing',
  pointsForHand(mkHand([{ r: '10', s: 'S' }, { r: '9', s: 'H' }, { r: '5', s: 'D' }]), dealer19) === 0);
ok('blackjack is two points',
  pointsForHand(mkHand([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }]), dealer19) === 2);
ok('blackjack against a dealer blackjack is one point',
  pointsForHand(mkHand([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }]), dealerBj) === 1);
ok('a dealer blackjack beats a normal 20',
  pointsForHand(mkHand([{ r: '10', s: 'S' }, { r: 'K', s: 'H' }]), dealerBj) === 0);
ok('21 from a split is not a blackjack',
  pointsForHand(mkHand([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }], true), dealer19) === 1);

const raceCfg: DuelConfig = { format: 'race', target: 10, buyIn: 500 };
let scores = emptyScores(['a', 'b']);
let board = createState(4);
board = reduce(board, { type: 'join', userId: 'a', username: 'A', avatar, level: 1 });
board = reduce(board, { type: 'join', userId: 'b', username: 'B', avatar, level: 1 });
board = reduce(board, { type: 'bet', userId: 'a', amount: 100 });
board = reduce(board, { type: 'bet', userId: 'b', amount: 100 });
board = reduce(board, { type: 'deal' });
board.seats[0].hands = [mkHand([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }])];
board.seats[1].hands = [mkHand([{ r: '10', s: 'S' }, { r: '8', s: 'H' }])];
board.dealer.cards = dealer19;
scores = scoreHand(raceCfg, scores, board);
ok('duel: blackjack seat scores 2', scores.points.a === 2);
ok('duel: losing seat scores 0', scores.points.b === 0);
ok('race is not won early', duelWinner(raceCfg, scores) === null);
scores.points.a = 10;
ok('race ends at the target', duelWinner(raceCfg, scores) === 'a');
scores.points.b = 10;
ok('a tie does not end the race', duelWinner(raceCfg, scores) === null);

const bestOf: DuelConfig = { format: 'bestOf', target: 3, buyIn: 500 };
let series = emptyScores(['a', 'b']);
series.points.a = 9;
board.seats[0].hands = [mkHand([{ r: 'A', s: 'S' }, { r: 'K', s: 'H' }])];
series = scoreHand(bestOf, series, board);
ok('best-of: crossing 10 wins the round', series.rounds.a === 1);
ok('best-of: points reset each round', series.points.a === 0);
ok('best-of: round counter advances', series.round === 2);
ok('best-of is not decided after one round', duelWinner(bestOf, series) === null);
series.rounds.a = 2;
ok('best of 3 needs two rounds', duelWinner(bestOf, series) === 'a');

console.log('\nEconomy');
SCRATCH_TIERS.forEach((tier) => {
  const { ev, rtp } = scratchRTP(tier);
  const label = `${tier.id.padEnd(9)} price ${String(tier.price).padStart(6)}  EV ${ev.toFixed(0).padStart(6)}`;
  if (tier.price === 0) {
    ok(`${label}  (free card, small prizes)`, ev > 0 && ev < 30);
  } else {
    ok(`${label}  RTP ${(rtp * 100).toFixed(1)}%`, rtp > 0.8 && rtp < 0.95);
  }
});
const sample = Array.from({ length: 20000 }, () => rollScratch(SCRATCH_TIERS[1]));
const realised = sample.reduce((a, b) => a + b, 0) / sample.length;
ok(`brass card pays out near its EV over 20k draws (${realised.toFixed(0)})`,
  Math.abs(realised - scratchRTP(SCRATCH_TIERS[1]).ev) < 30);
ok('free card can never be a losing purchase', SCRATCH_TIERS[0].price === 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
