import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { yf } from "@/lib/yf";
import { computeMarketRegime } from "@/lib/market-regime";
import { buildSpokenBrief } from "@/lib/morning-brief";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const now = new Date();

    const [openTrades, lastRun, regime] = await Promise.all([
      prisma.trade.findMany({ where: { sellDate: null } }),
      prisma.scannerRun
        .findFirst({
          where: { status: "success" },
          orderBy: { startedAt: "desc" },
        })
        .catch(() => null),
      computeMarketRegime().catch(() => null),
    ]);

    const tickers = Array.from(
      new Set(openTrades.map((t) => t.ticker.toUpperCase()))
    );
    const priceMap = new Map<string, number | null>();
    await Promise.all(
      tickers.map(async (sym) => {
        try {
          const q: any = await yf.quote(sym);
          priceMap.set(sym, (q?.regularMarketPrice as number) ?? null);
        } catch {
          priceMap.set(sym, null);
        }
      })
    );

    let openPnl = 0;
    let hasAnyPrice = false;
    let nearStop: { ticker: string } | null = null;
    for (const t of openTrades) {
      const cur = priceMap.get(t.ticker.toUpperCase()) ?? null;
      if (cur == null) continue;
      hasAnyPrice = true;
      openPnl += (cur - t.buyPrice) * t.quantity;
      if (t.stopPrice != null && cur !== 0 && !nearStop) {
        const dist = ((cur - t.stopPrice) / cur) * 100;
        if (dist >= 0 && dist < 3) nearStop = { ticker: t.ticker.toUpperCase() };
      }
    }

    const scanCount = lastRun
      ? await prisma.scannerResult
          .count({ where: { runId: lastRun.id } })
          .catch(() => null)
      : null;

    const text = buildSpokenBrief({
      now,
      regime,
      openPositions: openTrades.length,
      nearStop,
      openPnl: hasAnyPrice ? openPnl : null,
      scanCount,
    });

    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
