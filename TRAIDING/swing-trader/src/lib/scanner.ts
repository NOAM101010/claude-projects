import { yf } from "@/lib/yf";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PROFILE_CONFIG,
  SCANNER_UNIVERSE_UNIQUE,
  type ProfileConfig,
} from "./scanner-config";
import {
  SETUPS,
  buildSetupContext,
  unionRelevantSignals,
  unionSetupWeights,
  type SetupDetection,
  type SetupId,
} from "./setups";
import { scoreSignals, type AnalysisSignal, type Grade } from "./scoring";

export type ScanType = "premarket" | "morning" | "custom";

type Candidate = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  avgVolume: number | null;
  volumeRatio: number | null;
  marketCap: number | null;
  atr: number | null;
  atrPercent: number | null;
  rsi: number | null;
  ath: number | null;
  high52w: number | null;
  low52w: number | null;
  distanceFromAth: number | null;
  distanceFromHigh: number | null;
  distanceFromMa150: number | null;
  gapPercent: number | null;
  matchedSetups: SetupId[];
  /** הסטאפ עם ה-confidence הגבוה ביותר — ממנו נגזר ה-verdict */
  primarySetup: SetupId;
  confidence: number;
  keyLevel: number | null;
  boxLabel: string;
  score: number;
  grade: Grade;
  verdict: string;
  summary: string;
  signals: AnalysisSignal[];
};

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  const window = trs.slice(-period);
  return window.reduce((s, v) => s + v, 0) / window.length;
}

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  return window.reduce((s, v) => s + v, 0) / period;
}

/**
 * מנתח סימבול בודד מול פרופיל: מריץ רק את הסטאפים שהפרופיל מבקש,
 * ומחזיר מועמד רק אם לפחות סטאפ אחד נמצא.
 */
async function analyzeSymbol(
  symbol: string,
  profile: ProfileConfig
): Promise<Candidate | null> {
  const cfg = profile.filters;
  try {
    let quote: any = null;
    let hist: any[] = [];
    try {
      quote = await yf.quote(symbol);
    } catch (e) {
      console.warn(`[scanner] quote failed for ${symbol}:`, e);
      return null;
    }
    try {
      const chartResult = await yf.chart(symbol, {
        period1: new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().split("T")[0],
        interval: "1d",
      });
      hist = (chartResult as any).quotes ?? [];
    } catch (e) {
      console.warn(`[scanner] chart failed for ${symbol}:`, e);
      return null;
    }

    if (!quote || !hist || hist.length < 30) return null;

    const price = (quote.regularMarketPrice as number) ?? null;
    const changePercent = (quote.regularMarketChangePercent as number) ?? null;
    const volume = (quote.regularMarketVolume as number) ?? null;
    const avgVolume =
      (quote.averageDailyVolume10Day as number) ??
      (quote.averageDailyVolume3Month as number) ??
      null;
    const marketCap = (quote.marketCap as number) ?? null;
    const high52w = (quote.fiftyTwoWeekHigh as number) ?? null;
    const low52w = (quote.fiftyTwoWeekLow as number) ?? null;

    const highs = hist
      .map((h: any) => h.high as number)
      .filter((v: number) => Number.isFinite(v));
    const lows = hist
      .map((h: any) => h.low as number)
      .filter((v: number) => Number.isFinite(v));
    const closes = hist
      .map((h: any) => h.close as number)
      .filter((v: number) => Number.isFinite(v));
    const opens = hist
      .map((h: any) => h.open as number)
      .filter((v: number) => Number.isFinite(v));
    const volumes = hist
      .map((h: any) => h.volume as number)
      .filter((v: number) => Number.isFinite(v));

    const ath = highs.length ? Math.max(...highs) : null;
    const rsi = calcRSI(closes);
    const atr = calcATR(highs, lows, closes);
    const atrPercent = atr && price ? (atr / price) * 100 : null;
    const ma20 = calcMA(closes, 20);
    const ma50 = calcMA(closes, 50);
    const ma150 = calcMA(closes, 150);
    const ma200 = calcMA(closes, 200);

    const distanceFromAth = ath && price ? ((ath - price) / ath) * 100 : null;
    const distanceFromHigh =
      high52w && price ? ((high52w - price) / high52w) * 100 : null;
    const distanceFromMa150 =
      ma150 && price ? ((price - ma150) / ma150) * 100 : null;

    const volumeRatio = volume && avgVolume ? volume / avgVolume : null;

    // פילטרים קשיחים לפני זיהוי הסטאפים
    if (price == null) return null;
    if (marketCap != null && marketCap < cfg.minMarketCap) return null;
    if (avgVolume != null && avgVolume < cfg.minAvgVolume) return null;
    if (price < cfg.minPrice) return null;

    const ctx = buildSetupContext({
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
      thresholds: {
        gapUpMin: cfg.gapUpMin,
        volumeSpikeRatio: cfg.volumeSpikeRatio,
        nearAthPercent: cfg.nearAthPercent,
        near52wHighPercent: cfg.near52wHighPercent,
        minRsi: cfg.minRsi,
        maxRsi: cfg.maxRsi,
      },
    });

    // רק הסטאפים שהפרופיל ביקש
    const found: { id: SetupId; det: SetupDetection }[] = [];
    for (const id of profile.enabledSetups) {
      if (id === "cup_and_handle" && !cfg.cupAndHandle) continue;
      const det = SETUPS[id].detect(ctx);
      if (det.present) found.push({ id, det });
    }
    if (found.length === 0) return null;

    found.sort((a, b) => b.det.confidence - a.det.confidence);
    const primary = found[0];
    const matchedSetups = found.map((f) => f.id);

    // ניקוד רק על האותות הרלוונטיים לסטאפים שנמצאו, עם הדגשי המשקל שלהם
    const { score, grade, signals } = scoreSignals(
      {
        symbol,
        price,
        changePercent,
        rsi,
        ma50,
        ma150,
        ath,
        high52w,
        low52w,
        volumeRatio,
        matchedSetups,
      },
      { ...profile.weights, ...unionSetupWeights(matchedSetups) },
      "scanner",
      unionRelevantSignals(matchedSetups)
    );

    const { title, summary } = SETUPS[primary.id].verdict(grade, true);

    return {
      symbol,
      price,
      changePercent,
      volume,
      avgVolume,
      volumeRatio,
      marketCap,
      atr,
      atrPercent,
      rsi,
      ath,
      high52w,
      low52w,
      distanceFromAth,
      distanceFromHigh,
      distanceFromMa150,
      gapPercent: changePercent ?? null,
      matchedSetups,
      primarySetup: primary.id,
      confidence: primary.det.confidence,
      keyLevel: primary.det.keyLevel,
      boxLabel: primary.det.boxLabel,
      score,
      grade,
      verdict: title,
      summary,
      signals,
    };
  } catch (e) {
    console.error(`[scanner] failed for ${symbol}:`, e);
    return null;
  }
}

