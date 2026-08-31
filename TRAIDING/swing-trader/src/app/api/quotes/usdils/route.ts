import { NextResponse } from "next/server";
import { yf } from "@/lib/yf";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const q: any = await yf.quote("USDILS=X");
    const rate = (q?.regularMarketPrice as number) ?? null;
    return NextResponse.json({ ok: true, rate });
  } catch (e: any) {
    return NextResponse.json({ ok: true, rate: 3.65 });
  }
}
