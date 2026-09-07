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
import { unionSetupWeights, type SetupId } from "./setups";

/**
 * 5 הפרופילים המובנים. כל פרופיל = סטאפ (או שניים) + פילטרים ומשקלים מותאמים.
 * הם נשמרים ב-DB עם isBuiltin=true ומתעדכנים בכל ensureBuiltinProfiles.
 */
export const BUILTIN_PROFILES: {
  name: string;
  description: string;
  enabledSetups: SetupId[];
  config: Partial<ScannerConfig>;
  weights: Partial<ScoringWeights>;
}[] = [
  {
    name: "פריצת ATH",
    description: "רק פריצות טריות מעל שיא כל הזמנים, עם ווליום תומך",
    enabledSetups: ["ath_breakout"],
    config: { nearAthPercent: 2, volumeSpikeRatio: 1.5, minRsi: 50, maxRsi: 85 },
    weights: { highVolume: 10 },
  },
  {
    name: "פריצת שיא (52ש׳ / התנגדות)",
    description: "יציאה מבסיס — פריצת שיא 52 שבועות או פריצת התנגדות של 20-60 יום",
    enabledSetups: ["breakout_52w", "resistance_breakout"],
    config: { near52wHighPercent: 3, volumeSpikeRatio: 1.5 },
    weights: { highVolume: 10 },
  },
  {
    name: "Cup & Handle",
    description: "תבנית כוס ואוזן לפני פריצה — עומק תקין, אוזן צרה, ווליום מתייבש",
    enabledSetups: ["cup_and_handle"],
    config: { cupAndHandle: true, volumeSpikeRatio: 1, minRsi: 40 },
    weights: {},
  },
  {
    name: "כניסה לגאפ",
    description: "מניות שנכנסות לאזור גאפ פתוח שלא נסגר — כניסה עם סטופ קצר",
    enabledSetups: ["gap_entry"],
    config: { gapUpMin: 2.5, volumeSpikeRatio: 1.2 },
    weights: {},
  },
  {
    name: "Momentum",
    description: "RSI 65-80, ווליום 2x+, מחיר צמוד לשיא ומעל כל הממוצעים",
    enabledSetups: ["momentum"],
    config: { minRsi: 65, maxRsi: 80, volumeSpikeRatio: 2, nearAthPercent: 5, near52wHighPercent: 5 },
    weights: {},
  },
];

function builtinConfig(p: (typeof BUILTIN_PROFILES)[number]): ProfileConfig {
  return {
    filters: { ...DEFAULT_SCANNER_CONFIG, ...p.config },
    // בסיס = משקלי ברירת המחדל, מעליהם הדגשי הסטאפים ואז התאמות הפרופיל
    weights: { ...DEFAULT_WEIGHTS, ...unionSetupWeights(p.enabledSetups), ...p.weights },
    enabledSetups: p.enabledSetups,
  };
}

/** נשמר לכל מופע כדי לא לכתוב ל-DB בכל בקשה. */
let builtinsEnsured = false;

/**
 * Upsert לפי שם: מעדכן/יוצר את 5 המובנים (isBuiltin=true), מוחק מובנים ישנים
 * שכבר לא ברשימה, ולא נוגע בפרופילים של המשתמש (isBuiltin=false).
 */
export async function ensureBuiltinProfiles() {
  if (builtinsEnsured) return;

  const names = BUILTIN_PROFILES.map((p) => p.name);

  for (const p of BUILTIN_PROFILES) {
    const config = JSON.stringify(builtinConfig(p));
    await prisma.scannerProfile.upsert({
      where: { name: p.name },
      update: { description: p.description, config, isBuiltin: true },
      create: {
        name: p.name,
        description: p.description,
        config,
        isBuiltin: true,
      },
    });
  }

  // מובנים ישנים (כולל אלה שסומנו ע"י המיגרציה) שכבר לא ברשימה
  await prisma.scannerProfile.deleteMany({
    where: { isBuiltin: true, name: { notIn: names } },
  });

  const hasDefault = await prisma.scannerProfile.findFirst({ where: { isDefault: true } });
  if (!hasDefault) {
    await prisma.scannerProfile.update({
      where: { name: names[0] },
      data: { isDefault: true },
    });
  }

  builtinsEnsured = true;
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
