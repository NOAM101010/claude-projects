import { NextRequest, NextResponse } from "next/server";
import { DISCORD_COMMANDS } from "@/lib/discord-commands";

export const dynamic = "force-dynamic";

/**
 * מאשר את הבקשה אם אחת מ:
 *  - Authorization: Bearer <CRON_SECRET> תקין (ל-curl / cron)
 *  - הבקשה same-origin (Origin/Referer עם אותו host כמו הבקשה) — לכפתור בעמוד ההגדרות
 * זה בטוח: התוצאה של רישום לא-מורשה היא רק רישום-מחדש של הפקודות הקשיחות שלנו
 * (מ-discord-commands.ts) לאפליקציה שלנו עם ה-bot token מ-env — אי אפשר להזריק פקודות
 * זרות או אפליקציה זרה. בנוסף האתר ממילא מאחורי Vercel Auth.
 */
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return true;
  }

  const host = req.headers.get("host");
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (host && source) {
    try {
      return new URL(source).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

async function register(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const appId = process.env.DISCORD_APP_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const missing: string[] = [];
  if (!appId) missing.push("DISCORD_APP_ID");
  if (!botToken) missing.push("DISCORD_BOT_TOKEN");
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, error: `חסרים משתני סביבה: ${missing.join(", ")}`, missing },
      { status: 500 }
    );
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(DISCORD_COMMANDS),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return NextResponse.json(
    {
      ok: res.ok,
      status: res.status,
      scope: guildId ? `guild:${guildId}` : "global",
      registered: Array.isArray(parsed) ? parsed.length : null,
      error: res.ok
        ? null
        : typeof parsed === "string"
          ? parsed
          : JSON.stringify(parsed),
      response: parsed,
    },
    { status: res.ok ? 200 : res.status }
  );
}

export async function POST(req: NextRequest) {
  return register(req);
}
