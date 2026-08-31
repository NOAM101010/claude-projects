import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SETUP_PRIORITY = [
  { key: "breakout_ath", label: "ATH Breakout" },
  { key: "breakout_52w", label: "52W Breakout" },
  { key: "cup_and_handle", label: "Cup & Handle" },
  { key: "gap_entry", label: "Gap & Go" },
  { key: "gap_up", label: "Gap & Go" },
  { key: "near_ath", label: "ATH Breakout" },
  { key: "near_52w", label: "52W Breakout" },
];

export async function POST() {
  const trades = await prisma.trade.findMany({
    where: { setup: null },
  });

  let tagged = 0;

  for (const trade of trades) {
    // Look for scanner results for this symbol within 5 days before the buy date
    const windowStart = new Date(trade.buyDate.getTime() - 5 * 86400000);
    const windowEnd = new Date(trade.buyDate.getTime() + 86400000);

    const candidates = await prisma.scannerResult.findMany({
      where: {
        symbol: trade.ticker,
        runAt: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { score: "desc" },
      take: 1,
    });

    if (candidates.length === 0) continue;

    const matched: string[] = JSON.parse(candidates[0].matchedSetups || "[]");
    const found = SETUP_PRIORITY.find((s) => matched.includes(s.key));
    if (!found) continue;

    await prisma.trade.update({
      where: { id: trade.id },
      data: { setup: found.label },
    });
    tagged++;
  }

  return NextResponse.json({ ok: true, tagged, checked: trades.length });
}
