import { NextRequest, NextResponse } from "next/server";
import { runScanner, ScanType } from "@/lib/scanner";
import { sendPushToAll } from "@/lib/push";
import { sendDiscordTo, scannerResultsEmbed } from "@/lib/discord";
import { getSetting } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { ensureBuiltinProfiles, mergeConfig, parseUniverse } from "@/lib/scanner-profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function scoreToGrade(score: number): string {
  if (score >= 110) return "A";
  if (score >= 80) return "B";
  if (score >= 55) return "C";
  if (score >= 30) return "D";
  return "F";
}

export async function POST(req: NextRequest) {
  const scanType = (req.nextUrl.searchParams.get("type") as ScanType) ?? "morning";
  const profileId = req.nextUrl.searchParams.get("profileId");

  await ensureBuiltinProfiles();

  const profile = profileId
    ? await prisma.scannerProfile.findUnique({ where: { id: profileId } })
    : await prisma.scannerProfile.findFirst({ where: { isDefault: true } }) ??
      (await prisma.scannerProfile.findFirst());

  const cfg = mergeConfig(profile?.config);
  const universe = parseUniverse(profile?.universe);

  try {
    const result = await runScanner(scanType, cfg, universe, profile?.name);
    const top = result.matches.slice(0, 8);

    if (top.length > 0) {
      const label = profile?.name ? `[${profile.name}] ` : "";
      const title = `${label}סריקה — ${result.matches.length} תוצאות`;
      const body = top
        .map(
          (t) =>
            `${t.symbol} ${t.changePercent != null ? (t.changePercent >= 0 ? "+" : "") + t.changePercent.toFixed(1) + "%" : ""}`
        )
        .join(" · ");

      await sendPushToAll({
        title,
        body,
        url: "/scanner",
      }).catch(() => {});

      const discordUrl = await getSetting("discord_webhook_url");
      if (discordUrl) {
        const embed = scannerResultsEmbed({
          title,
          matches: top.map((t) => ({
            symbol: t.symbol,
            price: t.price,
            changePercent: t.changePercent,
            volumeRatio: t.volumeRatio,
            grade: scoreToGrade(t.score),
            setups: t.matchedSetups,
          })),
          totalScanned: result.totalScanned,
          scanType,
        });
        await sendDiscordTo(discordUrl, null, [embed]).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      profile: profile?.name ?? null,
      totalMatches: result.matches.length,
      matches: result.matches.map((m) => m.symbol),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
