/**
 * מנוע ניקוד יחיד — משמש גם את דף הניתוח (/api/analyze) וגם את הסורק.
 * כל אות מקבל משקל מוגדר-משתמש (ScoringWeights). משקל 0 = האות לא נספר ולא מוצג.
 */

export type SignalTone = "bullish" | "bearish" | "neutral";

export type SignalKey =
  // אותות ניתוח (מחושבים מנתוני שוק גולמיים)
  | "distanceFromAth"
  | "rsi"
  | "maTrend"
  | "volume"
  | "todayMove"
  | "range52w"
  // אותות setup (מגיעים מזיהוי התבניות של הסורק)
  | "breakoutAth"
  | "breakout52w"
  | "nearAth"
  | "near52w"
  | "gapUp"
  | "gapEntry"
  | "cupHandle"
  | "highVolume"
  | "resistanceBreakout"
  | "momentum"
  | "pullback";

export type ScoringWeights = Record<SignalKey, number>;

export type AnalysisSignal = {
  key: SignalKey;
  label: string;
  value: string;
  tone: SignalTone;
  weight: number; // תרומה בפועל לניקוד
  explanation: string;
};

export type ScoringMetrics = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  rsi: number | null;
  ma50: number | null;
  ma150: number | null;
  ath: number | null;
  high52w: number | null;
  low52w: number | null;
  volumeRatio: number | null;
  /** setups שזוהו ע"י הסורק. בדף הניתוח נשאר ריק. */
  matchedSetups?: string[];
};

export type Grade = "A" | "B" | "C" | "D" | "F";

/**
 * "analysis" — דף הניתוח: הציון הוא הסכום הגולמי clamped ל-0-100, grade על 78/64/50/36.
 * "scanner"  — הסורק: הציון הגולמי נשאר בסקאלה פתוחה (~0-190) כדי לא להידבק לתקרה,
 *              ה-grade נקבע על הסקאלה הפתוחה בעקומה סלקטיבית, והציון המוצג מנורמל ל-0-100.
 */
export type ScoreMode = "analysis" | "scanner";

export type ScoreResult = {
  score: number; // 0-100
  grade: Grade;
  signals: AnalysisSignal[];
  verdict: string;
  summary: string;
};

/** נקודת הפתיחה של הניקוד לפני שאותות משפיעים. */
export const BASE_SCORE = 50;

/**
 * משקלי ברירת המחדל.
 * אותות הניתוח = המשקלים ההיסטוריים של stock-analyzer.ts (שומר התנהגות זהה בדף הניתוח).
 * אותות ה-setup מכוילים לסקאלת 0-100 של אותו מנוע.
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  distanceFromAth: 18,
  rsi: 12,
  maTrend: 15,
  volume: 10,
  todayMove: 8,
  range52w: 8,

  breakoutAth: 20,
  breakout52w: 14,
  nearAth: 8,
  near52w: 6,
  gapUp: 6,
  gapEntry: 10,
  cupHandle: 12,
  highVolume: 6,
  resistanceBreakout: 12,
  momentum: 14,
  pullback: 12,
};

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  distanceFromAth: "מרחק משיא כל הזמנים",
  rsi: "RSI (מומנטום)",
  maTrend: "מבנה מגמה (ממוצעים נעים)",
  volume: "נפח מסחר",
  todayMove: "תנועה היום",
  range52w: "מיקום בטווח 52 שבועות",
  breakoutAth: "פריצת שיא כל הזמנים",
  breakout52w: "פריצת שיא 52 שבועות",
  nearAth: "קרוב לשיא כל הזמנים",
  near52w: "קרוב לשיא 52 שבועות",
  gapUp: "Gap Up בפתיחה",
  gapEntry: "כניסה לאזור גאפ",
  cupHandle: "תבנית Cup & Handle",
  highVolume: "ווליום חריג",
  resistanceBreakout: "פריצת התנגדות (20-60 יום)",
  momentum: "מומנטום (RSI + ווליום + שיא)",
  pullback: "תיקון למגמה (Pullback)",
};

/** סדר התצוגה בעורך המשקלים בהגדרות. */
export const SIGNAL_KEYS: SignalKey[] = [
  "distanceFromAth",
  "rsi",
  "maTrend",
  "volume",
  "todayMove",
  "range52w",
  "breakoutAth",
  "breakout52w",
  "nearAth",
  "near52w",
  "gapUp",
  "gapEntry",
  "cupHandle",
  "highVolume",
  "resistanceBreakout",
  "momentum",
  "pullback",
];

