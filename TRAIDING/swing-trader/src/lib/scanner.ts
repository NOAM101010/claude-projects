import { yf } from "@/lib/yf";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCANNER_CONFIG,
  SCANNER_UNIVERSE_UNIQUE,
  type ScannerConfig,
} from "./scanner-config";

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
  matchedSetups: string[];
  score: number;
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

function detectCupAndHandle(
  closes: number[],
  volumes: number[]
): boolean {
  if (closes.length < 90) return false;

  const window = Math.min(closes.length, 160);
  const rc = closes.slice(-window);
  const rv = volumes.slice(-window);

  const halfPoint = Math.floor(rc.length / 2);
  const leftHalf = rc.slice(0, halfPoint);
  const lipPrice = Math.max(...leftHalf);
  const lipIndex = leftHalf.indexOf(lipPrice);

  const rightSide = rc.slice(lipIndex);
  const bottomPrice = Math.min(...rightSide);
  const bottomIndex = rightSide.indexOf(bottomPrice) + lipIndex;

  // Cup depth: 18-38%
  const cupDepth = ((lipPrice - bottomPrice) / lipPrice) * 100;
  if (cupDepth < 18 || cupDepth > 38) return false;

  // Current price should be in handle formation (80-95% of lip price)
  // NOT already at the breakout
  const currentPrice = rc[rc.length - 1];
  const distanceFromLip = ((lipPrice - currentPrice) / lipPrice) * 100;
  if (distanceFromLip < 5 || distanceFromLip > 12) return false;

  // Last 20 bars: handle consolidation
  const handleWindow = rc.slice(-20);
  const handleHigh = Math.max(...handleWindow);
  const handleLow = Math.min(...handleWindow);
  const handleDepth = ((handleHigh - handleLow) / handleHigh) * 100;
  if (handleDepth < 2 || handleDepth > 10) return false;

  // Verify handle high is below lip (not broken out yet)
  if (handleHigh > lipPrice * 1.01) return false;

  // Volume should decrease during handle
  const cupVolume = rv.slice(lipIndex, Math.min(bottomIndex + 8, rc.length))
    .reduce((s, v) => s + v, 0) / Math.max(Math.min(bottomIndex + 8, rc.length) - lipIndex, 1);
  const handleVolume = rv.slice(-20).reduce((s, v) => s + v, 0) / 20;
  if (handleVolume > cupVolume * 0.9) return false;

  return true;
}

function detectGapEntry(
  opens: number[],
  closes: number[],
  highs: number[],
  lows: number[],
  currentPrice: number,
  minGapPct = 2.5
): boolean {
  if (opens.length < 3) return false;

  // Search ALL history for unfilled gaps, not just recent ones
  for (let i = 1; i < opens.length; i++) {
    const prevClose = closes[i - 1];
    const barOpen = opens[i];
    const barHigh = highs[i];
    const barLow = lows[i];

    // Gap UP (bullish)
    const gapUpPct = ((barOpen - prevClose) / prevClose) * 100;
    if (gapUpPct >= minGapPct) {
      const gapBottom = prevClose;
      const gapTop = barOpen;

      // Check if gap is still UNFILLED (price never closed it)
      let gapFilled = false;
      for (let j = i; j < lows.length; j++) {
        if (lows[j] <= gapBottom * 1.001) {
          gapFilled = true;
          break;
        }
      }
      if (gapFilled) continue;

      // Price is ENTERING or INSIDE gap zone:
      // Already inside gap: gapBottom < price < gapTop
      // OR about to enter: price within 1-1.5% of gapBottom
      const distToGap = ((gapBottom - currentPrice) / gapBottom) * 100;
      const priceInsideGap = currentPrice > gapBottom * 1.001 && currentPrice < gapTop * 0.99;
      const aboutToEnter = distToGap > 0 && distToGap <= 1.5;

      if (priceInsideGap || aboutToEnter) {
        return true;
      }
    }

    // Gap DOWN (bearish)
    const gapDownPct = ((prevClose - barOpen) / prevClose) * 100;
    if (gapDownPct >= minGapPct) {
      const gapBottom = barOpen;
      const gapTop = prevClose;

      // Check if gap is still unfilled
      let gapFilled = false;
      for (let j = i; j < highs.length; j++) {
        if (highs[j] >= gapTop * 0.999) {
          gapFilled = true;
          break;
        }
      }
      if (gapFilled) continue;

      // Price entering or inside
      const distToGap = ((currentPrice - gapTop) / gapTop) * 100;
      const priceInsideGap = currentPrice > gapBottom * 1.01 && currentPrice < gapTop * 0.999;
      const aboutToEnter = distToGap > 0 && distToGap <= 1.5;

      if (priceInsideGap || aboutToEnter) {
        return true;
      }
    }
  }

  return false;
}

