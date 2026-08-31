import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "VAPID keys not configured. הרץ: npm run generate-vapid ואז שים בקובץ .env",
      },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, publicKey: key });
}