/** מיפוי מזהי setup של הסורק למפתחות משקל (כולל מזהים היסטוריים). */
const SETUP_TO_KEY: Record<string, SignalKey> = {
  ath_breakout: "breakoutAth",
  breakout_52w: "breakout52w",
  resistance_breakout: "resistanceBreakout",
  cup_and_handle: "cupHandle",
  gap_entry: "gapEntry",
  momentum: "momentum",
  pullback: "pullback",
  // מזהים ישנים ששמורים בתוצאות סריקה קודמות
  breakout_ath: "breakoutAth",
  near_ath: "nearAth",
  near_52w: "near52w",
  gap_up: "gapUp",
  high_volume: "highVolume",
};

const SETUP_EXPLANATIONS: Record<SignalKey, string> = {
  breakoutAth:
    "פריצה טרייה (3 ימי מסחר אחרונים) מעל שיא כל הזמנים — אין התנגדות מעל המחיר. ה-setup הקלאסי לכניסה.",
  breakout52w:
    "פריצה טרייה מעל שיא 52 השבועות — המניה יוצאת מבסיס ארוך, מוכרים תקועים מעליה נגמרו.",
  nearAth:
    "המניה מתקרבת לשיא כל הזמנים בטווח שהוגדר בפרופיל — מועמדת לפריצה, שווה מעקב.",
  near52w:
    "המניה מתקרבת לשיא 52 השבועות — מתקרבת לאזור החלטה, לא פרצה עדיין.",
  gapUp:
    "פתיחה בגאפ מעלה מעל הסף שהוגדר — טריגר קלאסי של Gap & Go ביום המסחר.",
  gapEntry:
    "המחיר נכנס לאזור גאפ שלא נסגר — אזור תמיכה/התנגדות חד ותרחיש כניסה עם סטופ קצר.",
  cupHandle:
    "זוהתה תבנית כוס-ואוזן: ירידה, התאוששות ואוזן בהתכווצות ווליום לפני פריצה.",
  highVolume:
    "נפח המסחר חורג משמעותית מהממוצע — עניין מוסדי שמאשש את המהלך.",
  resistanceBreakout:
    "פריצה טרייה של שיא 20-60 יום בווליום — המניה משתחררת מטווח דשדוש, עדיין מתחת לשיאים הגדולים.",
  momentum:
    "כל תנאי המומנטום התקיימו יחד: RSI 65-80, ווליום כפול מהממוצע, מחיר צמוד לשיא ומעל כל הממוצעים.",
  pullback:
    "תיקון בריא בתוך מגמת עלייה — המחיר נשען על ממוצע נע מלמעלה וה-RSI התקרר לאזור 40-55.",
  // אותות ניתוח — לא בשימוש כאן
  distanceFromAth: "",
  rsi: "",
  maTrend: "",
  volume: "",
  todayMove: "",
  range52w: "",
};

