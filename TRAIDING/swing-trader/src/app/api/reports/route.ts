import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStats, toClosedTrade, type TradeRow } from "@/lib/trade-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClosedTrade = NonNullable<ReturnType<typeof toClosedTrade>>;

function weekStartOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - x.getUTCDay());
  return x.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const trades = await prisma.trade.findMany({ orderBy: { buyDate: "desc" } });

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
    const closed = rows
      .map(toClosedTrade)
      .filter((t): t is ClosedTrade => t !== null);

    // Daily P&L with per-day win-rate
    const dailyMap = new Map<string, { pnl: number; trades: number; wins: number }>();
    for (const t of closed) {
      const key = t.sellDate.toISOString().slice(0, 10);
      const e = dailyMap.get(key) ?? { pnl: 0, trades: 0, wins: 0 };
      e.pnl += t.netPnl;
      e.trades += 1;
      if (t.netPnl > 0) e.wins += 1;
      dailyMap.set(key, e);
    }
    const dailyPnl = Array.from(dailyMap.entries())
      .map(([date, v]) => ({
        date,
        pnl: v.pnl,
        trades: v.trades,
        winRate: v.trades ? (v.wins / v.trades) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Weekly summaries
    const weekMap = new Map<string, { pnl: number; trades: number; wins: number }>();
    for (const t of closed) {
      const key = weekStartOf(t.sellDate);
      const e = weekMap.get(key) ?? { pnl: 0, trades: 0, wins: 0 };
      e.pnl += t.netPnl;
      e.trades += 1;
      if (t.netPnl > 0) e.wins += 1;
      weekMap.set(key, e);
    }
    const weeklyPnl = Array.from(weekMap.entries())
      .map(([weekStart, v]) => ({
        weekStart,
        pnl: v.pnl,
        trades: v.trades,
        winRate: v.trades ? (v.wins / v.trades) * 100 : 0,
      }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    return NextResponse.json({
      ok: true,
      dailyPnl,
      byMonth: stats.byMonth,
      bestDayOfWeek: stats.bestDayOfWeek,
      equityCurve: stats.equityCurve,
      winRate: stats.winRate,
      totalNetPnl: stats.totalNetPnl,
      closedTrades: stats.closedTrades,
      weeklyPnl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
