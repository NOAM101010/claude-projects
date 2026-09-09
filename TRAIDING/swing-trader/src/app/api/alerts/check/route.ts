import { NextResponse } from "next/server";
import { runAlertCheck, runStopCheck } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const [alerts, stops] = await Promise.all([runAlertCheck(), runStopCheck()]);
    return NextResponse.json({
      ok: true,
      triggered: alerts.triggered,
      activeCount: alerts.activeCount,
      closed: stops.closed,
      alerted: stops.alerted,
      stillMonitoring: stops.stillMonitoring,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e), triggered: [], closed: [], alerted: [] },
      { status: 500 }
    );
  }
}
