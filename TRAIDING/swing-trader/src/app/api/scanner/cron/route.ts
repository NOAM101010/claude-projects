import { NextRequest, NextResponse } from "next/server";
import { runScanner } from "@/lib/scanner";
import { sendPushToAll } from "@/lib/push";
import { sendDiscordTo, scannerResultsEmbed } from "@/lib/discord";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScanner("morning");
    const top = result.matches.slice(0, 10);

    if (top.length > 0) {
      const body = top
        .map(
          (t) =>
            `${t.symbol} ${t.changePercent != null ? (t.changePercent >= 0 ? "+" : "") + t.changePercent.toFixed(1) + "%" : ""}`
        )
        .join(" · ");

      await sendPushToAll({
        title: `סריקת בוקר — ${result.matches.length} תוצאות`,
        body,
        url: "/scanner",
      }).catch(() => {});

      const discordUrl = await getSetting("discord_webhook_url");
      if (discordUrl) {
        function scoreToGrade(score: number): string {
          if (score >= 110) return "A";
          if (score >= 80) return "B";
          if (score >= 55) return "C";
          if (score >= 30) return "D";
          return "F";
        }

        const embed = scannerResultsEmbed({
          title: `סריקת בוקר — ${result.matches.length} תוצאות`,
          matches: top.map((t) => ({
            symbol: t.symbol,
            price: t.price,
            changePercent: t.changePercent,
            volumeRatio: t.volumeRatio,
            grade: scoreToGrade(t.score),
            setups: t.matchedSetups,
          })),
          totalScanned: result.totalScanned,
          scanType: "morning",
        });
        await sendDiscordTo(discordUrl, null, [embed]).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      totalScanned: result.totalScanned,
      totalMatches: result.matches.length,
      top: top.map((t) => t.symbol),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
