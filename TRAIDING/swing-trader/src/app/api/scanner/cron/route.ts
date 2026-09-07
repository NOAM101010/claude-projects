import { NextRequest, NextResponse } from "next/server";
import { runScanner } from "@/lib/scanner";
import { sendPushToAll } from "@/lib/push";
import { sendDiscordTo, scannerResultsEmbed } from "@/lib/discord";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { ensureBuiltinProfiles, parseProfileConfig, parseUniverse } from "@/lib/scanner-profiles";

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
    // סריקת הבוקר רצה עם פרופיל ברירת המחדל שנשמר ב-DB
    await ensureBuiltinProfiles();
    const profile =
      (await prisma.scannerProfile.findFirst({ where: { isDefault: true } })) ??
      (await prisma.scannerProfile.findFirst());
    const { filters, weights } = parseProfileConfig(profile?.config);
    const universe = parseUniverse(profile?.universe);

    const result = await runScanner("morning", filters, universe, profile?.name, weights);
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
        const embed = scannerResultsEmbed({
          title: `סריקת בוקר — ${result.matches.length} תוצאות`,
          matches: top.map((t) => ({
            symbol: t.symbol,
            price: t.price,
            changePercent: t.changePercent,
            volumeRatio: t.volumeRatio,
            grade: t.grade,
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
