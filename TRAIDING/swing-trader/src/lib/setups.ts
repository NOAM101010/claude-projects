/**
 * רישום מרכזי של הסטאפים.
 * כל סטאפ יודע לזהות את עצמו (detect), אילו אותות רלוונטיים לו (relevantSignals),
 * אילו משקלים להדגיש (weights) ואיך לנסח את המסקנה (verdict).
 * המודול הזה הוא הבסיס גם לסורק (scanner.ts) וגם לדף הניתוח (stock-analyzer.ts).
 */

import type { Grade, ScoringWeights, SignalKey } from "./scoring";

export type SetupId =
  | "ath_breakout"
  | "breakout_52w"
  | "resistance_breakout"
  | "cup_and_handle"
  | "gap_entry"
  | "momentum"
  | "pullback";

export const SETUP_IDS: SetupId[] = [
  "ath_breakout",
  "breakout_52w",
  "resistance_breakout",
  "cup_and_handle",
  "gap_entry",
  "momentum",
  "pullback",
];

/** ספים שמגיעים מהפרופיל (תת-קבוצה של ScannerConfig — בלי לייבא אותו, כדי למנוע מעגל). */
export type SetupThresholds = {
  gapUpMin: number;
  volumeSpikeRatio: number;
  nearAthPercent: number;
  near52wHighPercent: number;
  minRsi: number;
  maxRsi: number;
};

export const DEFAULT_SETUP_THRESHOLDS: SetupThresholds = {
  gapUpMin: 2,
  volumeSpikeRatio: 1.5,
  nearAthPercent: 5,
  near52wHighPercent: 5,
  minRsi: 50,
  maxRsi: 80,
};

/** כל מה שסטאפ צריך כדי להחליט — מטריקות + היסטוריה יומית. */
export type SetupContext = {
  symbol: string;
  price: number;
  changePercent: number | null;
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  rsi: number | null;
  atr: number | null;
  ma20: number | null;
  ma50: number | null;
  ma150: number | null;
  ma200: number | null;
  ath: number | null;
  high52w: number | null;
  low52w: number | null;
  volumeRatio: number | null;
  thresholds: SetupThresholds;
};

export type SetupDetection = {
  present: boolean;
  /** 0-1 — כמה נקי/חזק הזיהוי. 0 כשהסטאפ לא נמצא. */
  confidence: number;
  /** המחיר שמסמן את הסטאפ (רמת פריצה / שפת כוס / תחתית גאפ). */
  keyLevel: number | null;
  boxLabel: string;
};

export type SetupVerdict = { title: string; summary: string };

export type Setup = {
  id: SetupId;
  label: string;
  boxLabel: string;
  description: string;
  detect(ctx: SetupContext): SetupDetection;
  relevantSignals: SignalKey[];
  weights: Partial<ScoringWeights>;
  verdict(grade: Grade, present: boolean): SetupVerdict;
};

// ---------- עזרים ----------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const round2 = (v: number) => Math.round(v * 100) / 100;

function absent(boxLabel: string): SetupDetection {
  return { present: false, confidence: 0, keyLevel: null, boxLabel };
}

/** ציון מבנה מגמה 0-1 לפי מיקום המחיר מול הממוצעים. */
function trendScore(ctx: SetupContext): number {
  const { price, ma50, ma150 } = ctx;
  if (ma50 == null || ma150 == null) return 0.5;
  if (price > ma50 && ma50 > ma150) return 1;
  if (price > ma150) return 0.6;
  return 0.2;
}

/** ציון ווליום 0-1 — 1x → 0, 3x ומעלה → 1. */
function volumeScore(ratio: number | null): number {
  if (ratio == null) return 0.4;
  return clamp01((ratio - 1) / 2);
}

/** מרחק באחוזים מתחת לרמה (חיובי = מתחת). */
function distBelow(level: number | null, price: number): number | null {
  if (!level || !price) return null;
  return ((level - price) / level) * 100;
}

function maxOf(arr: number[]): number | null {
  return arr.length ? Math.max(...arr) : null;
}