async function analyzeSymbol(
  symbol: string,
  cfg: ScannerConfig
): Promise<Candidate | null> {
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
    const ma150 = calcMA(closes, 150);

    const distanceFromAth =
      ath && price ? ((ath - price) / ath) * 100 : null;
    const distanceFromHigh =
      high52w && price ? ((high52w - price) / high52w) * 100 : null;
    const distanceFromMa150 =
      ma150 && price ? ((price - ma150) / ma150) * 100 : null;

    const volumeRatio = volume && avgVolume ? volume / avgVolume : null;

    const matchedSetups: string[] = [];

    const distFromAthPct = ath && price ? ((ath - price) / ath) * 100 : null;

    // FRESH breakout check: price crossed above previous ATH in last 3 days
    // Previous ATH = highest high EXCLUDING last 3 bars
    let isFreshAthBreakout = false;
    if (ath && price && highs.length >= 30) {
      const previousAth = Math.max(...highs.slice(0, -3));
      const last3Bars = highs.slice(-3);
      const currentHigh = Math.max(...last3Bars);
      // Breakout must have happened in last 3 days AND price still near new ATH
      if (currentHigh > previousAth * 1.001 && distFromAthPct !== null && distFromAthPct <= 2) {
        isFreshAthBreakout = true;
      }
    }

    if (isFreshAthBreakout) {
      matchedSetups.push("breakout_ath");
    } else if (
      distFromAthPct !== null &&
      distFromAthPct > 0 &&
      distFromAthPct <= cfg.nearAthPercent
    ) {
      matchedSetups.push("near_ath");
    }

    // FRESH 52W breakout: crossed 52W high in last 3 days
    let isFresh52wBreakout = false;
    if (high52w && price && highs.length >= 30) {
      const previous52wHigh = Math.max(...highs.slice(0, -3));
      const currentHigh = Math.max(...highs.slice(-3));
      const distFrom52w = ((high52w - price) / high52w) * 100;
      if (currentHigh > previous52wHigh * 1.001 && distFrom52w <= 2) {
        isFresh52wBreakout = true;
      }
    }

    if (isFresh52wBreakout) {
      matchedSetups.push("breakout_52w");
    } else if (
      high52w &&
      price &&
      ((high52w - price) / high52w) * 100 > 0 &&
      ((high52w - price) / high52w) * 100 <= cfg.near52wHighPercent
    ) {
      matchedSetups.push("near_52w");
    }

    // Real gap check: today's OPEN vs yesterday's CLOSE (not just intraday change)
    const gapPercent = changePercent ?? null;
    let hasRealGapToday = false;
    if (opens.length >= 2 && closes.length >= 2) {
      const yesterdayClose = closes[closes.length - 2];
      const todayOpen = opens[opens.length - 1];
      const gapPct = ((todayOpen - yesterdayClose) / yesterdayClose) * 100;
      if (gapPct >= cfg.gapUpMin) hasRealGapToday = true;
    }
    if (hasRealGapToday) {
      matchedSetups.push("gap_up");
    }

    if (volumeRatio != null && volumeRatio >= cfg.volumeSpikeRatio) {
      matchedSetups.push("high_volume");
    }

    if (cfg.cupAndHandle && detectCupAndHandle(closes, volumes)) {
      matchedSetups.push("cup_and_handle");
    }

    if (price && detectGapEntry(opens, closes, highs, lows, price, cfg.gapUpMin)) {
      matchedSetups.push("gap_entry");
    }

    if (marketCap != null && marketCap < cfg.minMarketCap) return null;
    if (avgVolume != null && avgVolume < cfg.minAvgVolume) return null;
    if (price != null && price < cfg.minPrice) return null;

    if (matchedSetups.length === 0) return null;

    let score = 0;
    if (matchedSetups.includes("breakout_ath")) score += 65;
    if (matchedSetups.includes("breakout_52w")) score += 45;
    if (matchedSetups.includes("near_ath")) score += 25;
    if (matchedSetups.includes("near_52w")) score += 18;
    if (matchedSetups.includes("gap_up")) score += 20;
    if (matchedSetups.includes("gap_entry")) score += 35;
    if (matchedSetups.includes("high_volume")) score += 20;
    if (matchedSetups.includes("cup_and_handle")) score += 40;
    if (rsi != null && rsi >= cfg.minRsi && rsi <= cfg.maxRsi) score += 10;
    if (volumeRatio != null) score += Math.min(volumeRatio * 5, 25);
    if (distanceFromMa150 != null && distanceFromMa150 > 0) score += 5;

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
      gapPercent,
      matchedSetups,
      score,
    };
  } catch (e) {
    console.error(`[scanner] failed for ${symbol}:`, e);
    return null;
  }
}

export async function runScanner(
  scanType: ScanType = "morning",
  cfg: ScannerConfig = DEFAULT_SCANNER_CONFIG,
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
        chunk.map((s) => analyzeSymbol(s, cfg))
      );
      for (const r of results) {
        if (r) candidates.push(r);
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    function scoreToGrade(score: number): string {
      if (score >= 110) return "A";
      if (score >= 80) return "B";
      if (score >= 55) return "C";
      if (score >= 30) return "D";
      return "F";
    }

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
        score: c.score,
        grade: scoreToGrade(c.score),
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
