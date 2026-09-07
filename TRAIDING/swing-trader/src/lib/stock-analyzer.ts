import { yf } from "@/lib/yf";
import {
  scoreSignals,
  type AnalysisSignal,
  type ScoringWeights,
  type SignalTone,
} from "@/lib/scoring";
import { SETUPS, buildSetupContext, isSetupId, type SetupId } from "@/lib/setups";

export type { AnalysisSignal, SignalTone };

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
  /** הסטאפ שנבדק (אם התבקש ניתוח ממוקד) */
  setupId?: SetupId;
  setupLabel?: string;
  patternValid?: boolean;
  confidence?: number;
  boxLabel?: string;
  setupKeyLevel?: number | null;
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

export async function analyzeStock(
  rawSymbol: string,
  opts?: { weights?: Partial<ScoringWeights> | null; setupId?: string | null }
): Promise<StockAnalysis | { error: string }> {
  const weights = opts?.weights ?? null;
  const setupId = isSetupId(opts?.setupId) ? opts.setupId : null;
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
  const opens = hist.map((h) => h.open as number).filter(Number.isFinite);
  const volumes = hist.map((h) => h.volume as number).filter(Number.isFinite);

  const ath = highs.length ? Math.max(...highs) : high52w;
  const rsi = calcRSI(closes);
  const atr = calcATR(highs, lows, closes);
  const ma20 = calcMA(closes, 20);
  const ma50 = calcMA(closes, 50);
  const ma150 = calcMA(closes, 150);
  const ma200 = calcMA(closes, 200);
  const volumeRatio = volume && avgVolume ? volume / avgVolume : null;

  const setup = setupId ? SETUPS[setupId] : null;
  const detection = setup
    ? setup.detect(
        buildSetupContext({
          symbol,
          price,
          changePercent,
          closes,
          highs,
          lows,
          opens,
          volumes,
          rsi,
          atr,
          ma20,
          ma50,
          ma150,
          ma200,
          ath,
          high52w,
          low52w,
          volumeRatio,
        })
      )
    : null;

  // ניתוח ממוקד-סטאפ מנקד רק את האותות הרלוונטיים, עם הדגשי המשקל של הסטאפ.
  // ניתוח כללי (בלי setupId) — בדיוק כמו קודם.
  const { score, grade, signals, verdict, summary } = scoreSignals(
    { symbol, price, changePercent, rsi, ma50, ma150, ath, high52w, low52w, volumeRatio },
    setup && detection?.present ? { ...weights, ...setup.weights } : weights,
    "analysis",
    setup && detection?.present ? setup.relevantSignals : null
  );

  const suggestedStop =
    atr && price ? Number((price - atr * 1.5).toFixed(2)) : null;

  let finalVerdict = verdict;
  let finalSummary = summary;
  if (setup && detection) {
    const v = setup.verdict(grade, detection.present);
    if (detection.present) {
      finalVerdict = v.title;
      finalSummary = v.summary;
    } else {
      finalVerdict = `התבנית לא תקינה כרגע: ${setup.label}`;
      finalSummary = `${v.summary} מתחת מוצג הניתוח הכללי של ${symbol}: ${summary}`;
    }
  }

  return {
    symbol,
    name,
    price,
    changePercent,
    score,
    grade,
    verdict: finalVerdict,
    summary: finalSummary,
    signals,
    ...(setup && detection
      ? {
          setupId: setup.id,
          setupLabel: setup.label,
          patternValid: detection.present,
          confidence: detection.confidence,
          boxLabel: detection.boxLabel,
          setupKeyLevel: detection.keyLevel,
        }
      : {}),
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
