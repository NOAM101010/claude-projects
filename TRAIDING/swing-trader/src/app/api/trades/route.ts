import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const trades = await prisma.trade.findMany({
    orderBy: { buyDate: "desc" },
  });
  return NextResponse.json({ ok: true, trades });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // A trade is only "closed" when it has BOTH a sell price and a sell date —
  // one without the other is treated as still open to avoid inconsistent state.
  const hasSellPrice = body.sellPrice != null && body.sellPrice !== "";
  const hasSellDate = !!body.sellDate;
  const isClosed = hasSellPrice && hasSellDate;

  const trade = await prisma.trade.create({
    data: {
      ticker: String(body.ticker).toUpperCase().trim(),
      quantity: Number(body.quantity),
      buyPrice: Number(body.buyPrice),
      buyAmount: Number(body.buyPrice) * Number(body.quantity),
      buyDate: new Date(body.buyDate),
      sellPrice: isClosed ? Number(body.sellPrice) : null,
      sellAmount: isClosed ? Number(body.sellPrice) * Number(body.quantity) : null,
      sellDate: isClosed ? new Date(body.sellDate) : null,
      commission: body.commission != null ? Number(body.commission) : 0,
      usdIlsRate: body.usdIlsRate != null && body.usdIlsRate !== "" ? Number(body.usdIlsRate) : null,
      stopPrice: body.stopPrice != null && body.stopPrice !== "" ? Number(body.stopPrice) : null,
      setup: body.setup || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ ok: true, trade });
}