export async function runScanner(
  scanType: ScanType = "morning",
  profile: ProfileConfig = DEFAULT_PROFILE_CONFIG,
  universe: string[] = SCANNER_UNIVERSE_UNIQUE,
  profileName?: string
) {
  const run = await prisma.scannerRun.create({
    data: { scanType, status: "running", profileName: profileName ?? null },
  });

  try {
    const candidates: Candidate[] = [];
    const BATCH = 6;
    for (let i = 0; i < universe.length; i += BATCH) {
      const chunk = universe.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map((s) => analyzeSymbol(s, profile))
      );
      for (const r of results) {
        if (r) candidates.push(r);
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    await prisma.scannerResult.createMany({
      data: candidates.map((c) => ({
        runId: run.id,
        scanType,
        profileName: profileName ?? null,
        symbol: c.symbol,
        price: c.price,
        changePercent: c.changePercent,
        volume: c.volume,
        avgVolume: c.avgVolume,
        volumeRatio: c.volumeRatio,
        marketCap: c.marketCap,
        atr: c.atr,
        rsi: c.rsi,
        distanceFromHigh: c.distanceFromHigh,
        distanceFromMa150: c.distanceFromMa150,
        matchedSetups: JSON.stringify(c.matchedSetups),
        signals: JSON.stringify(c.signals),
        verdict: c.verdict,
        confidence: c.confidence,
        score: c.score,
        grade: c.grade,
      })),
    });

    await prisma.scannerRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        totalScanned: universe.length,
        totalMatches: candidates.length,
      },
    });

    return {
      runId: run.id,
      totalScanned: universe.length,
      matches: candidates,
    };
  } catch (e: any) {
    await prisma.scannerRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        errorMessage: e?.message ?? String(e),
      },
    });
    throw e;
  }
}