/** בונה SetupContext עם ברירות מחדל — משמש את הסורק, דף הניתוח והבדיקות. */
export function buildSetupContext(
  input: Partial<SetupContext> & { symbol: string; price: number }
): SetupContext {
  return {
    changePercent: null,
    closes: [],
    highs: [],
    lows: [],
    opens: [],
    volumes: [],
    rsi: null,
    atr: null,
    ma20: null,
    ma50: null,
    ma150: null,
    ma200: null,
    ath: null,
    high52w: null,
    low52w: null,
    volumeRatio: null,
    thresholds: DEFAULT_SETUP_THRESHOLDS,
    ...input,
  };
}

/**
 * מחולל verdict אחיד: כותרת + סיכום לפי grade, ונוסח נפרד כשהתבנית לא נמצאה.
 */
function makeVerdict(opts: {
  label: string;
  missing: string;
  strong: string;
  ok: string;
  weak: string;
}): Setup["verdict"] {
  return (grade: Grade, present: boolean): SetupVerdict => {
    if (!present) {
      return { title: `אין ${opts.label} כרגע`, summary: opts.missing };
    }
    if (grade === "A") return { title: `${opts.label} — setup חזק לכניסה`, summary: opts.strong };
    if (grade === "B") return { title: `${opts.label} — טוב, עם הסתייגות`, summary: opts.ok };
    if (grade === "C")
      return {
        title: `${opts.label} — תבנית קיימת אך חלשה`,
        summary: `${opts.weak} התבנית זוהתה, אבל שאר האותות לא תומכים מספיק. עדיף להמתין לאישור.`,
      };
    return {
      title: `${opts.label} — תבנית קיימת, איכות נמוכה`,
      summary: `${opts.weak} האותות התומכים שליליים ברובם — הסיכוי לכישלון של התבנית גבוה.`,
    };
  };
}

// ---------- ath_breakout ----------

function detectAthBreakout(ctx: SetupContext): SetupDetection {
  const box = "ATH BREAKOUT";
  const { price, highs, ath, ma50, ma150 } = ctx;
  if (!ath || !price || highs.length < 30) return absent(box);

  const previousAth = maxOf(highs.slice(0, -3));
  const recentHigh = maxOf(highs.slice(-3));
  if (previousAth == null || recentHigh == null) return absent(box);

  const distFromAth = ((ath - price) / ath) * 100;
  const broke = recentHigh > previousAth * 1.001;
  const present = broke && distFromAth <= 2;
  if (!present) return { ...absent(box), keyLevel: round2(previousAth) };

  const proximity = clamp01(1 - Math.max(0, distFromAth) / 2);
  const overshoot = ((price - previousAth) / previousAth) * 100;
  const cleanliness = clamp01(1 - Math.max(0, overshoot - 6) / 10);
  const trend = ma50 != null && ma150 != null ? trendScore(ctx) : 0.5;

  const confidence =
    0.35 * proximity + 0.3 * volumeScore(ctx.volumeRatio) + 0.2 * trend + 0.15 * cleanliness;

  return { present: true, confidence: round2(clamp01(confidence)), keyLevel: round2(previousAth), boxLabel: box };
}

// ---------- breakout_52w ----------

function detect52wBreakout(ctx: SetupContext): SetupDetection {
  const box = "52W BREAKOUT";
  const { price, highs, high52w } = ctx;
  if (!high52w || !price || highs.length < 30) return absent(box);

  const window = highs.slice(-255, -3);
  if (window.length < 25) return absent(box);
  const previousHigh = Math.max(...window);
  const recentHigh = Math.max(...highs.slice(-3));

  const dist52w = ((high52w - price) / high52w) * 100;
  const broke = recentHigh > previousHigh * 1.001;
  const present = broke && dist52w <= 2;
  if (!present) return { ...absent(box), keyLevel: round2(previousHigh) };

  const proximity = clamp01(1 - Math.max(0, dist52w) / 2);
  const overshoot = ((price - previousHigh) / previousHigh) * 100;
  const cleanliness = clamp01(1 - Math.max(0, overshoot - 6) / 10);
  const confidence =
    0.35 * proximity + 0.3 * volumeScore(ctx.volumeRatio) + 0.2 * trendScore(ctx) + 0.15 * cleanliness;

  return { present: true, confidence: round2(clamp01(confidence)), keyLevel: round2(previousHigh), boxLabel: box };
}

