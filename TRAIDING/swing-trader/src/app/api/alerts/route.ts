import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const alerts = await prisma.priceAlert.findMany({
    where: {
      OR: [{ active: true }, { triggeredAt: { gte: cutoff } }],
    },
    orderBy: [{ active: "desc" }, { triggeredAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ ok: true, alerts });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const symbol = String(body?.symbol ?? "").trim().toUpperCase();
  const targetPrice = Number(body?.targetPrice);
  const direction = String(body?.direction ?? "");
  const note = body?.note ? String(body.note).trim() : null;

  if (!symbol) {
    return NextResponse.json({ ok: false, error: "no symbol" }, { status: 400 });
  }
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return NextResponse.json({ ok: false, error: "invalid targetPrice" }, { status: 400 });
  }
  if (direction !== "above" && direction !== "below") {
    return NextResponse.json({ ok: false, error: "invalid direction" }, { status: 400 });
  }

  const alert = await prisma.priceAlert.create({
    data: { symbol, targetPrice, direction, note: note || null },
  });
  return NextResponse.json({ ok: true, alert });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "no id" }, { status: 400 });
  }
  await prisma.priceAlert.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
