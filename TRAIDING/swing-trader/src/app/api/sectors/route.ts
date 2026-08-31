import { NextResponse } from "next/server";
import { yf } from "@/lib/yf";
import { SECTORS } from "@/lib/sectors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await Promise.all(
      SECTORS.map(async (s) => {
        try {
          const q: any = await yf.quote(s.etf);
          return {
            ...s,
            price: (q?.regularMarketPrice as number) ?? null,
            changePercent: (q?.regularMarketChangePercent as number) ?? null,
          };
        } catch {
          return { ...s, price: null, changePercent: null };
        }
      })
    );
    return NextResponse.json({ ok: true, sectors: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
