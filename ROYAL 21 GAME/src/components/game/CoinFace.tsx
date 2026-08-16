import { useMemo } from 'react';

export interface CoinSkinDef {
  name: { he: string; en: string };
  /** Center emblem shown on the heads face. */
  emblem: string;
  emblemSize: number;
  metal: { light: string; mid: string; dark: string; glow: string };
}

/** One metal tone + one emblem per owned coin skin — the thing that actually changes when you equip a different coin. */
export const COIN_SKINS: Record<string, CoinSkinDef> = {
  'cn-classic': { name: { he: 'קלאסי', en: 'Classic' }, emblem: '₪', emblemSize: 38, metal: { light: '#f4f4f2', mid: '#b9c0cb', dark: '#565d68', glow: 'rgba(185,192,203,.4)' } },
  'cn-gold': { name: { he: 'זהב זוהר', en: 'Gold Shine' }, emblem: '€', emblemSize: 38, metal: { light: '#fff6d8', mid: '#ffd75e', dark: '#a9790a', glow: 'rgba(255,214,80,.55)' } },
  'cn-neon': { name: { he: 'ניאון', en: 'Neon' }, emblem: '$', emblemSize: 38, metal: { light: '#baffef', mid: '#35e0c9', dark: '#0a6e5f', glow: 'rgba(53,224,201,.55)' } },
  'cn-diamond': { name: { he: 'יהלום', en: 'Diamond' }, emblem: '💎', emblemSize: 30, metal: { light: '#ffffff', mid: '#bfe9ff', dark: '#4facd6', glow: 'rgba(160,220,255,.6)' } },
  'cn-royal': { name: { he: 'מלכותי', en: 'Royal' }, emblem: '👑', emblemSize: 30, metal: { light: '#fff0c8', mid: '#c98cff', dark: '#5c1fa0', glow: 'rgba(180,110,255,.55)' } },
  // ---- Daily Rarity exclusive coins ----
  'cn-dollar': { name: { he: 'דולר', en: 'Dollar' }, emblem: '$', emblemSize: 38, metal: { light: '#eae2c7', mid: '#c8a260', dark: '#6d4813', glow: 'rgba(200,162,96,.55)' } },
  'cn-euro': { name: { he: 'יורו', en: 'Euro' }, emblem: '€', emblemSize: 38, metal: { light: '#dfe9f5', mid: '#5c9bd8', dark: '#1a3f6d', glow: 'rgba(92,155,216,.55)' } },
  'cn-pound': { name: { he: 'ליש"ט', en: 'Pound' }, emblem: '£', emblemSize: 38, metal: { light: '#f2e0c0', mid: '#c48a3a', dark: '#5e3a10', glow: 'rgba(196,138,58,.55)' } },
  'cn-yen': { name: { he: 'יין', en: 'Yen' }, emblem: '¥', emblemSize: 38, metal: { light: '#f4d8de', mid: '#d8637a', dark: '#742537', glow: 'rgba(216,99,122,.55)' } },
  'cn-bitcoin': { name: { he: 'ביטקוין', en: 'Bitcoin' }, emblem: '₿', emblemSize: 38, metal: { light: '#ffe6c2', mid: '#ff9f2f', dark: '#8a3f00', glow: 'rgba(255,159,47,.6)' } },
  'cn-shekel-gold': { name: { he: 'שקל זהב', en: 'Gold Shekel' }, emblem: '₪', emblemSize: 38, metal: { light: '#fff4c8', mid: '#ffcf3d', dark: '#8a5a00', glow: 'rgba(255,207,61,.6)' } },
};

export const coinSkinOf = (id: string): CoinSkinDef => COIN_SKINS[id] ?? COIN_SKINS['cn-classic'];

