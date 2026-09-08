import { NextResponse } from "next/server";
import { runAlertCheck } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await runAlertCheck();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e), triggered: [] },
      { status: 500 }
    );
  }
}