// ---------- resistance_breakout ----------

function detectResistanceBreakout(ctx: SetupContext): SetupDetection {
  const box = "RESISTANCE BREAKOUT";
  const { price, highs, ath, high52w, volumeRatio } = ctx;
  if (!price || highs.length < 40) return absent(box);

  // התנגדות של 20-60 יום, ללא 3 הימים האחרונים (הם הפריצה עצמה)
  const lookback = highs.slice(-63, -3);
  if (lookback.length < 20) return absent(box);
  const level = Math.max(...lookback);
  const recentHigh = Math.max(...highs.slice(-3));

  const broke = recentHigh > level * 1.005;
  const overshoot = ((price - level) / level) * 100;
  const fresh = overshoot >= 0 && overshoot <= 5;
  const volOk = volumeRatio != null && volumeRatio >= 1.3;

  // לא ATH ולא 52W — חייב להישאר מרחק מהשיאים הגדולים
  const distAth = distBelow(ath, price);
  const dist52w = distBelow(high52w, price);
  const notMajorHigh = (distAth == null || distAth >= 3) && (dist52w == null || dist52w >= 3);

  const present = broke && fresh && volOk && notMajorHigh;
  if (!present) return { ...absent(box), keyLevel: round2(level) };

  const touches = lookback.filter((h) => h >= level * 0.98).length;
  const touchScore = clamp01(touches / 5);
  const freshness = clamp01(1 - overshoot / 5);
  const confidence =
    0.3 * volumeScore(volumeRatio) + 0.25 * freshness + 0.25 * touchScore + 0.2 * trendScore(ctx);

  return { present: true, confidence: round2(clamp01(confidence)), keyLevel: round2(level), boxLabel: box };
}

// ---------- cup_and_handle ----------

function detectCupAndHandle(ctx: SetupContext): SetupDetection {
  const box = "CUP & HANDLE";
  const { closes, volumes } = ctx;
  if (closes.length < 90 || volumes.length < 90) return absent(box);

  const window = Math.min(closes.length, 160);
  const rc = closes.slice(-window);
  const rv = volumes.slice(-window);

  const halfPoint = Math.floor(rc.length / 2);
  const leftHalf = rc.slice(0, halfPoint);
  if (!leftHalf.length) return absent(box);
  const lipPrice = Math.max(...leftHalf);
  const lipIndex = leftHalf.indexOf(lipPrice);

  const rightSide = rc.slice(lipIndex);
  const bottomPrice = Math.min(...rightSide);
  const bottomIndex = rightSide.indexOf(bottomPrice) + lipIndex;

  // עומק הכוס: 18-38%
  const cupDepth = ((lipPrice - bottomPrice) / lipPrice) * 100;
  if (cupDepth < 18 || cupDepth > 38) return { ...absent(box), keyLevel: round2(lipPrice) };

  // המחיר צריך להיות באזור האוזן — עוד לא פרץ
  const currentPrice = rc[rc.length - 1];
  const distanceFromLip = ((lipPrice - currentPrice) / lipPrice) * 100;
  if (distanceFromLip < 5 || distanceFromLip > 12) return { ...absent(box), keyLevel: round2(lipPrice) };

  // 20 הנרות האחרונים = התכנסות האוזן
  const handleWindow = rc.slice(-20);
  const handleHigh = Math.max(...handleWindow);
  const handleLow = Math.min(...handleWindow);
  const handleDepth = ((handleHigh - handleLow) / handleHigh) * 100;
  if (handleDepth < 2 || handleDepth > 10) return { ...absent(box), keyLevel: round2(lipPrice) };

  // האוזן חייבת להישאר מתחת לשפה
  if (handleHigh > lipPrice * 1.01) return { ...absent(box), keyLevel: round2(lipPrice) };

  // התכווצות ווליום באוזן
  const cupEnd = Math.min(bottomIndex + 8, rc.length);
  const cupSpan = Math.max(cupEnd - lipIndex, 1);
  const cupVolume = rv.slice(lipIndex, cupEnd).reduce((s, v) => s + v, 0) / cupSpan;
  const handleVolume = rv.slice(-20).reduce((s, v) => s + v, 0) / 20;
  if (!cupVolume || handleVolume > cupVolume * 0.9) return { ...absent(box), keyLevel: round2(lipPrice) };

  const depthScore = clamp01(1 - Math.abs(cupDepth - 27) / 14);
  const handleScore = clamp01(1 - Math.abs(handleDepth - 5.5) / 5);
  const positionScore = clamp01(1 - Math.abs(distanceFromLip - 7.5) / 5);
  const dryUpScore = clamp01((0.9 - handleVolume / cupVolume) / 0.5);
  const confidence =
    0.25 * depthScore + 0.25 * handleScore + 0.2 * positionScore + 0.2 * dryUpScore + 0.1 * trendScore(ctx);

  return { present: true, confidence: round2(clamp01(confidence)), keyLevel: round2(lipPrice), boxLabel: box };
}

