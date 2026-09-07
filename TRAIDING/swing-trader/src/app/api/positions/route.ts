import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { yf } from "@/lib/yf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type PositionRow = {
  id: string;
  ticker: string;
  shares: number;
  buyPrice: number;
  buyAmount: number;
  buyDate: string;
  stopPrice: number | null;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  risk: number | null; // $ at risk to stop
  distanceToStopPct: number | null;
};

async function chunkedQuotes(symbols: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const BATCH = 8;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (sym) => {
        try {
          const q: any = await yf.quote(sym);
          out.set(sym, (q?.regularMarketPrice as number) ?? null);
        } catch {
          out.set(sym, null);
        }
      })
    );
  }
  return out;
}

export async function GET() {
  try {
    const open = await prisma.trade.findMany({
      where: { sellDate: null },
      orderBy: { buyDate: "desc" },
    });

    const tickers = Array.from(new Set(open.map((t) => t.ticker.toUpperCase())));
    const priceMap = await chunkedQuotes(tickers);

    const positions: PositionRow[] = open.map((t) => {
      const shares = t.quantity;
      const buyPrice = t.buyPrice;
      const currentPrice = priceMap.get(t.ticker.toUpperCase()) ?? null;
      const marketValue = currentPrice != null ? currentPrice * shares : null;
      const unrealizedPnl =
        currentPrice != null ? (currentPrice - buyPrice) * shares : null;
      const unrealizedPnlPct =
        currentPrice != null && buyPrice !== 0
          ? ((currentPrice - buyPrice) / buyPrice) * 100
          : null;
      const risk =
        t.stopPrice != null ? (buyPrice - t.stopPrice) * shares : null;
      const distanceToStopPct =
        t.stopPrice != null && currentPrice != null && currentPrice !== 0
          ? ((currentPrice - t.stopPrice) / currentPrice) * 100
          : null;

      return {
        id: t.id,
        ticker: t.ticker.toUpperCase(),
        shares,
        buyPrice,
        buyAmount: t.buyAmount,
        buyDate: t.buyDate.toISOString(),
        stopPrice: t.stopPrice,
        currentPrice,
        marketValue,
        unrealizedPnl,
        unrealizedPnlPct,
        risk,
        distanceToStopPct,
      };
    });

    const totalOpenPnl = positions.reduce(
      (s, p) => s + (p.unrealizedPnl ?? 0),
      0
    );
    const totalOpenRisk = positions.reduce(
      (s, p) => s + (p.risk != null && p.risk > 0 ? p.risk : 0),
      0
    );
    const totalMarketValue = positions.reduce(
      (s, p) => s + (p.marketValue ?? 0),
      0
    );

    return NextResponse.json({
      ok: true,
      positions,
      totalOpenPnl,
      totalOpenRisk,
      totalMarketValue,
      count: positions.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
