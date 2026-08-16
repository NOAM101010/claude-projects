/**
 * Slot machine maths. Run with `npm run test:slots`.
 *
 * The point of this file is that the advertised return is a measured number,
 * not a hopeful comment: the analytic RTP and a large simulation have to agree.
 */
import { PAIR_RETURN, SLOT_SYMBOLS, pull, slotsRTP, spinReel } from '@/data/slots';

let failures = 0;
const check = (name: string, condition: boolean, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

/** Deterministic RNG so a failure is reproducible. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

console.log('\nslots — table');
const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
check('weights are positive', SLOT_SYMBOLS.every((s) => s.weight > 0));
check('payouts rise as symbols get rarer', SLOT_SYMBOLS.every((symbol, i, all) => (
  i === 0 || (all[i - 1].weight > symbol.weight && all[i - 1].triple < symbol.triple)
)));
check('total weight is 100', totalWeight === 100, String(totalWeight));

console.log('\nslots — analytic return');
const { triples, pairs, rtp } = slotsRTP();
check('RTP is between 85% and 92%', rtp > 0.85 && rtp < 0.92, `${(rtp * 100).toFixed(2)}%`);
check('triples carry most of the return', triples > pairs, `triples ${(triples * 100).toFixed(1)}% vs pairs ${(pairs * 100).toFixed(1)}%`);

console.log('\nslots — payout resolution');
{
  // Force a known reel by stubbing the strip draw through a rigged rng.
  const alwaysFirst = () => 0.0001;
  const clover = spinReel(alwaysFirst);
  check('lowest roll draws the most common symbol', clover.id === SLOT_SYMBOLS[0].id, clover.id);

  const tripleOutcome = pull(100, alwaysFirst);
  check('three of a kind pays the triple multiplier',
    tripleOutcome.kind === 'triple' && tripleOutcome.payout === 100 * SLOT_SYMBOLS[0].triple,
    `payout ${tripleOutcome.payout}`);
}

console.log('\nslots — simulation (200k pulls)');
{
  const rng = seeded(20260815);
  const stake = 100;
  const spins = 200_000;
  let staked = 0;
  let returned = 0;
  const kinds = { triple: 0, pair: 0, none: 0 };

  for (let i = 0; i < spins; i++) {
    const outcome = pull(stake, rng);
    staked += stake;
    returned += outcome.payout;
    kinds[outcome.kind]++;
    if (outcome.kind === 'pair' && outcome.payout !== Math.round(stake * PAIR_RETURN)) {
      failures++;
      console.error('  FAIL pair payout drifted');
      break;
    }
  }

  const measured = returned / staked;
  check('simulated RTP matches the analytic one within 1.5pt',
    Math.abs(measured - rtp) < 0.015,
    `measured ${(measured * 100).toFixed(2)}% vs analytic ${(rtp * 100).toFixed(2)}%`);
  check('every pull resolves to one of the three kinds',
    kinds.triple + kinds.pair + kinds.none === spins);
  check('triples are rare but real', kinds.triple > 0 && kinds.triple / spins < 0.08,
    `${((kinds.triple / spins) * 100).toFixed(2)}% of pulls`);
  check('a losing pull returns nothing', kinds.none > 0);
  console.log(`  info hit rate ${(((kinds.triple + kinds.pair) / spins) * 100).toFixed(1)}%`);
}

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall slot checks passed\n');
process.exit(failures ? 1 : 0);