// ---------- gap_entry ----------

function detectGapEntry(ctx: SetupContext): SetupDetection {
  const box = "GAP ENTRY";
  const { opens, closes, highs, lows, price } = ctx;
  const minGapPct = ctx.thresholds.gapUpMin;
  if (opens.length < 3 || closes.length < 3 || !price) return absent(box);

  let best: { level: number; gapPct: number; proximity: number } | null = null;

  const n = Math.min(opens.length, closes.length, highs.length, lows.length);
  for (let i = 1; i < n; i++) {
    const prevClose = closes[i - 1];
    const barOpen = opens[i];
    if (!prevClose || !barOpen) continue;

    // גאפ מעלה
    const gapUpPct = ((barOpen - prevClose) / prevClose) * 100;
    if (gapUpPct >= minGapPct) {
      const gapBottom = prevClose;
      const gapTop = barOpen;
      let filled = false;
      for (let j = i; j < n; j++) {
        if (lows[j] <= gapBottom * 1.001) {
          filled = true;
          break;
        }
      }
      if (!filled) {
        const distToGap = ((gapBottom - price) / gapBottom) * 100;
        const inside = price > gapBottom * 1.001 && price < gapTop * 0.99;
        const aboutToEnter = distToGap > 0 && distToGap <= 1.5;
        if (inside || aboutToEnter) {
          const proximity = inside ? 1 : clamp01(1 - distToGap / 1.5) * 0.6 + 0.4;
          if (!best || gapUpPct > best.gapPct) best = { level: gapBottom, gapPct: gapUpPct, proximity };
        }
      }
    }

    // גאפ מטה
    const gapDownPct = ((prevClose - barOpen) / prevClose) * 100;
    if (gapDownPct >= minGapPct) {
      const gapBottom = barOpen;
      const gapTop = prevClose;
      let filled = false;
      for (let j = i; j < n; j++) {
        if (highs[j] >= gapTop * 0.999) {
          filled = true;
          break;
        }
      }
      if (!filled) {
        const distToGap = ((price - gapTop) / gapTop) * 100;
        const inside = price > gapBottom * 1.01 && price < gapTop * 0.999;
        const aboutToEnter = distToGap > 0 && distToGap <= 1.5;
        if (inside || aboutToEnter) {
          const proximity = inside ? 1 : clamp01(1 - distToGap / 1.5) * 0.6 + 0.4;
          if (!best || gapDownPct > best.gapPct) best = { level: gapTop, gapPct: gapDownPct, proximity };
        }
      }
    }
  }

  if (!best) return absent(box);

  const sizeScore = clamp01(best.gapPct / 6);
  const confidence =
    0.35 * best.proximity + 0.25 * sizeScore + 0.2 * trendScore(ctx) + 0.2 * volumeScore(ctx.volumeRatio);

  return { present: true, confidence: round2(clamp01(confidence)), keyLevel: round2(best.level), boxLabel: box };
}

// ---------- momentum ----------

