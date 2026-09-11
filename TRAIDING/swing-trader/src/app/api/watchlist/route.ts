import { NextRequest, NextResponse } from "next/server";
import { addToWatchlist, removeFromWatchlist } from "@/lib/watchlist";

export async function POST(req: NextRequest) {
  const { symbol, folderId, notes } = await req.json();
  const s = String(symbol ?? "").trim().toUpperCase();
  if (!s) return NextResponse.json({ ok: false, error: "no symbol" }, { status: 400 });

  const { id } = await addToWatchlist(s, folderId, notes);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const { id, symbol } = await req.json();
  await removeFromWatchlist({ id, symbol });
  return NextResponse.json({ ok: true });
}
