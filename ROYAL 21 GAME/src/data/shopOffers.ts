import { ITEMS } from './items';
import type { ShopItem } from '@/types';

/**
 * Rotating shop offers.
 *
 * Two independent rotations run:
 *   • Daily Offers — three items get 30% off, chosen deterministically from
 *     the seed of today's date so every client shows the same lineup.
 *   • Weekly Rare Rotation — five specific rare/mythic items rotate through
 *     the "rare rotation" slot, one per weekday, so the mythic coin skins
 *     everyone chases surface predictably even for players who log in only
 *     on weekends.
 *
 * Both derive from local date only — no server call, no random per-refresh.
 */

/** Percentage off for daily offers. */
export const DAILY_DISCOUNT = 0.3;

/** Fisher-Yates shuffle with a seeded PRNG (mulberry32). */
function shuffleSeeded<T>(input: T[], seed: number): T[] {
  const array = [...input];
  let a = seed | 0;
  const rand = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** YYYYMMDD as a number, used as a stable per-day seed. */
function dateSeed(date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
}

/**
 * Three items with 30% off today. Excludes free items, mythics, and
 * daily-rarity exclusives — those have their own slots.
 */
export function todaysDailyOffers(date = new Date()): { item: ShopItem; discount: number }[] {
  const candidates = ITEMS.filter(
    (item) => item.price > 0 && item.rarity !== 'mythic' && !item.dailyRarityOnly && !item.rareRotationOnly,
  );
  const shuffled = shuffleSeeded(candidates, dateSeed(date));
  return shuffled.slice(0, 3).map((item) => ({ item, discount: DAILY_DISCOUNT }));
}

/**
 * The "Special Today" — one exclusive item per day, drawn from the combined
 * pool of `dailyRarityOnly` (mythic coin skins) and `rareRotationOnly`
 * (holo coin flip, royal suite bundle) items. These never appear in the
 * normal grid; the only way to get one is to catch it on its day. The pick is
 * deterministic (today's date seed indexes the id-sorted pool) so every player
 * worldwide sees the same one today and knows when to check back.
 */
export function todaysSpecialItem(date = new Date()): ShopItem | null {
  const pool = ITEMS
    .filter((item) => item.dailyRarityOnly || item.rareRotationOnly)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  return pool[dateSeed(date) % pool.length];
}

/** How much time until the offers rotate (returns "23:12:04" etc). */
export function timeUntilNextRotation(now = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/* Bundle packs — a curated multi-item purchase with a flat discount.         */
/*                                                                            */
/* SOURCE OF TRUTH for a signed-in player is public.bundles (supabase/buy-    */
/* pack.sql) — buy_pack(p_pack_id) reads item_ids + discount from there and    */
/* re-prices server-side, so this table MUST be kept in sync with that seed.   */
/* The list below is what the shop renders and what the guest / offline path   */
/* charges locally. The pack discount REPLACES the VIP shop discount (never    */
/* stacked); since every pack discount (0.25+) already beats the top VIP tier  */
/* (0.15), that is also always the cheaper deal for the player.               */
/* -------------------------------------------------------------------------- */

export interface Pack {
  id: string;
  name: { he: string; en: string };
  subtitle: { he: string; en: string };
  itemIds: string[];
  discount: number; // 0..1
  icon: string;
  color: string;
}

export const PACKS: Pack[] = [
  {
    id: 'pack_starter',
    name: { he: 'חבילת פתיחה', en: 'Starter Pack' },
    subtitle: { he: 'קלפים + צ׳יפים + שולחן', en: 'Cards + chips + a table' },
    itemIds: ['cf_noir', 'ch_gold', 'tb_noir'],
    discount: 0.35,
    icon: '🎁',
    color: '#4aa8c8',
  },
  {
    id: 'pack_style',
    name: { he: 'חבילת סטייל', en: 'Style Pack' },
    subtitle: { he: 'חליפה + שעון + שרשרת', en: 'Suit + watch + chain' },
    itemIds: ['cl_gold', 'wt_gold', 'cn_gold'],
    discount: 0.30,
    icon: '💎',
    color: '#e3b23c',
  },
  {
    id: 'pack_luxury',
    name: { he: 'חבילת יוקרה', en: 'Luxury Pack' },
    subtitle: { he: 'הפריטים היקרים ביותר', en: 'The most valuable items' },
    itemIds: ['cf_gold', 'ch_ivory', 'tb_gold', 'cl_royal'],
    discount: 0.40,
    icon: '👑',
    color: '#a878f0',
  },
  {
    id: 'pack_royal_table',
    name: { he: 'שולחן מלכותי', en: 'Royal Table' },
    subtitle: { he: 'שולחן, קלפים וגב תואמים', en: 'Matching table, cards & back' },
    itemIds: ['tb_royal', 'cf_royal', 'bk_royal'],
    discount: 0.35,
    icon: '👑',
    color: '#a878f0',
  },
  {
    id: 'pack_jade',
    name: { he: 'ערכת אזמרגד', en: 'Jade Set' },
    subtitle: { he: 'שולחן, קלפים ומסגרת', en: 'Table, cards & a frame' },
    itemIds: ['tb_jade', 'cf_jade', 'fr_jade'],
    discount: 0.30,
    icon: '💚',
    color: '#4fd39a',
  },
  {
    id: 'pack_royal_suite',
    name: { he: 'ערכת שולחן מלכותית', en: 'Royal Table Suite' },
    subtitle: { he: 'שולחן, גב, קלפים ואפקט ניצחון', en: 'Table, back, cards & victory effect' },
    itemIds: ['tb_royal', 'bk_royal', 'cf_royal', 'vc_stars'],
    discount: 0.40,
    icon: '👑',
    color: '#a878f0',
  },
  {
    id: 'pack_celebration',
    name: { he: 'חבילת חגיגה', en: 'Celebration Pack' },
    subtitle: { he: 'שני אפקטי ניצחון ומסגרת', en: 'Two victory effects & a frame' },
    itemIds: ['vc_fireworks', 'vc_stars', 'fr_rose'],
    discount: 0.25,
    icon: '🎆',
    color: '#e3b23c',
  },
];

/** Full price and post-discount price for a pack. */
export function packPricing(pack: Pack): { fullPrice: number; discountedPrice: number } {
  const fullPrice = pack.itemIds.reduce((sum, id) => {
    const item = ITEMS.find((x) => x.id === id);
    return sum + (item?.price ?? 0);
  }, 0);
  return {
    fullPrice,
    discountedPrice: Math.floor(fullPrice * (1 - pack.discount)),
  };
}