function detectMomentum(ctx: SetupContext): SetupDetection {
  const box = "MOMENTUM";
  const { price, rsi, volumeRatio, ma50, ma150, ma200, ath, high52w } = ctx;
  if (!price || rsi == null || volumeRatio == null) return absent(box);

  const rsiOk = rsi >= 65 && rsi <= 80;
  const volOk = volumeRatio >= 2;

  const distAth = distBelow(ath, price);
  const dist52w = distBelow(high52w, price);
  const dists = [distAth, dist52w].filter((d): d is number => d != null);
  const nearHigh = dists.length ? Math.min(...dists) : null;
  const nearOk = nearHigh != null && nearHigh <= 5;

  const aboveAll =
    (ma50 == null || price > ma50) &&
    (ma150 == null || price > ma150) &&
    (ma200 == null || price > ma200) &&
    (ma50 != null || ma150 != null);

  const keyLevel = ath ?? high52w ?? null;
  const present = rsiOk && volOk && nearOk && aboveAll;
  if (!present) return { ...absent(box), keyLevel: keyLevel != null ? round2(keyLevel) : null };

  const rsiScore = clamp01(1 - Math.abs(rsi - 72) / 8);
  const proximity = clamp01(1 - Math.max(0, nearHigh!) / 5);
  const confidence =
    0.3 * volumeScore(volumeRatio) + 0.25 * rsiScore + 0.25 * proximity + 0.2 * trendScore(ctx);

  return {
    present: true,
    confidence: round2(clamp01(confidence)),
    keyLevel: keyLevel != null ? round2(keyLevel) : null,
    boxLabel: box,
  };
}

// ---------- pullback ----------

function detectPullback(ctx: SetupContext): SetupDetection {
  const box = "PULLBACK";
  const { price, rsi, ma20, ma50, ma150 } = ctx;
  if (!price || rsi == null || ma50 == null || ma150 == null) return absent(box);

  const uptrend = price > ma150 && ma50 > ma150;
  const rsiOk = rsi >= 40 && rsi <= 55;

  // עוגן = הממוצע הקרוב ביותר שהמחיר עדיין מעליו (או ממש עליו)
  const anchor = ma20 != null && price >= ma20 * 0.99 && ma20 > ma50 ? ma20 : ma50;
  const dist = ((price - anchor) / anchor) * 100;
  const nearMa = dist >= -1 && dist <= 6;

  const present = uptrend && rsiOk && nearMa;
  if (!present) return { ...absent(box), keyLevel: round2(anchor) };

  const closeness = clamp01(1 - Math.abs(dist) / 6);
  const rsiScore = clamp01(1 - Math.abs(rsi - 48) / 8);
  const trendStrength = clamp01(((ma50 - ma150) / ma150) * 10);
  const confidence = 0.4 * closeness + 0.3 * rsiScore + 0.3 * trendStrength;

  return { present: true, confidence: round2(clamp01(confidence)), keyLevel: round2(anchor), boxLabel: box };
}

// ---------- הרישום ----------

