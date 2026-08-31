import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Sell price/date are only touched when the form explicitly sends both fields.
  // If exactly one of them ends up empty, treat the trade as still open (null both)
  // to avoid ever storing a half-closed trade.
  let sellPrice: number | null | undefined;
  let sellAmount: number | null | undefined;
  let sellDate: Date | null | undefined;
  if (body.sellPrice !== undefined || body.sellDate !== undefined) {
    const hasSellPrice = body.sellPrice != null && body.sellPrice !== "";
    const hasSellDate = !!body.sellDate;
    if (hasSellPrice && hasSellDate) {
      sellPrice = Number(body.sellPrice);
      sellDate = new Date(body.sellDate);
      sellAmount = body.quantity != null ? sellPrice * Number(body.quantity) : undefined;
    } else {
      sellPrice = null;
      sellAmount = null;
      sellDate = null;
    }
  }

  const trade = await prisma.trade.update({
    where: { id },
    data: {
      ticker: body.ticker ? String(body.ticker).toUpperCase().trim() : undefined,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      buyPrice: body.buyPrice != null ? Number(body.buyPrice) : undefined,
      buyAmount:
        body.buyPrice != null && body.quantity != null
          ? Number(body.buyPrice) * Number(body.quantity)
          : undefined,
      buyDate: body.buyDate ? new Date(body.buyDate) : undefined,
      sellPrice,
      sellAmount,
      sellDate,
      commission: body.commission != null ? Number(body.commission) : undefined,
      usdIlsRate: body.usdIlsRate != null && body.usdIlsRate !== "" ? Number(body.usdIlsRate) : undefined,
      stopPrice: body.stopPrice !== undefined ? (body.stopPrice !== "" ? Number(body.stopPrice) : null) : undefined,
      setup: body.setup !== undefined ? body.setup || null : undefined,
      notes: body.notes !== undefined ? body.notes || null : undefined,
    },
  });
  return NextResponse.json({ ok: true, trade });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.trade.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
