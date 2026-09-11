import { after } from "next/server";
import { verifyKey } from "discord-interactions";
import type { DiscordEmbed } from "@/lib/discord";
import {
  priceEmbed,
  positionsEmbed,
  scanEmbed,
  performanceEmbed,
  createAlertEmbed,
  analyzeEmbed,
  watchlistCommandEmbed,
  newsEmbed,
  helpEmbed,
  errorEmbed,
} from "@/lib/discord-bot";

export const dynamic = "force-dynamic";

// סוגי אינטראקציה / תגובה של Discord
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;

// פקודות שדורשות רשת/DB — נענות ב-DEFERRED ואז נערכות דרך webhook
const DEFERRED_COMMANDS = new Set([
  "מחיר",
  "פוזיציות",
  "סריקה",
  "ביצועים",
  "התראה",
  "נתח",
  "מעקב",
  "חדשות",
]);

type CommandOption = { name: string; value: string | number | boolean };

function opt(
  options: CommandOption[] | undefined,
  name: string
): string | number | undefined {
  const found = options?.find((o) => o.name === name);
  return found?.value as string | number | undefined;
}

export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    note: "Discord interactions endpoint. POST only for real use.",
    env: {
      DISCORD_PUBLIC_KEY: !!process.env.DISCORD_PUBLIC_KEY,
      DISCORD_PUBLIC_KEY_len: (process.env.DISCORD_PUBLIC_KEY ?? "").trim().length,
      DISCORD_APP_ID: !!process.env.DISCORD_APP_ID,
      DISCORD_BOT_TOKEN: !!process.env.DISCORD_BOT_TOKEN,
      DISCORD_GUILD_ID: !!process.env.DISCORD_GUILD_ID,
    },
  });
}

async function editOriginal(token: string, embed: DiscordEmbed): Promise<void> {
  const appId = process.env.DISCORD_APP_ID?.trim();
  if (!appId) return;
  try {
    await fetch(
      `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      }
    );
  } catch {
    /* אין מה לעשות — התגובה הראשונית כבר נשלחה */
  }
}

async function resolveCommandEmbed(
  name: string,
  options: CommandOption[] | undefined
): Promise<DiscordEmbed> {
  switch (name) {
    case "מחיר":
      return priceEmbed(String(opt(options, "symbol") ?? ""));
    case "פוזיציות":
      return positionsEmbed();
    case "סריקה":
      return scanEmbed();
    case "ביצועים":
      return performanceEmbed();
    case "התראה":
      return createAlertEmbed(
        String(opt(options, "symbol") ?? ""),
        Number(opt(options, "מחיר")),
        String(opt(options, "כיוון") ?? "")
      );
    case "נתח":
      return analyzeEmbed(String(opt(options, "symbol") ?? ""));
    case "מעקב":
      return watchlistCommandEmbed(
        String(opt(options, "פעולה") ?? ""),
        String(opt(options, "symbol") ?? "")
      );
    case "חדשות": {
      const sym = opt(options, "symbol");
      return newsEmbed(sym != null ? String(sym) : undefined);
    }
    default:
      return errorEmbed("פקודה לא מוכרת.");
  }
}

export async function POST(req: Request): Promise<Response> {
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const raw = await req.text();

  if (!publicKey || !signature || !timestamp) {
    return new Response("bad signature", { status: 401 });
  }

  let valid = false;
  try {
    valid = await verifyKey(raw, signature, timestamp, publicKey);
  } catch {
    valid = false;
  }
  if (!valid) return new Response("bad signature", { status: 401 });

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // PING → PONG
  if (body.type === PING) {
    return Response.json({ type: PONG });
  }

  if (body.type === APPLICATION_COMMAND) {
    const name: string = body.data?.name ?? "";
    const options: CommandOption[] | undefined = body.data?.options;

    try {
      if (name === "עזרה") {
        return Response.json({
          type: CHANNEL_MESSAGE,
          data: { embeds: [helpEmbed()] },
        });
      }

      if (!process.env.DISCORD_APP_ID) {
        return Response.json({
          type: CHANNEL_MESSAGE,
          data: {
            embeds: [errorEmbed("הבוט לא מוגדר (חסר DISCORD_APP_ID).")],
          },
        });
      }

      if (DEFERRED_COMMANDS.has(name)) {
        const token: string = body.token;
        after(async () => {
          let embed: DiscordEmbed;
          try {
            embed = await resolveCommandEmbed(name, options);
          } catch (e: any) {
            embed = errorEmbed(e?.message ?? "שגיאה בביצוע הפקודה.");
          }
          await editOriginal(token, embed);
        });
        return Response.json({ type: DEFERRED_CHANNEL_MESSAGE });
      }

      return Response.json({
        type: CHANNEL_MESSAGE,
        data: { embeds: [errorEmbed("פקודה לא מוכרת.")] },
      });
    } catch (e: any) {
      // נסה follow-up "שגיאה" במקום לקרוס
      const token: string | undefined = body.token;
      if (token && process.env.DISCORD_APP_ID) {
        after(() =>
          editOriginal(token, errorEmbed(e?.message ?? "שגיאה לא צפויה."))
        );
        return Response.json({ type: DEFERRED_CHANNEL_MESSAGE });
      }
      return Response.json({
        type: CHANNEL_MESSAGE,
        data: { embeds: [errorEmbed(e?.message ?? "שגיאה לא צפויה.")] },
      });
    }
  }

  return Response.json({ type: PONG });
}
