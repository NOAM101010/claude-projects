import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";

export async function POST() {
  const result = await sendPushToAll({
    title: "✅ Swing Trader",
    body: "התראות עובדות! זו הודעת בדיקה.",
    url: "/",
  });
  return NextResponse.json({ ok: true, ...result });
}
