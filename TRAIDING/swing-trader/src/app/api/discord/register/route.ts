import { NextRequest, NextResponse } from "next/server";
import { DISCORD_COMMANDS } from "@/lib/discord-commands";

export const dynamic = "force-dynamic";

async function register(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const appId = process.env.DISCORD_APP_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !botToken) {
    return NextResponse.json(
      { error: "חסר DISCORD_APP_ID או DISCORD_BOT_TOKEN" },
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
      response: parsed,
    },
    { status: res.ok ? 200 : res.status }
  );
}

export async function POST(req: NextRequest) {
  return register(req);
}
