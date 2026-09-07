import { NextRequest, NextResponse } from "next/server";
import { runScanner } from "@/lib/scanner";
import { sendPushToAll } from "@/lib/push";
import {
  sendToChannel,
  scannerResultsEmbed,
  holidayEmbed,
  watchlistAlertEmbed,
} from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { ensureBuiltinProfiles, parseProfileConfig, parseUniverse } from "@/lib/scanner-profiles";
import { getMarketHoliday, nextOpenTextHe } from "@/lib/market-calendar";
import { SETUPS } from "@/lib/setups";

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
    // ימי חג של NYSE — לא סורקים (חוסך גם קריאות Yahoo), רק מודיעים בערוץ updates
    const now = new Date();
    const holiday = getMarketHoliday(now);
    if (holiday) {
      await sendToChannel("updates", [
        holidayEmbed(holiday.nameHe, nextOpenTextHe(now)),
      ]).catch(() => {});
      return NextResponse.json({ ok: true, skipped: "holiday" });
    }

    // סריקת הבוקר רצה עם פרופיל ברירת המחדל שנשמר ב-DB
    await ensureBuiltinProfiles();
    const profile =
      (await prisma.scannerProfile.findFirst({ where: { isDefault: true } })) ??
      (await prisma.scannerProfile.findFirst());
    const profileConfig = parseProfileConfig(profile?.config);
    const universe = parseUniverse(profile?.universe);

    const result = await runScanner("morning", profileConfig, universe, profile?.name);
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
