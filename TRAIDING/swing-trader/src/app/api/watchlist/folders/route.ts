import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const folders = await prisma.watchlistFolder.findMany({
    orderBy: { name: "asc" },
    include: { items: true },
  });
  return NextResponse.json({ ok: true, folders });
}

export async function POST(req: NextRequest) {
  const { name, color } = await req.json();
  const n = String(name ?? "").trim();
  if (!n) return NextResponse.json({ ok: false, error: "no name" }, { status: 400 });

  const folder = await prisma.watchlistFolder.create({
    data: { name: n, color: color ?? null },
  });
  return NextResponse.json({ ok: true, folder });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "no id" }, { status: 400 });
  await prisma.watchlistFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
