import { yf } from "@/lib/yf";
import type { ClosedTrade } from "@/lib/trade-stats";

export type BenchmarkPoint = { date: string; close: number };

export type TradeAlpha = {
  tradeId: string;
  ticker: string;
  tradeReturnPct: number;
  spyReturnPct: number;
  alphaPct: number;
  beatMarket: boolean;
};

export type BenchmarkResult = {
  perTrade: TradeAlpha[];
  avgAlphaPct: number;
  beatMarketRate: number;
  totalTrades: number;
};

export async function fetchSpyCloses(
  from: Date,
  to: Date
): Promise<BenchmarkPoint[]> {
  try {
    const chartResult = await yf.chart("SPY", {
      period1: new Date(from.getTime() - 5 * 86400000).toISOString().split("T")[0],
      period2: new Date(to.getTime() + 2 * 86400000).toISOString().split("T")[0],
      interval: "1d",
    });
    const quotes = (chartResult as any).quotes ?? [];
    return quotes
      .filter((q: any) => q.close != null && q.date)
      .map((q: any) => ({
        date: new Date(q.date).toISOString().slice(0, 10),
        close: q.close as number,
      }));
  } catch {
    return [];
  }
}

function nearestClose(points: BenchmarkPoint[], target: Date): number | null {
  const targetStr = target.toISOString().slice(0, 10);
  // Find exact or nearest previous trading day
  let best: BenchmarkPoint | null = null;
  for (const p of points) {
    if (p.date <= targetStr) {
      if (!best || p.date > best.date) best = p;
    }
  }
  return best ? best.close : points[0]?.close ?? null;
}

export function computeBenchmark(
  closed: ClosedTrade[],
  spyPoints: BenchmarkPoint[]
): BenchmarkResult {
  if (spyPoints.length === 0 || closed.length === 0) {
    return { perTrade: [], avgAlphaPct: 0, beatMarketRate: 0, totalTrades: 0 };
  }

  const perTrade: TradeAlpha[] = [];

  for (const t of closed) {
    const spyBuy = nearestClose(spyPoints, t.buyDate);
    const spySell = nearestClose(spyPoints, t.sellDate);
    if (spyBuy == null || spySell == null) continue;
    const spyReturnPct = ((spySell - spyBuy) / spyBuy) * 100;
    const alphaPct = t.pnlPercent - spyReturnPct;
    perTrade.push({
      tradeId: t.id,
      ticker: t.ticker,
      tradeReturnPct: t.pnlPercent,
      spyReturnPct,
      alphaPct,
      beatMarket: alphaPct > 0,
    });
  }

  const avgAlphaPct = perTrade.length
    ? perTrade.reduce((s, t) => s + t.alphaPct, 0) / perTrade.length
    : 0;
  const beatMarketRate = perTrade.length
    ? (perTrade.filter((t) => t.beatMarket).length / perTrade.length) * 100
    : 0;

  return { perTrade, avgAlphaPct, beatMarketRate, totalTrades: perTrade.length };
}
