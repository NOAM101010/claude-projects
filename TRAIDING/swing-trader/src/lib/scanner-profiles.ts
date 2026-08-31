import { prisma } from "./prisma";
import { DEFAULT_SCANNER_CONFIG, SCANNER_UNIVERSE_UNIQUE, type ScannerConfig } from "./scanner-config";

export const BUILTIN_PROFILES: {
  name: string;
  description: string;
  config: Partial<ScannerConfig>;
}[] = [
  {
    name: "Breakouts (ברירת מחדל)",
    description: "Large Cap פריצות ATH / 52W עם ווליום — הסטייל האישי שלך",
    config: {},
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
  },
  {
    name: "Gap Runners",
    description: "רק Gap Up מעל 3% עם ווליום גבוה — למסחר בפתיחה",
    config: {
      gapUpMin: 3,
      volumeSpikeRatio: 2,
    },
  },
];

export async function ensureBuiltinProfiles() {
  const existing = await prisma.scannerProfile.findMany();
  if (existing.length > 0) return;
  for (const [i, p] of BUILTIN_PROFILES.entries()) {
    const merged = { ...DEFAULT_SCANNER_CONFIG, ...p.config };
    await prisma.scannerProfile.create({
      data: {
        name: p.name,
        description: p.description,
        config: JSON.stringify(merged),
        isDefault: i === 0,
      },
    });
  }
}

export function mergeConfig(raw: string | null | undefined): ScannerConfig {
  if (!raw) return DEFAULT_SCANNER_CONFIG;
  try {
    return { ...DEFAULT_SCANNER_CONFIG, ...(JSON.parse(raw) as Partial<ScannerConfig>) };
  } catch {
    return DEFAULT_SCANNER_CONFIG;
  }
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