export const SETUPS: Record<SetupId, Setup> = {
  ath_breakout: {
    id: "ath_breakout",
    label: "פריצת שיא כל הזמנים",
    boxLabel: "ATH BREAKOUT",
    description: "פריצה טרייה מעל שיא כל הזמנים — אין התנגדות מעל המחיר.",
    detect: detectAthBreakout,
    relevantSignals: [
      "breakoutAth",
      "distanceFromAth",
      "maTrend",
      "volume",
      "highVolume",
      "rsi",
      "range52w",
    ],
    weights: { breakoutAth: 24, distanceFromAth: 20, volume: 14, highVolume: 10, maTrend: 14 },
    verdict: makeVerdict({
      label: "פריצת ATH",
      missing: "המניה לא פרצה שיא כל הזמנים ב-3 ימי המסחר האחרונים, או שהיא כבר רחוקה מהשיא.",
      strong: "פריצה טרייה מעל שיא כל הזמנים עם ווליום ומבנה מגמה תומך — זה בדיוק ה-setup שאתה מחפש.",
      ok: "הפריצה קיימת אבל לא כל האותות מיושרים (ווליום/מומנטום). שווה לחכות ליום אישור.",
      weak: "פריצה מעל השיא זוהתה.",
    }),
  },

  breakout_52w: {
    id: "breakout_52w",
    label: "פריצת שיא 52 שבועות",
    boxLabel: "52W BREAKOUT",
    description: "פריצה טרייה מעל שיא 52 השבועות — יציאה מבסיס ארוך.",
    detect: detect52wBreakout,
    relevantSignals: [
      "breakout52w",
      "range52w",
      "maTrend",
      "volume",
      "highVolume",
      "rsi",
      "distanceFromAth",
    ],
    weights: { breakout52w: 22, range52w: 14, volume: 14, highVolume: 10, maTrend: 14, distanceFromAth: 10 },
    verdict: makeVerdict({
      label: "פריצת 52W",
      missing: "לא זוהתה פריצה טרייה מעל שיא 52 השבועות — המניה לא שברה את הרמה בימים האחרונים.",
      strong: "המניה יצאה מבסיס של שנה עם ווליום — המוכרים התקועים מעליה נגמרו. מבנה קלאסי להמשך.",
      ok: "הפריצה קיימת אך חסר אישור (ווליום או מבנה מגמה). עקוב אחרי ימי ההמשך.",
      weak: "פריצה מעל שיא 52 שבועות זוהתה.",
    }),
  },

  resistance_breakout: {
    id: "resistance_breakout",
    label: "פריצת התנגדות",
    boxLabel: "RESISTANCE BREAKOUT",
    description: "פריצת שיא של 20-60 יום עם ווליום — לא ATH ולא 52W.",
    detect: detectResistanceBreakout,
    relevantSignals: ["resistanceBreakout", "volume", "highVolume", "maTrend", "rsi", "todayMove"],
    weights: { resistanceBreakout: 22, volume: 18, highVolume: 12, maTrend: 14, todayMove: 10, distanceFromAth: 6 },
    verdict: makeVerdict({
      label: "פריצת התנגדות",
      missing: "אין פריצה טרייה של שיא 20-60 יום עם ווליום, או שהמניה כבר באזור השיאים הגדולים.",
      strong: "פריצת התנגדות נקייה בווליום גבוה — המניה משתחררת מהטווח והמשך המהלך סביר.",
      ok: "הפריצה קיימת אבל הווליום/המבנה לא אידיאליים. שווה לחכות לסגירה מעל הרמה.",
      weak: "פריצת רמת התנגדות זוהתה.",
    }),
  },

  cup_and_handle: {
    id: "cup_and_handle",
    label: "כוס ואוזן (Cup & Handle)",
    boxLabel: "CUP & HANDLE",
    description: "ירידה, התאוששות ואוזן בהתכווצות ווליום לפני פריצה.",
    detect: detectCupAndHandle,
    relevantSignals: ["cupHandle", "maTrend", "distanceFromAth", "volume", "rsi", "range52w"],
    weights: { cupHandle: 26, maTrend: 18, distanceFromAth: 12, volume: 8, rsi: 10, range52w: 8 },
    verdict: makeVerdict({
      label: "כוס ואוזן",
      missing: "לא זוהתה תבנית כוס-ואוזן תקינה (עומק כוס, מיקום האוזן או התכווצות הווליום לא מתאימים).",
      strong: "תבנית כוס-ואוזן נקייה: עומק תקין, אוזן צרה וווליום מתייבש — מוכנה לפריצה מעל השפה.",
      ok: "התבנית קיימת אך לא מושלמת. הכניסה היא רק בפריצת השפה בווליום.",
      weak: "תבנית כוס-ואוזן זוהתה.",
    }),
  },

  gap_entry: {
    id: "gap_entry",
    label: "כניסה לגאפ",
    boxLabel: "GAP ENTRY",
    description: "המחיר נכנס לאזור גאפ שלא נסגר — כניסה עם סטופ קצר.",
    detect: detectGapEntry,
    relevantSignals: ["gapEntry", "gapUp", "todayMove", "volume", "maTrend", "rsi"],
    weights: { gapEntry: 24, gapUp: 14, todayMove: 14, volume: 12, maTrend: 10 },
    verdict: makeVerdict({
      label: "כניסה לגאפ",
      missing: "אין גאפ פתוח שהמחיר נכנס אליו או מתקרב אליו כרגע.",
      strong: "המחיר נכנס לאזור גאפ פתוח משמעותי — אזור תגובה חד עם סטופ קצר מתחת לגאפ.",
      ok: "הגאפ קיים אבל התנאים סביבו בינוניים. שים סטופ הדוק אם נכנס.",
      weak: "כניסה לאזור גאפ זוהתה.",
    }),
  },

  momentum: {
    id: "momentum",
    label: "מומנטום",
    boxLabel: "MOMENTUM",
    description: "RSI 65-80, קרוב לשיא, ווליום 2x ומעל כל הממוצעים.",
    detect: detectMomentum,
    relevantSignals: [
      "momentum",
      "rsi",
      "volume",
      "highVolume",
      "todayMove",
      "maTrend",
      "distanceFromAth",
      "range52w",
    ],
    weights: { momentum: 22, rsi: 18, volume: 18, highVolume: 12, todayMove: 12, maTrend: 12 },
    verdict: makeVerdict({
      label: "מומנטום",
      missing: "המניה לא עומדת בתנאי המומנטום (RSI 65-80, ווליום 2x, קרבה לשיא ומעל כל הממוצעים).",
      strong: "מומנטום מלא: RSI חזק, ווליום כפול, מחיר צמוד לשיא ומעל כל הממוצעים — מובילת שוק.",
      ok: "המומנטום קיים אבל חלק מהאותות פחות חדים. היזהר מרדיפה אחרי מהלך מתוח.",
      weak: "תנאי מומנטום זוהו.",
    }),
  },

  pullback: {
    id: "pullback",
    label: "תיקון למגמה (Pullback)",
    boxLabel: "PULLBACK",
    description: "מגמת עלייה, RSI 40-55 ומחיר קרוב לממוצע מלמעלה.",
    detect: detectPullback,
    relevantSignals: ["pullback", "maTrend", "rsi", "distanceFromAth", "range52w"],
    weights: { pullback: 22, maTrend: 26, rsi: 8, distanceFromAth: 12, range52w: 10, todayMove: 0, volume: 4 },
    verdict: makeVerdict({
      label: "Pullback",
      missing: "המניה לא בתיקון בריא למגמה (צריך מעל MA150, MA50>MA150, RSI 40-55 ומחיר צמוד לממוצע).",
      strong: "תיקון בריא בתוך מגמת עלייה — המחיר נשען על הממוצע וה-RSI התאפס. כניסה עם סטופ מתחת לממוצע.",
      ok: "התיקון קיים אבל המבנה לא מושלם. חכה לנר היפוך על הממוצע.",
      weak: "תיקון למגמה זוהה.",
    }),
  },
};

