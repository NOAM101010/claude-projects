import { NextRequest, NextResponse, after } from "next/server";
import { analyzeStock } from "@/lib/stock-analyzer";
import { sendToChannel, stockAnalysisEmbed } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "חסר סימבול" }, { status: 400 });
  }
  const setup = req.nextUrl.searchParams.get("setup");
  const result = await analyzeStock(symbol, { setupId: setup });
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  // התראת Discord לערוץ הניתוחים. רצה אחרי שהתגובה נשלחה, אבל ה-runtime
  // נשאר חי עד שהיא מסתיימת — fire-and-forget לבד נהרג ב-serverless של Vercel.
  after(async () => {
    try {
      await sendToChannel("analysis", [
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
          setupLabel: result.setupLabel,
          patternValid: result.patternValid,
        }),
      ]);
    } catch {
      /* דלג בשקט */
    }
  });

  return NextResponse.json({ ok: true, analysis: result });
}
