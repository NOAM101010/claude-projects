import { prisma } from "@/lib/prisma";
import { PageContainer, Eyebrow, Display } from "@/components/ui";
import { computeStats, toClosedTrade, type TradeRow } from "@/lib/trade-stats";
import { fetchSpyCloses, computeBenchmark } from "@/lib/benchmark";
import JournalClient from "@/components/journal-client";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const trades = await prisma.trade.findMany({
    orderBy: { buyDate: "desc" },
  });

  const rows: TradeRow[] = trades.map((t) => ({
    id: t.id,
    ticker: t.ticker,
    quantity: t.quantity,
    buyPrice: t.buyPrice,
    buyAmount: t.buyAmount,
    buyDate: t.buyDate,
    sellPrice: t.sellPrice,
    sellAmount: t.sellAmount,
    sellDate: t.sellDate,
    commission: t.commission,
    usdIlsRate: t.usdIlsRate,
    stopPrice: t.stopPrice,
    setup: t.setup,
    notes: t.notes,
  }));

  const stats = computeStats(rows);

  const closedTrades = rows.map(toClosedTrade).filter((t) => t !== null) as NonNullable<
    ReturnType<typeof toClosedTrade>
  >[];

  let benchmark = { perTrade: [] as any[], avgAlphaPct: 0, beatMarketRate: 0, totalTrades: 0 };
  if (closedTrades.length > 0) {
    const dates = closedTrades.flatMap((t) => [t.buyDate, t.sellDate]);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const spyPoints = await fetchSpyCloses(minDate, maxDate);
    benchmark = computeBenchmark(closedTrades, spyPoints);
  }

  return (
    <PageContainer className="space-y-10">
      <section>
        <Eyebrow>Journal · {stats.totalTrades} טריידים</Eyebrow>
        <Display className="mt-3">
          יומן<br /><span className="trend-up-glow">הביצועים שלך.</span>
        </Display>
        <p className="text-sm text-[var(--fg-dim)] mt-4 max-w-lg">
          תובנות שאקסל לא נותן לך: Win Rate אמיתי, Profit Factor, R-Multiple, השוואה מול SPY,
          זיהוי אוטומטי של סטאפים, ומגמת Win Rate לאורך זמן.
        </p>
      </section>

      <JournalClient
        initialTrades={rows.map((r) => ({
          ...r,
          buyDate: r.buyDate.toISOString(),
          sellDate: r.sellDate ? r.sellDate.toISOString() : null,
        }))}
        stats={{
          ...stats,
          bestTrade: stats.bestTrade
            ? { ...stats.bestTrade, buyDate: stats.bestTrade.buyDate.toISOString(), sellDate: stats.bestTrade.sellDate.toISOString() }
            : null,
          worstTrade: stats.worstTrade
            ? { ...stats.worstTrade, buyDate: stats.worstTrade.buyDate.toISOString(), sellDate: stats.worstTrade.sellDate.toISOString() }
            : null,
        } as any}
        benchmark={benchmark}
      />
    </PageContainer>
  );
}
