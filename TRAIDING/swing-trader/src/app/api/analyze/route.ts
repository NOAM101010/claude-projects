import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/stock-analyzer";
import { sendToChannel, stockAnalysisEmbed } from "@/lib/discord";

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

  // התראת Discord לערוץ הניתוחים (specific → fallback → דלג בשקט)
  sendToChannel("analysis", [
    stockAnalysisEmbed({
      symbol: result.symbol,
      name: result.name,
      price: result.price,
      changePercent: result.changePercent,
      grade: result.grade,
      score: result.score,
      verdict: result.verdict,
      signals: result.signals,
      suggestedStop: result.keyLevels.suggestedStop,
    }),
  ]).catch(() => {});

  return NextResponse.json({ ok: true, analysis: result });
}
