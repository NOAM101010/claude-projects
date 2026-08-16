/**
 * Gift / VIP / login-streak maths. Run with `npm run test:social`.
 *
 * These mirror the server-side RPCs in supabase/setup.sql exactly (send_gift,
 * claim_level_milestone, the discount inside buy_item) — the point of this
 * file is to catch the client-side copy drifting from the SQL original.
 */
import {
  STREAK_REWARD, VIP_TIERS, vipTierOf, discountedPrice, milestoneReward, GIFT_DAILY_LIMIT, MILESTONE_EVERY,
  nextStreakDay, daysSince, COMEBACK_THRESHOLD_DAYS, COMEBACK_BONUS,
} from '@/data/economy';

let failures = 0;
const check = (name: string, condition: boolean, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

console.log('\nlogin streak — reward ladder');
check('day 1 pays the base amount', STREAK_REWARD(1) === 50);
check('day 3 still pays the base amount', STREAK_REWARD(3) === 50);
check('day 4 steps up', STREAK_REWARD(4) === 100);
check('day 6 is still 100', STREAK_REWARD(6) === 100);
check('day 7 pays 7-day milestone (500)', STREAK_REWARD(7) === 500);
check('day 8 goes back to base (250)', STREAK_REWARD(8) === 250);
check('day 13 still 250', STREAK_REWARD(13) === 250);
check('day 14 pays 2-week milestone (1000)', STREAK_REWARD(14) === 1000);
check('day 15 goes to 400 base', STREAK_REWARD(15) === 400);
check('day 29 still 400', STREAK_REWARD(29) === 400);
check('day 30 pays monthly milestone (3000)', STREAK_REWARD(30) === 3000);
check('day 31 goes to 500 base', STREAK_REWARD(31) === 500);
check('day 60 still 500', STREAK_REWARD(60) === 500);

console.log('\nlogin streak — day tracking (nextStreakDay)');
check('no prior claim starts at day 1', nextStreakDay({ lastClaim: null, day: 0 }) === 1);
{
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  check('claiming the day after yesterday continues the streak',
    nextStreakDay({ lastClaim: yesterday, day: 3 }) === 4);
}
{
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  check('a skipped day resets the streak to 1',
    nextStreakDay({ lastClaim: twoDaysAgo, day: 6 }) === 1);
}

console.log('\nVIP tiers');
check('level 1 is tier 1', vipTierOf(1).tier === 1);
check('level 15 is still tier 1', vipTierOf(15).tier === 1);
check('level 16 crosses into tier 2', vipTierOf(16).tier === 2);
check('level 35 is still tier 2', vipTierOf(35).tier === 2);
check('level 36 crosses into tier 3', vipTierOf(36).tier === 3);
check('discounts rise with tier', VIP_TIERS.every((t, i, all) => i === 0 || all[i - 1].shopDiscount < t.shopDiscount));

console.log('\nVIP — shop discount');
check('tier 1 discount matches buy_item()', discountedPrice(2000, 1) === Math.floor(2000 * 0.95), String(discountedPrice(2000, 1)));
check('tier 2 discount matches buy_item()', discountedPrice(2000, 16) === Math.floor(2000 * 0.90), String(discountedPrice(2000, 16)));
check('tier 3 discount matches buy_item()', discountedPrice(2000, 36) === Math.floor(2000 * 0.85), String(discountedPrice(2000, 36)));
check('a free item stays free at every tier', discountedPrice(0, 40) === 0);

console.log('\nVIP — level milestones');
check('milestones land on multiples of 5', MILESTONE_EVERY === 5);
check('chips scale with the milestone level', milestoneReward(40).chips === 40 * 80);
check('cosmetic odds rise with tier', (() => {
  const t1 = milestoneReward(5).cosmeticChance;
  const t2 = milestoneReward(20).cosmeticChance;
  const t3 = milestoneReward(40).cosmeticChance;
  return t1 < t2 && t2 < t3;
})());
check('rarity pool gets better with tier', (() => {
  const t3pool = milestoneReward(40).rarityPool;
  return t3pool.includes('legendary') && !milestoneReward(5).rarityPool.includes('legendary');
})());

console.log('\nGift system');
check('daily limit matches send_gift()', GIFT_DAILY_LIMIT === 500);

console.log('\nComeback bonus');
{
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  check('a claim from yesterday is 1 day ago', daysSince(yesterday) === 1);
}
{
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  check('a claim from 5 days ago is 5 days ago', daysSince(fiveDaysAgo) === 5);
}
check('the threshold is 3 days', COMEBACK_THRESHOLD_DAYS === 3);
{
  // Mirrors the comeback check in usePlayer.claimDaily(): daysSince(lastClaim) >= threshold.
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  check('missing 2 days does not trigger the comeback bonus', daysSince(twoDaysAgo) < COMEBACK_THRESHOLD_DAYS);
  check('missing 3+ days triggers the comeback bonus', daysSince(threeDaysAgo) >= COMEBACK_THRESHOLD_DAYS);
}
check('comeback bonus is a flat top-up', COMEBACK_BONUS === 300);

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall social checks passed\n');
process.exit(failures ? 1 : 0);
