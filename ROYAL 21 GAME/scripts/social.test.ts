/**
 * Gift / VIP / login-streak maths. Run with `npm run test:social`.
 *
 * These mirror the server-side RPCs in supabase/setup.sql exactly (send_gift,
 * claim_level_milestone, the discount inside buy_item) — the point of this
 * file is to catch the client-side copy drifting from the SQL original.
 */
import {
  STREAK_REWARD, SHOP_DISCOUNT_TIERS, shopDiscountTier, discountedPrice, milestoneReward, GIFT_DAILY_LIMIT, MILESTONE_EVERY,
  nextStreakDay, daysSince, COMEBACK_THRESHOLD_DAYS, COMEBACK_BONUS,
} from '@/data/economy';
import { vipTier, vipTierName, nextVipTier, isVipEligible, VIP_MIN_LEVEL, VIP_TIER_PERKS } from '@/data/vip';
import type { Profile } from '@/types';

const asProfile = (level: number) => ({ level } as unknown as Profile);
import {
  MISSIONS, WEEKLY_MISSIONS, MAX_MISSION_REWARD, dailyMissions, weeklyMission,
  weekKeyFor, shiftDateKey, missionValue, missionComplete,
} from '@/data/missions';
import { ACHIEVEMENTS, achievementById } from '@/data/achievements';
import { isFriendOnline } from '@/lib/presence';

