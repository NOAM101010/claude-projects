import { getSetting } from "./settings";

const AMBER = 0xe8b341;
const UP = 0x4ade80;
const DOWN = 0xf87171;

export type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
  thumbnail?: { url: string };
  image?: { url: string };
};

export async function sendDiscord(
  content: string | null,
  embeds?: DiscordEmbed[]
): Promise<{ ok: boolean; error?: string }> {
  const url = await getSetting("discord_webhook_url");
  if (!url) return { ok: false, error: "no webhook configured" };
  return sendDiscordTo(url, content, embeds);
}

export async function sendDiscordTo(
  webhookUrl: string,
  content: string | null,
  embeds?: DiscordEmbed[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = {
      content,
      embeds: embeds ?? [],
      username: "Swing Terminal",
    };
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/**
 * Formatted scanner-results embed for Discord.
 */
export function scannerResultsEmbed(opts: {
  title: string;
  matches: {
    symbol: string;
    price: number | null;
    changePercent: number | null;
    volumeRatio: number | null;
    grade: string | null;
    setups: string[];
  }[];
  totalScanned: number;
  scanType: string;
}): DiscordEmbed {
  const { title, matches, totalScanned } = opts;
  const top = matches.slice(0, 10);

  const description = top.length
    ? top
        .map((m, i) => {
          const chg = m.changePercent != null
            ? `${m.changePercent >= 0 ? "▲" : "▼"} ${m.changePercent.toFixed(1)}%`
            : "";
          const vol = m.volumeRatio ? `Vol ${m.volumeRatio.toFixed(1)}x` : "";
          const grade = m.grade ? `\`${m.grade}\`` : "";
          const setups = m.setups.slice(0, 2).join(" · ");
          return `**${i + 1}. [${m.symbol}](https://www.tradingview.com/chart/?symbol=${m.symbol})** ${grade} — ${chg}  ${vol}\n${setups}`;
        })
        .join("\n\n")
    : "אין תוצאות עם הקריטריונים הנוכחיים.";

  return {
    title,
    description,
    color: AMBER,
    footer: {
      text: `סרוקות ${totalScanned} · תואמות ${matches.length}`,
    },
    timestamp: new Date().toISOString(),
  };
}

export function tradeAnalysisEmbed(opts: {
  symbol: string | null;
  grade: string;
  score: number;
  setup: string | null;
  reasoning: string;
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  rr?: number | null;
  imageUrl?: string;
}): DiscordEmbed {
  const gradeColors: Record<string, number> = {
    A: UP,
    B: 0x86efac,
    C: AMBER,
    D: 0xfb923c,
    F: DOWN,
  };
  const fields: DiscordEmbed["fields"] = [];
  if (opts.entry != null) fields.push({ name: "כניסה", value: `$${opts.entry}`, inline: true });
  if (opts.stop != null) fields.push({ name: "סטופ", value: `$${opts.stop}`, inline: true });
  if (opts.target != null) fields.push({ name: "יעד", value: `$${opts.target}`, inline: true });
  if (opts.rr != null) fields.push({ name: "R:R", value: `1:${opts.rr.toFixed(2)}`, inline: true });
  if (opts.setup) fields.push({ name: "סטאפ", value: opts.setup, inline: true });

  return {
    title: `${opts.symbol ?? "טרייד"} — ציון ${opts.grade} (${opts.score}/100)`,
    description: opts.reasoning,
    color: gradeColors[opts.grade] ?? AMBER,
    fields,
    image: opts.imageUrl ? { url: opts.imageUrl } : undefined,
    timestamp: new Date().toISOString(),
  };
}

export function morningBriefEmbed(opts: {
  headline: string;
  body: string;
  matches: { symbol: string; grade: string | null }[];
}): DiscordEmbed {
  return {
    title: `☀️ ${opts.headline}`,
    description: opts.body,
    color: AMBER,
    fields: [
      {
        name: "מובילים",
        value: opts.matches
          .slice(0, 8)
          .map((m) => `${m.grade ? `\`${m.grade}\`` : ""} **${m.symbol}**`)
          .join(" · ") || "—",
      },
    ],
    timestamp: new Date().toISOString(),
  };
}
