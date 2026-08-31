import { yf } from "@/lib/yf";

export type SignalTone = "bullish" | "bearish" | "neutral";

export type AnalysisSignal = {
  label: string;
  value: string;
  tone: SignalTone;
  weight: number; // contribution to score
  explanation: string;
};

export type StockAnalysis = {
  symbol: string;
  name: string | null;
  price: number | null;
  changePercent: number | null;
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  verdict: string;
  summary: string;
  signals: AnalysisSignal[];
  keyLevels: {
    ath: number | null;
    high52w: number | null;
    low52w: number | null;
    ma50: number | null;
    ma150: number | null;
    ma200: number | null;
    suggestedStop: number | null;
  };
};

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  const window = trs.slice(-period);
  return window.reduce((s, v) => s + v, 0) / window.length;
}

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((s, v) => s + v, 0) / period;
}

export async function analyzeStock(rawSymbol: string): Promise<StockAnalysis | { error: string }> {
  const symbol = rawSymbol.toUpperCase().trim();
  if (!symbol) return { error: "לא הוזן סימבול" };

  let quote: any;
  let hist: any[] = [];
  try {
    quote = await yf.quote(symbol);
  } catch {
    return { error: `לא נמצאה מניה בשם "${symbol}". בדוק את הסימבול.` };
  }
  if (!quote || quote.regularMarketPrice == null) {
    return { error: `לא נמצאה מניה בשם "${symbol}". בדוק את הסימבול.` };
  }
  try {
    const chart = await yf.chart(symbol, {
      period1: new Date(Date.now() - 400 * 86400000).toISOString().split("T")[0],
      interval: "1d",
    });
    hist = (chart as any).quotes ?? [];
  } catch {
    hist = [];
  }

  const price = quote.regularMarketPrice as number;
  const changePercent = (quote.regularMarketChangePercent as number) ?? null;
  const name = (quote.shortName as string) ?? (quote.longName as string) ?? null;
  const volume = (quote.regularMarketVolume as number) ?? null;
  const avgVolume =
    (quote.averageDailyVolume10Day as number) ??
    (quote.averageDailyVolume3Month as number) ?? null;
  const high52w = (quote.fiftyTwoWeekHigh as number) ?? null;
  const low52w = (quote.fiftyTwoWeekLow as number) ?? null;

  const closes = hist.map((h) => h.close as number).filter(Number.isFinite);
  const highs = hist.map((h) => h.high as number).filter(Number.isFinite);
  const lows = hist.map((h) => h.low as number).filter(Number.isFinite);

  const ath = highs.length ? Math.max(...highs) : high52w;
  const rsi = calcRSI(closes);
  const atr = calcATR(highs, lows, closes);
  const ma50 = calcMA(closes, 50);
  const ma150 = calcMA(closes, 150);
  const ma200 = calcMA(closes, 200);
  const volumeRatio = volume && avgVolume ? volume / avgVolume : null;

  const signals: AnalysisSignal[] = [];
  let score = 50; // start neutral

  // 1. Distance from ATH
  if (ath && price) {
    const distAth = ((ath - price) / ath) * 100;
    if (distAth <= 0.5) {
      signals.push({ label: "קרבה לשיא כל הזמנים", value: `${distAth <= 0 ? "בשיא!" : distAth.toFixed(1) + "% מתחת"}`, tone: "bullish", weight: 18, explanation: "המניה פורצת או ממש על שיא כל הזמנים — אזור כניסה קלאסי לפריצה. אין התנגדות מעליה." });
      score += 18;
    } else if (distAth <= 5) {
      signals.push({ label: "קרבה לשיא כל הזמנים", value: `${distAth.toFixed(1)}% מתחת`, tone: "bullish", weight: 10, explanation: "המניה קרובה מאוד לשיא כל הזמנים — מתקרבת לאזור פריצה. שווה לעקוב לקראת כניסה." });
      score += 10;
    } else if (distAth <= 15) {
      signals.push({ label: "מרחק משיא כל הזמנים", value: `${distAth.toFixed(1)}% מתחת`, tone: "neutral", weight: 0, explanation: "המניה במרחק בינוני מהשיא. לא פריצה, אבל גם לא רחוקה — צריך עוד תנופה." });
    } else {
      signals.push({ label: "מרחק משיא כל הזמנים", value: `${distAth.toFixed(1)}% מתחת`, tone: "bearish", weight: -12, explanation: "המניה רחוקה מאוד מהשיא. זה לא setup של פריצה — היא צריכה לעלות הרבה כדי להגיע לאזור מעניין." });
      score -= 12;
    }
  }

  // 2. RSI
  if (rsi != null) {
    if (rsi >= 50 && rsi <= 70) {
      signals.push({ label: "RSI (מומנטום)", value: rsi.toFixed(0), tone: "bullish", weight: 12, explanation: `RSI של ${rsi.toFixed(0)} מצביע על מומנטום בריא וחיובי — המניה חזקה אבל עדיין לא בקנייתר-יתר. אזור אידיאלי.` });
      score += 12;
    } else if (rsi > 70 && rsi <= 80) {
      signals.push({ label: "RSI (מומנטום)", value: rsi.toFixed(0), tone: "neutral", weight: 3, explanation: `RSI של ${rsi.toFixed(0)} — מומנטום חזק מאוד אך מתקרב לקנייתר-יתר. אפשרי, אבל היזהר מתיקון קצר.` });
      score += 3;
    } else if (rsi > 80) {
      signals.push({ label: "RSI (מומנטום)", value: rsi.toFixed(0), tone: "bearish", weight: -8, explanation: `RSI של ${rsi.toFixed(0)} — קנייתר-יתר קיצוני. סיכון גבוה לתיקון או pullback בטווח הקצר.` });
      score -= 8;
    } else if (rsi >= 40 && rsi < 50) {
      signals.push({ label: "RSI (מומנטום)", value: rsi.toFixed(0), tone: "neutral", weight: 0, explanation: `RSI של ${rsi.toFixed(0)} — מומנטום ניטרלי. המניה לא בכיוון ברור כרגע.` });
    } else {
      signals.push({ label: "RSI (מומנטום)", value: rsi.toFixed(0), tone: "bearish", weight: -10, explanation: `RSI של ${rsi.toFixed(0)} — מומנטום חלש/שלילי. המניה במגמת ירידה, לא מתאים ל-long של פריצה.` });
      score -= 10;
    }
  }

  // 3. Trend vs moving averages
  if (ma50 && ma150 && price) {
    const aboveAll = price > ma50 && ma50 > ma150;
    if (aboveAll) {
      signals.push({ label: "מבנה מגמה (ממוצעים נעים)", value: "עולה", tone: "bullish", weight: 15, explanation: "המחיר מעל ממוצע 50, וממוצע 50 מעל 150 — מבנה מגמה עולה קלאסי (stage 2). זה הבסיס של כל טרייד פריצה טוב." });
      score += 15;
    } else if (price > ma150) {
      signals.push({ label: "מבנה מגמה (ממוצעים נעים)", value: "מעל 150", tone: "neutral", weight: 5, explanation: "המחיר מעל ממוצע 150 (מגמה ארוכת-טווח חיובית) אבל המבנה לא מסודר לגמרי. סביר, לא מושלם." });
      score += 5;
    } else {
      signals.push({ label: "מבנה מגמה (ממוצעים נעים)", value: "מתחת לממוצעים", tone: "bearish", weight: -15, explanation: "המחיר מתחת לממוצעים הנעים — מגמה יורדת או צידית. זה לא setup של פריצה, אלא סיכון." });
      score -= 15;
    }
  }

  // 4. Volume
  if (volumeRatio != null) {
    if (volumeRatio >= 1.5) {
      signals.push({ label: "נפח מסחר", value: `${volumeRatio.toFixed(1)}× מהממוצע`, tone: "bullish", weight: 10, explanation: `נפח של ${volumeRatio.toFixed(1)} פעמים מהממוצע — עניין מוסדי חזק. נפח גבוה מאשש מהלכים ופריצות.` });
      score += 10;
    } else if (volumeRatio >= 1) {
      signals.push({ label: "נפח מסחר", value: `${volumeRatio.toFixed(1)}× מהממוצע`, tone: "neutral", weight: 2, explanation: "נפח סביב הממוצע — לא חלש אבל גם לא מאשש מהלך חזק במיוחד." });
      score += 2;
    } else {
      signals.push({ label: "נפח מסחר", value: `${volumeRatio.toFixed(1)}× מהממוצע`, tone: "bearish", weight: -5, explanation: "נפח מתחת לממוצע — חוסר עניין. פריצה בנפח נמוך נוטה להיכשל." });
      score -= 5;
    }
  }

  // 5. Today's move / gap
  if (changePercent != null) {
    if (changePercent >= 2 && changePercent <= 8) {
      signals.push({ label: "תנועה היום", value: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`, tone: "bullish", weight: 8, explanation: `עלייה של ${changePercent.toFixed(1)}% היום — תנופה חיובית, אולי gap-and-go. מהלך בריא לכניסה.` });
      score += 8;
    } else if (changePercent > 8) {
      signals.push({ label: "תנועה היום", value: `+${changePercent.toFixed(1)}%`, tone: "neutral", weight: 0, explanation: `זינוק של ${changePercent.toFixed(1)}% — חזק מאוד, אבל אולי מאוחר להיכנס. סיכון לרדיפה אחרי המהלך.` });
    } else if (changePercent < -3) {
      signals.push({ label: "תנועה היום", value: `${changePercent.toFixed(1)}%`, tone: "bearish", weight: -6, explanation: `ירידה של ${Math.abs(changePercent).toFixed(1)}% היום — לחץ מכירה. לא רגע טוב לכניסת long.` });
      score -= 6;
    } else {
      signals.push({ label: "תנועה היום", value: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}%`, tone: "neutral", weight: 0, explanation: "תנועה שקטה היום — אין טריגר מיידי לכניסה, אבל גם אין לחץ מכירה." });
    }
  }

  // 6. Position within 52-week range
  if (high52w && low52w && price) {
    const rangePos = ((price - low52w) / (high52w - low52w)) * 100;
    if (rangePos >= 80) {
      signals.push({ label: "מיקום בטווח 52 שבועות", value: `${rangePos.toFixed(0)}% מהטווח`, tone: "bullish", weight: 8, explanation: `המניה ב-${rangePos.toFixed(0)}% העליונים של טווח השנה — קרובה לחלק החזק. מובילת שוק, לא מפגר.` });
      score += 8;
    } else if (rangePos >= 50) {
      signals.push({ label: "מיקום בטווח 52 שבועות", value: `${rangePos.toFixed(0)}% מהטווח`, tone: "neutral", weight: 0, explanation: `המניה באמצע טווח השנה (${rangePos.toFixed(0)}%). לא חלשה אבל לא מובילה.` });
    } else {
      signals.push({ label: "מיקום בטווח 52 שבועות", value: `${rangePos.toFixed(0)}% מהטווח`, tone: "bearish", weight: -8, explanation: `המניה ב-${rangePos.toFixed(0)}% התחתונים של טווח השנה — חלשה יחסית. מפגרת אחרי השוק.` });
      score -= 8;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: StockAnalysis["grade"] =
    score >= 78 ? "A" : score >= 64 ? "B" : score >= 50 ? "C" : score >= 36 ? "D" : "F";

  const bullCount = signals.filter((s) => s.tone === "bullish").length;
  const bearCount = signals.filter((s) => s.tone === "bearish").length;

  let verdict: string;
  let summary: string;
  if (score >= 78) {
    verdict = "setup חזק לכניסה";
    summary = `${symbol} מציגה ${bullCount} סימנים חיוביים בולטים. המבנה תומך בכניסת long של פריצה — עומדת בקריטריונים המרכזיים שלך.`;
  } else if (score >= 64) {
    verdict = "setup טוב, עם הסתייגות";
    summary = `${symbol} נראית טוב (${bullCount} חיוביים מול ${bearCount} שליליים), אבל לא מושלמת. שווה לעקוב ולחכות לאישור נוסף (נפח/פריצה) לפני כניסה.`;
  } else if (score >= 50) {
    verdict = "בינונית — לא עכשיו";
    summary = `${symbol} מעורבת: ${bullCount} חיוביים מול ${bearCount} שליליים. אין כאן setup ברור. עדיף להמתין שהתמונה תתבהר.`;
  } else if (score >= 36) {
    verdict = "חלשה — עדיף להימנע";
    summary = `${symbol} מציגה יותר סימנים שליליים (${bearCount}) מחיוביים (${bullCount}). לא מתאים לכניסת long כרגע.`;
  } else {
    verdict = "לא מתאים לכניסה";
    summary = `${symbol} חלשה מאוד — ${bearCount} סימנים שליליים. המבנה נגד כניסת long. עדיף להתרחק.`;
  }

  const suggestedStop =
    atr && price ? Number((price - atr * 1.5).toFixed(2)) : null;

  return {
    symbol,
    name,
    price,
    changePercent,
    score,
    grade,
    verdict,
    summary,
    signals,
    keyLevels: {
      ath: ath ? Number(ath.toFixed(2)) : null,
      high52w: high52w ? Number(high52w.toFixed(2)) : null,
      low52w: low52w ? Number(low52w.toFixed(2)) : null,
      ma50: ma50 ? Number(ma50.toFixed(2)) : null,
      ma150: ma150 ? Number(ma150.toFixed(2)) : null,
      ma200: ma200 ? Number(ma200.toFixed(2)) : null,
      suggestedStop,
    },
  };
}
