import { NextRequest, NextResponse } from "next/server";
import { runScanner, ScanType } from "@/lib/scanner";
import { sendPushToAll } from "@/lib/push";
import {
  sendToChannel,
  scannerResultsEmbed,
  watchlistAlertEmbed,
} from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { ensureBuiltinProfiles, parseProfileConfig, parseUniverse } from "@/lib/scanner-profiles";
import { SETUPS } from "@/lib/setups";

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

  const profileConfig = parseProfileConfig(profile?.config);
  const universe = parseUniverse(profile?.universe);

  try {
    const result = await runScanner(scanType, profileConfig, universe, profile?.name);
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

    // התראות לרשימת המעקב — חיתוך בין תוצאות הסריקה לסימבולים במעקב
    try {
      const wl = await prisma.watchlist.findMany();
      const wlSet = new Set(wl.map((w) => w.symbol.toUpperCase()));
      for (const m of result.matches) {
        if (!wlSet.has(m.symbol.toUpperCase())) continue;
        await sendToChannel("watchlist", [
          watchlistAlertEmbed(
            m.symbol,
            SETUPS[m.primarySetup]?.label ?? "סטאפ",
            m.grade,
            m.changePercent
          ),
        ]).catch(() => {});
      }
    } catch {
      /* דלג בשקט */
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
