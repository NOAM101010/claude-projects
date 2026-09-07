import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStats, type TradeRow } from "@/lib/trade-stats";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [trades, accountSizeRaw, cashRaw] = await Promise.all([
      prisma.trade.findMany({ orderBy: { buyDate: "desc" } }),
      getSetting("account_size"),
      getSetting("cash_balance"),
    ]);

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

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const todayPnl = stats.dailyPnl
      .filter((d) => d.date === todayKey)
      .reduce((s, d) => s + d.pnl, 0);
    const monthEntry = stats.byMonth.find((m) => m.month === monthKey);
    const monthPnl = monthEntry?.netPnl ?? 0;

    const accountSize = accountSizeRaw ? Number(accountSizeRaw) : null;
    const cashBalance = cashRaw ? Number(cashRaw) : null;
    const monthReturnPct =
      accountSize && accountSize > 0 ? (monthPnl / accountSize) * 100 : null;

    return NextResponse.json({
      ok: true,
      account: {
        accountSize: Number.isFinite(accountSize as number) ? accountSize : null,
        cashBalance: Number.isFinite(cashBalance as number) ? cashBalance : null,
      },
      pnl: {
        today: todayPnl,
        month: monthPnl,
        total: stats.totalNetPnl,
        monthReturnPct,
      },
      equityCurve: stats.equityCurve,
      byMonth: stats.byMonth,
      bySetup: stats.bySetup,
      winRate: stats.winRate,
      closedTrades: stats.closedTrades,
      openPositions: stats.openPositions,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