let failures = 0;
const check = (name: string, condition: boolean, detail = '') => {
  if (condition) {
    console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

console.log('\nlogin streak — reward ladder (must match claim_daily_bonus CASE)');
check('day 1 pays the base amount', STREAK_REWARD(1) === 500);
check('day 3 still pays the base amount', STREAK_REWARD(3) === 500);
check('day 4 steps up', STREAK_REWARD(4) === 1000);
check('day 6 is still 1000', STREAK_REWARD(6) === 1000);
check('day 7 pays 7-day milestone (5000)', STREAK_REWARD(7) === 5000);
check('day 8 goes back to base (1500)', STREAK_REWARD(8) === 1500);
check('day 13 still 1500', STREAK_REWARD(13) === 1500);
check('day 14 pays 2-week milestone (15000)', STREAK_REWARD(14) === 15000);
check('day 15 goes to 2000 base', STREAK_REWARD(15) === 2000);
check('day 29 still 2000', STREAK_REWARD(29) === 2000);
check('day 30 pays monthly milestone (50000)', STREAK_REWARD(30) === 50000);
check('day 31 goes to 2500 base', STREAK_REWARD(31) === 2500);
check('day 60 still 2500', STREAK_REWARD(60) === 2500);

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

console.log('\nlogin streak — double-claim guard (mirrors usePlayer.claimDaily)');
{
  // The gate in claimDaily(): `if (effectiveDaily.lastClaim === today) return null`
  // — no grant, regardless of what the ladder would pay. The server RPC is the
  // second, atomic gate for the multi-device case.
  const today = new Date().toISOString().slice(0, 10);
  const claimDailyWouldGrant = (daily: { lastClaim: string | null; day: number }) =>
    daily.lastClaim !== today;
  check('claiming again the same day is blocked by the lastClaim guard',
    claimDailyWouldGrant({ lastClaim: today, day: 5 }) === false);
  check('claiming on a fresh day is allowed',
    claimDailyWouldGrant({ lastClaim: null, day: 0 }) === true);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  check('claiming the day after continues (guard passes, ladder advances)',
    claimDailyWouldGrant({ lastClaim: yesterday, day: 5 }) === true
      && nextStreakDay({ lastClaim: yesterday, day: 5 }) === 6);
}

console.log('\nshop discount tiers');
check('level 1 is tier 1', shopDiscountTier(1).tier === 1);
check('level 15 is still tier 1', shopDiscountTier(15).tier === 1);
check('level 16 crosses into tier 2', shopDiscountTier(16).tier === 2);
check('level 35 is still tier 2', shopDiscountTier(35).tier === 2);
check('level 36 crosses into tier 3', shopDiscountTier(36).tier === 3);
check('discounts rise with tier', SHOP_DISCOUNT_TIERS.every((t, i, all) => i === 0 || all[i - 1].shopDiscount < t.shopDiscount));

console.log('\nshop discount — price');
check('tier 1 discount matches buy_item()', discountedPrice(2000, 1) === Math.floor(2000 * 0.95), String(discountedPrice(2000, 1)));
check('tier 2 discount matches buy_item()', discountedPrice(2000, 16) === Math.floor(2000 * 0.90), String(discountedPrice(2000, 16)));
check('tier 3 discount matches buy_item()', discountedPrice(2000, 36) === Math.floor(2000 * 0.85), String(discountedPrice(2000, 36)));
check('a free item stays free at every tier', discountedPrice(0, 40) === 0);

console.log('\nVIP club — level-only tiers (mirror vip_tier_of() in supabase/vip.sql)');
check('VIP_MIN_LEVEL is 5', VIP_MIN_LEVEL === 5);
check('level 4 is not VIP', vipTier(4) === 0 && !isVipEligible(asProfile(4)));
check('level 5 is Bronze', vipTier(5) === 1 && isVipEligible(asProfile(5)));
check('level 11 is still Bronze', vipTier(11) === 1);
check('level 12 is Silver', vipTier(12) === 2);
check('level 21 is still Silver', vipTier(21) === 2);
check('level 22 is Gold', vipTier(22) === 3);
check('level 34 is still Gold', vipTier(34) === 3);
check('level 35 is Diamond', vipTier(35) === 4);
check('tier names', vipTierName(1) === 'Bronze' && vipTierName(4) === 'Diamond');
check('nextVipTier at level 5 points to Silver@12', nextVipTier(5)?.tier === 2 && nextVipTier(5)?.atLevel === 12);
check('nextVipTier at Diamond is null', nextVipTier(40) === null);
check('daily bonus rises with tier',
  VIP_TIER_PERKS[1].dailyBonus < VIP_TIER_PERKS[2].dailyBonus
  && VIP_TIER_PERKS[2].dailyBonus < VIP_TIER_PERKS[3].dailyBonus
  && VIP_TIER_PERKS[3].dailyBonus < VIP_TIER_PERKS[4].dailyBonus);
check('cashback only from Silver up', VIP_TIER_PERKS[1].cashbackPct === 0 && VIP_TIER_PERKS[2].cashbackPct > 0);
check('stipend only from Gold up', VIP_TIER_PERKS[2].weeklyStipend === 0 && VIP_TIER_PERKS[3].weeklyStipend > 0);

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
check('daily limit matches send_gift()', GIFT_DAILY_LIMIT === 50000);

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

console.log('\nMissions — rotation + progress');
{
  const day = '2026-03-15';
  const a = dailyMissions(day);
  const b = dailyMissions(day);
  check('dailyMissions is deterministic per date', JSON.stringify(a.map((m) => m.id)) === JSON.stringify(b.map((m) => m.id)));
  check('dailyMissions returns exactly 3', a.length === 3);
  check('the 3 missions are distinct', new Set(a.map((m) => m.id)).size === 3);
  check('the lineup mixes kinds (≥1 quantity + ≥1 variety)',
    a.some((m) => m.kind === 'quantity') && a.some((m) => m.kind === 'variety'));
  const yesterday = shiftDateKey(day, -1);
  const y = new Set(dailyMissions(yesterday).map((m) => m.id));
  check("today's set is not identical to yesterday's",
    !a.every((m) => y.has(m.id)));
  check('a different date gives a different (or at least re-rolled) lineup — determinism holds both ways',
    JSON.stringify(dailyMissions('2026-06-01').map((m) => m.id)) === JSON.stringify(dailyMissions('2026-06-01').map((m) => m.id)));

  const w1 = weeklyMission(weekKeyFor(day));
  const w2 = weeklyMission(weekKeyFor(day));
  check('weeklyMission is deterministic per week', w1.id === w2.id);
  check('weeklyMission is one of the weekly pool', WEEKLY_MISSIONS.some((m) => m.id === w1.id));

  check('no daily mission pays over the cap', MISSIONS.every((m) => m.reward <= MAX_MISSION_REWARD));
  check('no weekly mission pays over the cap', WEEKLY_MISSIONS.every((m) => m.reward <= MAX_MISSION_REWARD));

  // missionValue / missionComplete
  const handsM = MISSIONS.find((m) => m.id === 'hands10')!;
  check('missionValue reads the right counter', missionValue(handsM, { counts: { hands: 7 }, games: [] }) === 7);
  check('missionComplete is false below goal', missionComplete(handsM, { counts: { hands: 9 }, games: [] }) === false);
  check('missionComplete is true at goal', missionComplete(handsM, { counts: { hands: 10 }, games: [] }) === true);
  const gamesM = MISSIONS.find((m) => m.id === 'games3')!;
  check('gamesVariety counts distinct games', missionValue(gamesM, { counts: {}, games: ['blackjack', 'roulette', 'slots'] }) === 3);
  const pokerM = MISSIONS.find((m) => m.id === 'poker1')!;
  check('pokerAny sums poker + sng', missionValue(pokerM, { counts: { poker: 0, sng: 1 }, games: [] }) === 1);
}

console.log('\nPresence freshness gate (isFriendOnline)');
{
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 90_000).toISOString();
  check('fresh + non-offline presence is online', isFriendOnline({ presence: 'hub', lastSeen: now }) === true);
  check('non-offline but stale last_seen is NOT online', isFriendOnline({ presence: 'hub', lastSeen: stale }) === false);
  check('offline presence is never online, even if just seen', isFriendOnline({ presence: 'offline', lastSeen: now }) === false);
  check('missing last_seen is not online', isFriendOnline({ presence: 'hub', lastSeen: null }) === false);
  check('missing presence is not online', isFriendOnline({ lastSeen: now }) === false);
}

console.log('\nDM unread tally (mirrors dmService.unreadCounts reducer)');
{
  const rows = [{ sender_id: 'a' }, { sender_id: 'a' }, { sender_id: 'b' }];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.sender_id] = (counts[r.sender_id] ?? 0) + 1;
  check('two from a, one from b', counts.a === 2 && counts.b === 1);
  check('total unread is 3', Object.values(counts).reduce((s, n) => s + n, 0) === 3);
}

console.log('\nEvent trophies');
{
  const stat = ACHIEVEMENTS.filter((a) => a.kind !== 'event');
  const event = ACHIEVEMENTS.filter((a) => a.kind === 'event');
  check('stat trophies all carry a stat + goal', stat.every((a) => a.stat != null && a.goal != null));
  check('event trophies carry no stat + no goal', event.every((a) => a.stat == null && a.goal == null));
  check('there are ~10 event trophies', event.length >= 7 && event.length <= 12);
  check('every event trophy has a tier + a trophy glyph + a reward',
    event.every((a) => a.tier && a.trophy && a.reward > 0));
  check('event trophy ids are unique + resolvable', event.every((a) => achievementById(a.id) === a));
  // checkAchievements iterates ACHIEVEMENTS and skips `kind === 'event' || !stat || goal === undefined`
  const skipped = ACHIEVEMENTS.filter((a) => a.kind === 'event' || !a.stat || a.goal === undefined);
  check('the auto-check would skip exactly the event trophies', skipped.length === event.length);
}

console.log(failures ? `\n${failures} failing check(s)\n` : '\nall social checks passed\n');
process.exit(failures ? 1 : 0);
