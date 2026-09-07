import { NextResponse } from "next/server";
import { computeMarketRegime } from "@/lib/market-regime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const regime = await computeMarketRegime();
    return NextResponse.json({ ok: true, regime });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
