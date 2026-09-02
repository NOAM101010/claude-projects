/**
 * The slot machine, in one file.
 *
 * Three independent reels drawn from the same weighted strip, one payline.
 * Weights and payouts live together so the return can be proved rather than
 * guessed — `slotsRTP()` is asserted by `npm run test:engine`.
 *
 * Every cabinet theme (`SLOT_THEME_SYMBOLS`) reuses this exact weight/triple
 * table position-for-position — only the glyph and name change per theme —
 * so all five machines pay out identically and stay provably fair. What
 * differs machine to machine is purely what you see land, not the odds.
 */

export interface SlotSymbol {
  id: string;
  glyph: string;
  name: { he: string; en: string };
  /** Relative frequency on the strip. */
  weight: number;
  /** Multiplier applied to the stake when all three land. */
  triple: number;
  accent: string;
}

export const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: 'clover', glyph: '🍀', name: { he: 'תלתן', en: 'Clover' }, weight: 30, triple: 5, accent: '#4fd39a' },
  { id: 'bell', glyph: '🔔', name: { he: 'פעמון', en: 'Bell' }, weight: 24, triple: 10, accent: '#e3b23c' },
  { id: 'coin', glyph: '🪙', name: { he: 'מטבע', en: 'Coin' }, weight: 18, triple: 20, accent: '#f8e3a8' },
  { id: 'star', glyph: '⭐', name: { he: 'כוכב', en: 'Star' }, weight: 12, triple: 40, accent: '#ffd76a' },
  { id: 'diamond', glyph: '💎', name: { he: 'יהלום', en: 'Diamond' }, weight: 8, triple: 100, accent: '#4aa8c8' },
  { id: 'seven', glyph: '7️⃣', name: { he: 'שבע', en: 'Seven' }, weight: 5, triple: 250, accent: '#e8807d' },
  { id: 'crown', glyph: '👑', name: { he: 'כתר', en: 'Crown' }, weight: 3, triple: 750, accent: '#a878f0' },
];

/** Builds a themed symbol set that reuses SLOT_SYMBOLS' weight/triple table positionally. */
function themeSet(ids: string[], glyphs: string[], names: { he: string; en: string }[], accents: string[]): SlotSymbol[] {
  return SLOT_SYMBOLS.map((base, i) => ({
    id: ids[i], glyph: glyphs[i], name: names[i], weight: base.weight, triple: base.triple, accent: accents[i],
  }));
}

/** One dedicated symbol set per cabinet theme — same odds, different art. */
export const SLOT_THEME_SYMBOLS: Record<string, SlotSymbol[]> = {
  'sl-classic': SLOT_SYMBOLS,
  'sl-fruit': themeSet(
    ['cherry', 'lemon', 'orange', 'grapes', 'watermelon', 'mango', 'pineapple'],
    ['🍒', '🍋', '🍊', '🍇', '🍉', '🥭', '🍍'],
    [
      { he: 'דובדבן', en: 'Cherry' }, { he: 'לימון', en: 'Lemon' }, { he: 'תפוז', en: 'Orange' },
      { he: 'ענבים', en: 'Grapes' }, { he: 'אבטיח', en: 'Watermelon' }, { he: 'מנגו', en: 'Mango' }, { he: 'אננס', en: 'Pineapple' },
    ],
    ['#e8807d', '#ffd76a', '#f0894a', '#a878f0', '#4fd39a', '#ffb457', '#e3b23c'],
  ),
  'sl-neon': themeSet(
    ['bolt', 'gem', 'ufo', 'orb', 'vortex', 'droid', 'invader'],
    ['⚡', '💠', '🛸', '🔮', '🌀', '🤖', '👾'],
    [
      { he: 'ברק', en: 'Bolt' }, { he: 'אבן חן', en: 'Gem' }, { he: 'עב טס', en: 'UFO' },
      { he: 'כדור קסם', en: 'Orb' }, { he: 'מערבולת', en: 'Vortex' }, { he: 'רובוט', en: 'Droid' }, { he: 'פולש', en: 'Invader' },
    ],
    ['#35e0c9', '#4aa8c8', '#a878f0', '#ff5fa2', '#38b6c8', '#e3b23c', '#a878f0'],
  ),
  'sl-egypt': themeSet(
    ['scarab', 'urn', 'eye', 'pyramid', 'cobra', 'sun', 'temple'],
    ['🪲', '🏺', '👁️', '🔺', '🐍', '☀️', '🏛️'],
    [
      { he: 'חיפושית קדושה', en: 'Scarab' }, { he: 'כד', en: 'Urn' }, { he: 'עין חורוס', en: 'Eye of Horus' },
      { he: 'פירמידה', en: 'Pyramid' }, { he: 'קוברה', en: 'Cobra' }, { he: 'שמש', en: 'Sun' }, { he: 'מקדש', en: 'Temple' },
    ],
    ['#4fd39a', '#c08a3e', '#e3b23c', '#f8e3a8', '#4fd39a', '#ffd76a', '#e3b23c'],
  ),
  'sl-galaxy': themeSet(
    ['comet', 'moon', 'planet', 'rocket', 'alien', 'shootingstar', 'nebula'],
    ['☄️', '🌙', '🪐', '🚀', '👽', '🌠', '🌌'],
    [
      { he: 'שביט', en: 'Comet' }, { he: 'ירח', en: 'Moon' }, { he: 'כוכב לכת', en: 'Planet' },
      { he: 'רקטה', en: 'Rocket' }, { he: 'חייזר', en: 'Alien' }, { he: 'כוכב נופל', en: 'Shooting star' }, { he: 'ערפילית', en: 'Nebula' },
    ],
    ['#a878f0', '#d7f0f5', '#e3b23c', '#e8807d', '#4fd39a', '#f8e3a8', '#7b5bd6'],
  ),
};

