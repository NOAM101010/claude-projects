import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/stock-analyzer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "חסר סימבול" }, { status: 400 });
  }
  const result = await analyzeStock(symbol);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true, analysis: result });
}
