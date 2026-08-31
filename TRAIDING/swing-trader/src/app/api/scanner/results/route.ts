import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const lastRun = await prisma.scannerRun.findFirst({
      orderBy: { startedAt: "desc" },
      where: { status: "success" },
    });

    if (!lastRun) {
      return NextResponse.json({
        ok: true,
        results: [],
        lastRunAt: null,
        totalScanned: 0,
      });
    }

    const results = await prisma.scannerResult.findMany({
      where: { runId: lastRun.id },
      orderBy: [{ score: "desc" }, { changePercent: "desc" }],
    });

    return NextResponse.json({
      ok: true,
      results,
      lastRunAt: lastRun.startedAt.toISOString(),
      totalScanned: lastRun.totalScanned,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
