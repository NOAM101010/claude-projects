import { NextRequest, NextResponse } from "next/server";
import {
  sendDiscord,
  sendDiscordTo,
  resolveChannelWebhook,
  type DiscordChannelKind,
} from "@/lib/discord";

const KIND_LABEL: Record<DiscordChannelKind, string> = {
  scan: "סריקות",
  analysis: "ניתוחי מניות",
  summary: "דוחות יום/שבוע",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = body?.url as string | undefined;
  const kind = body?.kind as DiscordChannelKind | undefined;

  const embed = {
    title: "✅ Discord מחובר",
    description: kind
      ? `ערוץ ${KIND_LABEL[kind]} מחובר. Swing Terminal ישלח לכאן.`
      : "Swing Terminal יכול לשלוח לך התראות לערוץ הזה. הכל מוכן.",
    color: 0xe8b341,
    footer: { text: "Swing Terminal" },
    timestamp: new Date().toISOString(),
  };

  let result;
  if (url && url.trim()) {
    result = await sendDiscordTo(url.trim(), null, [embed]);
  } else if (kind) {
    const resolved = await resolveChannelWebhook(kind);
    result = resolved
      ? await sendDiscordTo(resolved, null, [embed])
      : { ok: false, error: "לא הוגדר webhook לערוץ הזה (גם לא כללי)" };
  } else {
    result = await sendDiscord(null, [embed]);
  }

  return NextResponse.json(result);
}
