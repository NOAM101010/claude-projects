import { NextResponse } from "next/server";
import { getCuratedNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { items, generatedAt } = await getCuratedNews();
    return NextResponse.json({ ok: true, items, generatedAt });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