export const symbolsForTheme = (themeId: string): SlotSymbol[] => SLOT_THEME_SYMBOLS[themeId] ?? SLOT_SYMBOLS;

/** Two of a kind hands most of the stake back — the near miss that keeps you in. */
export const PAIR_RETURN = 0.7;

/** Stakes offered at the machine — the shared base chip rail. RTP (slotsRTP)
 *  is a pure function of the symbol table, so any stake just scales linearly. */
export const SLOT_STAKES = [25, 100, 250, 500, 1000, 2500, 5000, 10000] as const;

export const symbolById = (id: string, symbols: SlotSymbol[] = SLOT_SYMBOLS) => symbols.find((s) => s.id === id) ?? symbols[0];

const totalWeight = (symbols: SlotSymbol[]) => symbols.reduce((sum, s) => sum + s.weight, 0);

/** Draws one symbol from the weighted strip. */
export function spinReel(rng: () => number = Math.random, symbols: SlotSymbol[] = SLOT_SYMBOLS): SlotSymbol {
  let roll = rng() * totalWeight(symbols);
  for (const symbol of symbols) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol;
  }
  return symbols[symbols.length - 1];
}

export interface SpinOutcome {
  reels: SlotSymbol[];
  /** Chips returned to the player, stake included. 0 means a clean loss. */
  payout: number;
  kind: 'triple' | 'pair' | 'none';
  /** The symbol that scored, for the win banner. */
  symbol: SlotSymbol | null;
}

/** Resolves one pull for `stake` chips. */
export function pull(stake: number, rng: () => number = Math.random, symbols: SlotSymbol[] = SLOT_SYMBOLS): SpinOutcome {
  const reels = [spinReel(rng, symbols), spinReel(rng, symbols), spinReel(rng, symbols)];
  const [a, b, c] = reels;

  if (a.id === b.id && b.id === c.id) {
    return { reels, payout: Math.round(stake * a.triple), kind: 'triple', symbol: a };
  }

  // Any two matching, in any position.
  const paired = a.id === b.id ? a : b.id === c.id ? b : a.id === c.id ? a : null;
  if (paired) {
    return { reels, payout: Math.round(stake * PAIR_RETURN), kind: 'pair', symbol: paired };
  }

  return { reels, payout: 0, kind: 'none', symbol: null };
}

/**
 * Expected return per chip staked. Kept as a function so the number moves with
 * the table instead of rotting in a comment. Identical for every theme, since
 * SLOT_THEME_SYMBOLS reuses SLOT_SYMBOLS' weight/triple table throughout.
 */
export function slotsRTP() {
  const symbols = SLOT_SYMBOLS;
  const total = totalWeight(symbols);
  let triples = 0;
  let pairs = 0;
  for (const symbol of symbols) {
    const p = symbol.weight / total;
    triples += p ** 3 * symbol.triple;
    // exactly two of this symbol, in any of the three arrangements
    pairs += 3 * p ** 2 * (1 - p) * PAIR_RETURN;
  }
  return { triples, pairs, rtp: triples + pairs };
}
