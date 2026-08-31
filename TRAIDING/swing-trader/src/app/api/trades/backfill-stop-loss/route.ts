import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// For closed losing trades with no stopPrice set, assume the user exited
// exactly at their planned stop (common for disciplined stop-loss traders).
export async function POST() {
  const trades = await prisma.trade.findMany({
    where: { sellPrice: { not: null }, stopPrice: null },
  });

  let updated = 0;
  for (const t of trades) {
    if (t.sellPrice == null) continue;
    const isLoss = t.sellPrice < t.buyPrice;
    if (!isLoss) continue;
    await prisma.trade.update({
      where: { id: t.id },
      data: { stopPrice: t.sellPrice },
    });
    updated++;
  }

  return NextResponse.json({ ok: true, updated, checked: trades.length });
}