/**
 * The chip glyph — what stands in for the 🪙 emoji anywhere chips are shown
 * as a balance, price, pot, or reward. Reads from the equipped `currencySkin`
 * slot (Daily-Rarity coins only). The regular Coin Flip skin (`coinSkin`) is
 * completely separate and never touches the currency glyph — so equipping a
 * Neon coin for coin-flip won't repaint every balance in the UI.
 */
export const chipGlyphOf = (id: string | null | undefined): string => {
  if (!id) return '🪙';
  const def = COIN_SKINS[id];
  return def?.emblem ?? '🪙';
};

interface Props {
  skin?: string;
  face: 'heads' | 'tails';
  size?: number;
}

/**
 * A real-coin-shaped face: reeded rim, embossed metal disc, engraved inner
 * ring, specular highlight. Heads carries the skin's own emblem; tails is a
 * shared laurel-wreath reverse (recolored per metal) — the same obverse/
 * reverse pairing real coins use, so only one side has to change per skin.
 */
export function CoinFace({ skin = 'cn-classic', face, size = 168 }: Props) {
  const def = coinSkinOf(skin);
  const uid = skin;
  const r = 48;

  const leaves = useMemo(() => {
    const items: { x: number; y: number; rot: number }[] = [];
    for (const side of [1, -1] as const) {
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const angle = side * (26 + t * 110);
        const rad = (angle * Math.PI) / 180;
        const radius = 33;
        items.push({ x: 50 + Math.sin(rad) * radius, y: 50 - Math.cos(rad) * radius, rot: angle + 90 * side });
      }
    }
    return items;
  }, []);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ filter: `drop-shadow(0 0 ${size * 0.25}px ${def.metal.glow})` }}>
      <defs>
        <radialGradient id={`coin-metal-${uid}`} cx="34%" cy="28%" r="75%">
          <stop offset="0%" stopColor={def.metal.light} />
          <stop offset="45%" stopColor={def.metal.mid} />
          <stop offset="100%" stopColor={def.metal.dark} />
        </radialGradient>
        <radialGradient id={`coin-spec-${uid}`} cx="30%" cy="20%" r="45%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r={r} fill={`url(#coin-metal-${uid})`} stroke={def.metal.dark} strokeWidth="1" />

      {/* reeded / milled edge */}
      <g stroke={def.metal.dark} strokeOpacity="0.55" strokeWidth="1">
        {Array.from({ length: 56 }).map((_, i) => {
          const a = (i / 56) * Math.PI * 2;
          return (
            <line key={i}
              x1={50 + Math.cos(a) * (r - 0.5)} y1={50 + Math.sin(a) * (r - 0.5)}
              x2={50 + Math.cos(a) * (r - 3)} y2={50 + Math.sin(a) * (r - 3)}
            />
          );
        })}
      </g>

      {/* engraved inner ring */}
      <circle cx="50" cy="50" r={r - 7} fill="none" stroke={def.metal.dark} strokeOpacity="0.5" strokeWidth="0.8" />
      <circle cx="50" cy="50" r={r - 8.4} fill="none" stroke={def.metal.light} strokeOpacity="0.45" strokeWidth="0.5" />

      {face === 'heads' ? (
        <text x="50" y="51" textAnchor="middle" dominantBaseline="central"
          fontSize={def.emblemSize} fontFamily="var(--font-display)" fontWeight={900}
          fill={def.metal.dark} style={{ textShadow: `0 1px 0 ${def.metal.light}` }}
        >
          {def.emblem}
        </text>
      ) : (
        <g>
          {leaves.map((leaf, i) => (
            <ellipse key={i} cx={leaf.x} cy={leaf.y} rx="3.4" ry="1.7" fill={def.metal.dark} opacity="0.55"
              transform={`rotate(${leaf.rot} ${leaf.x} ${leaf.y})`}
            />
          ))}
          <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="28" fill={def.metal.dark}>
            ♛
          </text>
        </g>
      )}

      <circle cx="50" cy="50" r={r} fill={`url(#coin-spec-${uid})`} />
    </svg>
  );
}
