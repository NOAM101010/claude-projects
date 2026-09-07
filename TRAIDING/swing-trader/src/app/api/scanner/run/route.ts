import { NextRequest, NextResponse } from "next/server";
import { runScanner, ScanType } from "@/lib/scanner";
import { sendPushToAll } from "@/lib/push";
import { sendToChannel, scannerResultsEmbed } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { ensureBuiltinProfiles, parseProfileConfig, parseUniverse } from "@/lib/scanner-profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const scanType = (req.nextUrl.searchParams.get("type") as ScanType) ?? "morning";
  const profileId = req.nextUrl.searchParams.get("profileId");

  await ensureBuiltinProfiles();

  const profile = profileId
    ? await prisma.scannerProfile.findUnique({ where: { id: profileId } })
    : await prisma.scannerProfile.findFirst({ where: { isDefault: true } }) ??
      (await prisma.scannerProfile.findFirst());

  const { filters, weights } = parseProfileConfig(profile?.config);
  const universe = parseUniverse(profile?.universe);

  try {
    const result = await runScanner(scanType, filters, universe, profile?.name, weights);
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

      const embed = scannerResultsEmbed({
        title,
        matches: top.map((t) => ({
          symbol: t.symbol,
          price: t.price,
          changePercent: t.changePercent,
          volumeRatio: t.volumeRatio,
          grade: t.grade,
          setups: t.matchedSetups,
        })),
        totalScanned: result.totalScanned,
        scanType,
      });
      await sendToChannel("scan", [embed]).catch(() => {});
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
