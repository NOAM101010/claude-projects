import { prisma } from "./prisma";
import {
  DEFAULT_SCANNER_CONFIG,
  DEFAULT_PROFILE_CONFIG,
  SCANNER_UNIVERSE_UNIQUE,
  normalizeProfileConfig,
  type ProfileConfig,
  type ScannerConfig,
} from "./scanner-config";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "./scoring";

export const BUILTIN_PROFILES: {
  name: string;
  description: string;
  config: Partial<ScannerConfig>;
  weights: Partial<ScoringWeights>;
}[] = [
  {
    name: "Breakouts (ברירת מחדל)",
    description: "Large Cap פריצות ATH / 52W עם ווליום — הסטייל האישי שלך",
    config: {},
    weights: {},
  },
  {
    name: "Momentum חזק",
    description: "מניות עם מומנטום גבוה בלבד — RSI 65-80, ווליום 2x+, קרוב לATH",
    config: {
      minRsi: 65,
      maxRsi: 80,
      volumeSpikeRatio: 2,
      nearAthPercent: 2,
      near52wHighPercent: 2,
    },
    // מדגיש ווליום + RSI, מפחית משקל לתבניות איטיות
    weights: {
      rsi: 20,
      volume: 20,
      highVolume: 14,
      todayMove: 14,
      breakoutAth: 22,
      breakout52w: 16,
      cupHandle: 0,
      gapEntry: 4,
    },
  },
  {
    name: "Pullback לא נורא",
    description: "מניות במגמת עלייה שירדו מעט (RSI 45-60, קרוב לEMA)",
    config: {
      minRsi: 45,
      maxRsi: 60,
      nearAthPercent: 8,
      near52wHighPercent: 8,
      volumeSpikeRatio: 1,
    },
    // מדגיש מבנה מגמה וקרבה לשיא, מוריד את משקל הפריצה/ווליום הרגעי
    weights: {
      maTrend: 24,
      rsi: 6,
      distanceFromAth: 14,
      nearAth: 14,
      near52w: 10,
      volume: 4,
      highVolume: 0,
      todayMove: 0,
      breakoutAth: 8,
      breakout52w: 6,
      gapUp: 0,
      cupHandle: 16,
    },
  },
  {
    name: "Gap Runners",
    description: "רק Gap Up מעל 3% עם ווליום גבוה — למסחר בפתיחה",
    config: {
      gapUpMin: 3,
      volumeSpikeRatio: 2,
    },
    // הכל סביב הגאפ והווליום של היום
    weights: {
      gapUp: 24,
      gapEntry: 18,
      todayMove: 18,
      volume: 16,
      highVolume: 12,
      cupHandle: 0,
      maTrend: 8,
      range52w: 4,
    },
  },
];

function builtinConfig(p: (typeof BUILTIN_PROFILES)[number]): ProfileConfig {
  return {
    filters: { ...DEFAULT_SCANNER_CONFIG, ...p.config },
    weights: { ...DEFAULT_WEIGHTS, ...p.weights },
  };
}

export async function ensureBuiltinProfiles() {
  const existing = await prisma.scannerProfile.findMany();
  if (existing.length > 0) return;
  for (const [i, p] of BUILTIN_PROFILES.entries()) {
    await prisma.scannerProfile.create({
      data: {
        name: p.name,
        description: p.description,
        config: JSON.stringify(builtinConfig(p)),
        isDefault: i === 0,
      },
    });
  }
}

/** config מלא של פרופיל (פילטרים + משקלים), עם תאימות לאחור לפורמט השטוח הישן. */
export function parseProfileConfig(raw: string | null | undefined): ProfileConfig {
  if (!raw) return DEFAULT_PROFILE_CONFIG;
  return normalizeProfileConfig(raw);
}

/** רק הפילטרים — נשמר לתאימות עם קוד קיים. */
export function mergeConfig(raw: string | null | undefined): ScannerConfig {
  return parseProfileConfig(raw).filters;
}

export function parseUniverse(raw: string | null | undefined): string[] {
  if (!raw) return SCANNER_UNIVERSE_UNIQUE;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length > 0)
      return arr.map((s) => String(s).toUpperCase());
  } catch {}
  return SCANNER_UNIVERSE_UNIQUE;
}
