import { yf } from "./yf";
import { prisma } from "./prisma";

/**
 * For each scanner result older than N days (up to backtestDays back),
 * fetch the price N days later and compute % return + max/min drawdown.
 * Skips results already backtested.
 */
export async function runBacktest(
  {
    backtestDays = 60,
    horizons = [5, 10, 20] as const,
    limit = 500,
  }: { backtestDays?: number; horizons?: readonly number[]; limit?: number } = {}
) {
  const oldest = new Date(Date.now() - backtestDays * 24 * 3600 * 1000);
  const minAge = new Date(Date.now() - 5 * 24 * 3600 * 1000);

  const results = await prisma.scannerResult.findMany({
    where: {
      runAt: { gte: oldest, lte: minAge },
      backtestedAt: null,
      price: { not: null },
    },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  if (results.length === 0) {
    return { processed: 0, symbols: 0 };
  }

  // Group by symbol → single history fetch per symbol
  const bySymbol = new Map<string, typeof results>();
  for (const r of results) {
    const arr = bySymbol.get(r.symbol) ?? [];
    arr.push(r);
    bySymbol.set(r.symbol, arr);
  }

  let processed = 0;

  for (const [symbol, records] of bySymbol) {
    try {
      const hist = (await yf.historical(symbol, {
        period1: new Date(Math.min(...records.map((r) => r.runAt.getTime())) - 24 * 3600 * 1000),
        period2: new Date(),
        interval: "1d",
      })) as any[];

      for (const rec of records) {
        const entryPrice = rec.price!;
        // Find bars after runAt
        const laterBars = hist
          .filter((b) => new Date(b.date).getTime() > rec.runAt.getTime())
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (laterBars.length === 0) continue;

        const price5 = laterBars[Math.min(4, laterBars.length - 1)]?.close ?? null;
        const price10 = laterBars[Math.min(9, laterBars.length - 1)]?.close ?? null;
        const price20 = laterBars[Math.min(19, laterBars.length - 1)]?.close ?? null;

        const window20 = laterBars.slice(0, 20);
        const maxHigh = window20.length
          ? Math.max(...window20.map((b) => b.high as number))
          : null;
        const minLow = window20.length
          ? Math.min(...window20.map((b) => b.low as number))
          : null;

        const pct = (p: number | null) =>
          p != null ? ((p - entryPrice) / entryPrice) * 100 : null;

        await prisma.scannerResult.update({
          where: { id: rec.id },
          data: {
            price5d: price5,
            price10d: price10,
            price20d: price20,
            return5d: pct(price5),
            return10d: pct(price10),
            return20d: pct(price20),
            maxReturn20d: maxHigh != null ? ((maxHigh - entryPrice) / entryPrice) * 100 : null,
            minReturn20d: minLow != null ? ((minLow - entryPrice) / entryPrice) * 100 : null,
            backtestedAt: new Date(),
          },
        });
        processed++;
      }
    } catch (e) {
      console.error(`[backtest] failed for ${symbol}:`, e);
    }
  }

  return { processed, symbols: bySymbol.size };
}

/**
 * Aggregate performance stats from backtested scanner results.
 */
export async function getBacktestStats({
  sinceDays = 90,
  profileName,
}: {
  sinceDays?: number;
  profileName?: string;
} = {}) {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000);
  const rows = await prisma.scannerResult.findMany({
    where: {
      runAt: { gte: since },
      backtestedAt: { not: null },
      ...(profileName ? { profileName } : {}),
    },
  });

  const withRet5 = rows.filter((r) => r.return5d != null);
  const withRet10 = rows.filter((r) => r.return10d != null);
  const withRet20 = rows.filter((r) => r.return20d != null);

  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((n): n is number => n != null);
    return v.length ? v.reduce((s, n) => s + n, 0) / v.length : 0;
  };
  const hitRate = (arr: (number | null)[], threshold: number) => {
    const v = arr.filter((n): n is number => n != null);
    if (!v.length) return 0;
    return (v.filter((n) => n >= threshold).length / v.length) * 100;
  };

  return {
    total: rows.length,
    avg5d: avg(withRet5.map((r) => r.return5d)),
    avg10d: avg(withRet10.map((r) => r.return10d)),
    avg20d: avg(withRet20.map((r) => r.return20d)),
    hitRate3pct5d: hitRate(withRet5.map((r) => r.return5d), 3),
    hitRate5pct10d: hitRate(withRet10.map((r) => r.return10d), 5),
    hitRate10pct20d: hitRate(withRet20.map((r) => r.return20d), 10),
    negRate5d: hitRate(withRet5.map((r) => -(r.return5d ?? 0)), 3), // % that lost 3%+ in 5d
    bestSymbol: rows.sort((a, b) => (b.maxReturn20d ?? -999) - (a.maxReturn20d ?? -999))[0] ?? null,
    worstSymbol: rows.sort((a, b) => (a.minReturn20d ?? 999) - (b.minReturn20d ?? 999))[0] ?? null,
    rows,
  };
}
