import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { symbol, folderId, notes } = await req.json();
  const s = String(symbol ?? "").trim().toUpperCase();
  if (!s) return NextResponse.json({ ok: false, error: "no symbol" }, { status: 400 });

  const existing = await prisma.watchlist.findFirst({
    where: { symbol: s, folderId: folderId ?? null },
  });
  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id });
  }

  const item = await prisma.watchlist.create({
    data: { symbol: s, folderId: folderId ?? null, notes: notes ?? null },
  });
  return NextResponse.json({ ok: true, id: item.id });
}

export async function DELETE(req: NextRequest) {
  const { id, symbol } = await req.json();
  if (id) {
    await prisma.watchlist.delete({ where: { id } });
  } else if (symbol) {
    await prisma.watchlist.deleteMany({ where: { symbol: String(symbol).toUpperCase() } });
  }
  return NextResponse.json({ ok: true });
}