export const SETUP_LIST: Setup[] = SETUP_IDS.map((id) => SETUPS[id]);

export const SETUP_LABELS: Record<string, string> = {
  // סטאפים נוכחיים
  ath_breakout: "פריצת ATH",
  breakout_52w: "פריצת 52W",
  resistance_breakout: "פריצת התנגדות",
  cup_and_handle: "Cup & Handle",
  gap_entry: "נכנס לגאפ",
  momentum: "מומנטום",
  pullback: "Pullback",
  // מזהים היסטוריים ששמורים בתוצאות ישנות ב-DB
  breakout_ath: "פריצת ATH",
  near_ath: "קרוב ל־ATH",
  near_52w: "קרוב ל־52W",
  gap_up: "Gap Up",
  high_volume: "ווליום גבוה",
};

export function isSetupId(v: unknown): v is SetupId {
  return typeof v === "string" && (SETUP_IDS as string[]).includes(v);
}

/** איחוד ה-relevantSignals של קבוצת סטאפים. */
export function unionRelevantSignals(ids: SetupId[]): SignalKey[] {
  const set = new Set<SignalKey>();
  for (const id of ids) for (const k of SETUPS[id].relevantSignals) set.add(k);
  return [...set];
}

/** איחוד המשקלים של קבוצת סטאפים — כשיש התנגשות, המשקל הגבוה מנצח. */
export function unionSetupWeights(ids: SetupId[]): Partial<ScoringWeights> {
  const out: Partial<ScoringWeights> = {};
  for (const id of ids) {
    for (const [k, v] of Object.entries(SETUPS[id].weights) as [SignalKey, number][]) {
      const cur = out[k];
      out[k] = cur == null ? v : Math.max(cur, v);
    }
  }
  return out;
}
