import { NextResponse } from "next/server";
import { yf } from "@/lib/yf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORE = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "DOW" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "QQQ", label: "QQQ" },
  { symbol: "SPY", label: "SPY" },
  { symbol: "BTC-USD", label: "Bitcoin" },
  { symbol: "ETH-USD", label: "Ethereum" },
];

export async function GET() {
  try {
    const watchlist = await prisma.watchlist.findMany({
      orderBy: { addedAt: "asc" },
      take: 20,
    });
    const symbols = [
      ...CORE,
      ...watchlist.map((w) => ({ symbol: w.symbol, label: w.symbol })),
    ];
    const uniq = symbols.filter(
      (s, i, arr) => arr.findIndex((x) => x.symbol === s.symbol) === i
    );
    const results = await Promise.all(
      uniq.map(async (s) => {
        try {
          const q: any = await yf.quote(s.symbol);
          return {
            symbol: s.symbol,
            label: s.label,
            price: (q?.regularMarketPrice as number) ?? null,
            changePercent: (q?.regularMarketChangePercent as number) ?? null,
          };
        } catch {
          return { symbol: s.symbol, label: s.label, price: null, changePercent: null };
        }
      })
    );
    return NextResponse.json({ ok: true, quotes: results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
