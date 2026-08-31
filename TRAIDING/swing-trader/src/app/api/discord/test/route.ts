import { NextRequest, NextResponse } from "next/server";
import { sendDiscord, sendDiscordTo } from "@/lib/discord";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = body?.url as string | undefined;

  const result = url
    ? await sendDiscordTo(
        url,
        null,
        [
          {
            title: "✅ Discord מחובר",
            description: "Swing Terminal יכול לשלוח לך התראות לערוץ הזה. הכל מוכן.",
            color: 0xe8b341,
            timestamp: new Date().toISOString(),
          },
        ]
      )
    : await sendDiscord(
        null,
        [
          {
            title: "✅ Discord מחובר",
            description: "Swing Terminal יכול לשלוח לך התראות לערוץ הזה. הכל מוכן.",
            color: 0xe8b341,
            timestamp: new Date().toISOString(),
          },
        ]
      );

  return NextResponse.json(result);
}