function normalizeWeights(w?: Partial<ScoringWeights> | null): ScoringWeights {
  if (!w) return DEFAULT_WEIGHTS;
  const out = { ...DEFAULT_WEIGHTS };
  for (const k of SIGNAL_KEYS) {
    const v = w[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function scoreToGrade(score: number): Grade {
  return score >= 78 ? "A" : score >= 64 ? "B" : score >= 50 ? "C" : score >= 36 ? "D" : "F";
}

/**
 * נקודות עיגון של הסורק על הציון הגולמי הלא-חסום, לצורך הנרמול לתצוגה.
 * מכוילות על סריקה אמיתית של היקום המלא כך שההתפלגות תהיה בערך
 * A ~7%, B ~15%, C ~27%, D ~27%, F ~24% — A נשאר "מעטים ובאמת חזקים".
 */
export const SCANNER_GRADE_CUTOFFS = { A: 106, B: 95, C: 70, D: 40 } as const;

/**
 * ממפה ציון גולמי פתוח לסקאלת 0-100 לתצוגה, כך שספי הסורק נופלים בדיוק
 * על ספי ה-grade הרגילים (78/64/50/36). ה-grade עצמו נגזר מהתוצאה כאן
 * דרך scoreToGrade — מספר מוצג ו-grade תמיד מסכימים.
 */
export function normalizeScannerScore(rawScore: number): number {
  const c = SCANNER_GRADE_CUTOFFS;
  const anchors: [number, number][] = [
    [0, 0],
    [c.D, 36],
    [c.C, 50],
    [c.B, 64],
    [c.A, 78],
    [190, 100],
  ];
  if (rawScore <= 0) return 0;
  for (let i = 1; i < anchors.length; i++) {
    const [rawHi, outHi] = anchors[i];
    if (rawScore < rawHi) {
      const [rawLo, outLo] = anchors[i - 1];
      return Math.round(outLo + ((rawScore - rawLo) / (rawHi - rawLo)) * (outHi - outLo));
    }
  }
  return 100;
}

/**
 * @param relevantSignals אם מוגדר — רק האותות האלה נספרים ומוצגים.
 *   משמש את הסורק כדי לנקד כל מניה לפי הסטאפים שנמצאו בה בלבד.
 *   בלי הפרמטר (מצב הניתוח הקיים) — כל האותות נספרים כרגיל.
 */
export function scoreSignals(
  metrics: ScoringMetrics,
  rawWeights?: Partial<ScoringWeights> | null,
  mode: ScoreMode = "analysis",
  relevantSignals?: SignalKey[] | null
): ScoreResult {
  const weights = normalizeWeights(rawWeights);
  const allowed = relevantSignals?.length ? new Set(relevantSignals) : null;
  const signals: AnalysisSignal[] = [];
  let score = BASE_SCORE;

  /** factor = חלק יחסי מהמשקל שמוגדר למפתח (חיובי/שלילי/0). */
  function add(
    key: SignalKey,
    factor: number,
    value: string,
    tone: SignalTone,
    explanation: string,
    label = SIGNAL_LABELS[key]
  ) {
    if (allowed && !allowed.has(key)) return; // האות לא רלוונטי לסטאפ הנוכחי
    const base = weights[key];
    if (!base) return; // משקל 0 → האות לא נספר ולא מוצג
    const weight = Math.round(base * factor);
    signals.push({ key, label, value, tone, weight, explanation });
    score += weight;
  }

  const { symbol, price, changePercent, rsi, ma50, ma150, ath, high52w, low52w, volumeRatio } =
    metrics;

  // ---- setups מהסורק ----
  for (const setup of metrics.matchedSetups ?? []) {
    const key = SETUP_TO_KEY[setup];
    if (!key) continue;
    add(key, 1, "זוהה", "bullish", SETUP_EXPLANATIONS[key]);
  }

  // ---- 1. מרחק משיא כל הזמנים ----
  if (ath && price) {
    const distAth = ((ath - price) / ath) * 100;
    if (distAth <= 0.5) {
      add(
        "distanceFromAth",
        1,
        distAth <= 0 ? "בשיא!" : `${distAth.toFixed(1)}% מתחת`,
        "bullish",
        "המניה פורצת או ממש על שיא כל הזמנים — אזור כניסה קלאסי לפריצה. אין התנגדות מעליה.",
        "קרבה לשיא כל הזמנים"
      );
    } else if (distAth <= 5) {
      add(
        "distanceFromAth",
        10 / 18,
        `${distAth.toFixed(1)}% מתחת`,
        "bullish",
        "המניה קרובה מאוד לשיא כל הזמנים — מתקרבת לאזור פריצה. שווה לעקוב לקראת כניסה.",
        "קרבה לשיא כל הזמנים"
      );
    } else if (distAth <= 15) {
      add(
        "distanceFromAth",
        0,
        `${distAth.toFixed(1)}% מתחת`,
        "neutral",
        "המניה במרחק בינוני מהשיא. לא פריצה, אבל גם לא רחוקה — צריך עוד תנופה."
      );
    } else {
      add(
        "distanceFromAth",
        -12 / 18,
        `${distAth.toFixed(1)}% מתחת`,
        "bearish",
        "המניה רחוקה מאוד מהשיא. זה לא setup של פריצה — היא צריכה לעלות הרבה כדי להגיע לאזור מעניין."
      );
    }
  }

  // ---- 2. RSI ----
  if (rsi != null) {
    const r = rsi.toFixed(0);
    if (rsi >= 50 && rsi <= 70) {
      add("rsi", 1, r, "bullish", `RSI של ${r} מצביע על מומנטום בריא וחיובי — המניה חזקה אבל עדיין לא בקנייתר-יתר. אזור אידיאלי.`);
    } else if (rsi > 70 && rsi <= 80) {
      add("rsi", 3 / 12, r, "neutral", `RSI של ${r} — מומנטום חזק מאוד אך מתקרב לקנייתר-יתר. אפשרי, אבל היזהר מתיקון קצר.`);
    } else if (rsi > 80) {
      add("rsi", -8 / 12, r, "bearish", `RSI של ${r} — קנייתר-יתר קיצוני. סיכון גבוה לתיקון או pullback בטווח הקצר.`);
    } else if (rsi >= 40 && rsi < 50) {
      add("rsi", 0, r, "neutral", `RSI של ${r} — מומנטום ניטרלי. המניה לא בכיוון ברור כרגע.`);
    } else {
      add("rsi", -10 / 12, r, "bearish", `RSI של ${r} — מומנטום חלש/שלילי. המניה במגמת ירידה, לא מתאים ל-long של פריצה.`);
    }
  }

  // ---- 3. מבנה מגמה מול ממוצעים נעים ----
  if (ma50 && ma150 && price) {
    if (price > ma50 && ma50 > ma150) {
      add("maTrend", 1, "עולה", "bullish", "המחיר מעל ממוצע 50, וממוצע 50 מעל 150 — מבנה מגמה עולה קלאסי (stage 2). זה הבסיס של כל טרייד פריצה טוב.");
    } else if (price > ma150) {
      add("maTrend", 5 / 15, "מעל 150", "neutral", "המחיר מעל ממוצע 150 (מגמה ארוכת-טווח חיובית) אבל המבנה לא מסודר לגמרי. סביר, לא מושלם.");
    } else {
      add("maTrend", -1, "מתחת לממוצעים", "bearish", "המחיר מתחת לממוצעים הנעים — מגמה יורדת או צידית. זה לא setup של פריצה, אלא סיכון.");
    }
  }

  // ---- 4. נפח מסחר ----
  if (volumeRatio != null) {
    const v = `${volumeRatio.toFixed(1)}× מהממוצע`;
    if (volumeRatio >= 1.5) {
      add("volume", 1, v, "bullish", `נפח של ${volumeRatio.toFixed(1)} פעמים מהממוצע — עניין מוסדי חזק. נפח גבוה מאשש מהלכים ופריצות.`);
    } else if (volumeRatio >= 1) {
      add("volume", 2 / 10, v, "neutral", "נפח סביב הממוצע — לא חלש אבל גם לא מאשש מהלך חזק במיוחד.");
    } else {
      add("volume", -5 / 10, v, "bearish", "נפח מתחת לממוצע — חוסר עניין. פריצה בנפח נמוך נוטה להיכשל.");
    }
  }

  // ---- 5. תנועה היום / גאפ ----
  if (changePercent != null) {
    const signed = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`;
    if (changePercent >= 2 && changePercent <= 8) {
      add("todayMove", 1, signed, "bullish", `עלייה של ${changePercent.toFixed(1)}% היום — תנופה חיובית, אולי gap-and-go. מהלך בריא לכניסה.`);
    } else if (changePercent > 8) {
      add("todayMove", 0, signed, "neutral", `זינוק של ${changePercent.toFixed(1)}% — חזק מאוד, אבל אולי מאוחר להיכנס. סיכון לרדיפה אחרי המהלך.`);
    } else if (changePercent < -3) {
      add("todayMove", -6 / 8, signed, "bearish", `ירידה של ${Math.abs(changePercent).toFixed(1)}% היום — לחץ מכירה. לא רגע טוב לכניסת long.`);
    } else {
      add("todayMove", 0, signed, "neutral", "תנועה שקטה היום — אין טריגר מיידי לכניסה, אבל גם אין לחץ מכירה.");
    }
  }

  // ---- 6. מיקום בטווח 52 שבועות ----
  if (high52w && low52w && price && high52w > low52w) {
    const rangePos = ((price - low52w) / (high52w - low52w)) * 100;
    const v = `${rangePos.toFixed(0)}% מהטווח`;
    if (rangePos >= 80) {
      add("range52w", 1, v, "bullish", `המניה ב-${rangePos.toFixed(0)}% העליונים של טווח השנה — קרובה לחלק החזק. מובילת שוק, לא מפגר.`);
    } else if (rangePos >= 50) {
      add("range52w", 0, v, "neutral", `המניה באמצע טווח השנה (${rangePos.toFixed(0)}%). לא חלשה אבל לא מובילה.`);
    } else {
      add("range52w", -1, v, "bearish", `המניה ב-${rangePos.toFixed(0)}% התחתונים של טווח השנה — חלשה יחסית. מפגרת אחרי השוק.`);
    }
  }

  const rawScore = Math.max(0, Math.round(score));
  let grade: Grade;
  if (mode === "scanner") {
    // גוזרים grade מהציון המנורמל המוצג עם אותם ספים של מצב analysis —
    // כך score ו-grade לא יכולים לסתור זה את זה בהגדרה.
    score = normalizeScannerScore(rawScore);
    grade = scoreToGrade(score);
  } else {
    score = Math.min(100, rawScore);
    grade = scoreToGrade(score);
  }

  const bullCount = signals.filter((s) => s.tone === "bullish").length;
  const bearCount = signals.filter((s) => s.tone === "bearish").length;

  let verdict: string;
  let summary: string;
  if (grade === "A") {
    verdict = "setup חזק לכניסה";
    summary = `${symbol} מציגה ${bullCount} סימנים חיוביים בולטים. המבנה תומך בכניסת long של פריצה — עומדת בקריטריונים המרכזיים שלך.`;
  } else if (grade === "B") {
    verdict = "setup טוב, עם הסתייגות";
    summary = `${symbol} נראית טוב (${bullCount} חיוביים מול ${bearCount} שליליים), אבל לא מושלמת. שווה לעקוב ולחכות לאישור נוסף (נפח/פריצה) לפני כניסה.`;
  } else if (grade === "C") {
    verdict = "בינונית — לא עכשיו";
    summary = `${symbol} מעורבת: ${bullCount} חיוביים מול ${bearCount} שליליים. אין כאן setup ברור. עדיף להמתין שהתמונה תתבהר.`;
  } else if (grade === "D") {
    verdict = "חלשה — עדיף להימנע";
    summary = `${symbol} מציגה יותר סימנים שליליים (${bearCount}) מחיוביים (${bullCount}). לא מתאים לכניסת long כרגע.`;
  } else {
    verdict = "לא מתאים לכניסה";
    summary = `${symbol} חלשה מאוד — ${bearCount} סימנים שליליים. המבנה נגד כניסת long. עדיף להתרחק.`;
  }

  return { score, grade, signals, verdict, summary };
}
