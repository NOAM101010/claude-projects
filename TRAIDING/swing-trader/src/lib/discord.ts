import { getSetting, type SettingKey } from "./settings";

const AMBER = 0xe8b341;
const UP = 0x4ade80;
const DOWN = 0xf87171;

export const FOOTER = { text: "Swing Terminal" };

export function gradeColor(grade: string | null | undefined): number {
  switch ((grade ?? "").toUpperCase()) {
    case "A":
    case "B":
      return UP;
    case "C":
      return AMBER;
    case "D":
    case "F":
      return DOWN;
    default:
      return AMBER;
  }
}

export type DiscordChannelKind = "scan" | "analysis" | "summary";

const CHANNEL_KEY: Record<DiscordChannelKind, SettingKey> = {
  scan: "discord_webhook_scan",
  analysis: "discord_webhook_analysis",
  summary: "discord_webhook_summary",
};

/**
 * Resolves the webhook URL for a channel kind:
 * specific key → legacy discord_webhook_url fallback → null (skip silently).
 */
export async function resolveChannelWebhook(
  kind: DiscordChannelKind
): Promise<string | null> {
  const specific = (await getSetting(CHANNEL_KEY[kind]))?.trim();
  if (specific) return specific;
  const legacy = (await getSetting("discord_webhook_url"))?.trim();
  return legacy || null;
}

/**
 * Sends embeds to the resolved webhook for a channel kind. If no webhook is
 * configured for that kind (and no legacy fallback) it skips silently.
 */
export async function sendToChannel(
  kind: DiscordChannelKind,
  embeds: DiscordEmbed[],
  content: string | null = null
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const url = await resolveChannelWebhook(kind);
  if (!url) return { ok: false, skipped: true };
  return sendDiscordTo(url, content, embeds);
}

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
      text: `Swing Terminal · סרוקות ${totalScanned} · תואמות ${matches.length}`,
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
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formatted embed for a single-stock analysis (used by /api/analyze).
 */
export function stockAnalysisEmbed(opts: {
  symbol: string;
  name?: string | null;
  price?: number | null;
  changePercent?: number | null;
  grade: string;
  score: number;
  verdict: string;
  signals: { label: string; value: string; tone: string; weight?: number }[];
  suggestedStop?: number | null;
}): DiscordEmbed {
  const toneIcon = (t: string) =>
    t === "bullish" || t === "up" ? "🟢" : t === "bearish" || t === "down" ? "🔴" : "⚪";
  const top = [...opts.signals]
    .sort((a, b) => Math.abs(b.weight ?? 0) - Math.abs(a.weight ?? 0))
    .slice(0, 4);

  const fields: DiscordEmbed["fields"] = [
    { name: "ציון", value: `${opts.grade} · ${opts.score}/100`, inline: true },
  ];
  if (opts.price != null) {
    const chg =
      opts.changePercent != null
        ? ` (${opts.changePercent >= 0 ? "+" : ""}${opts.changePercent.toFixed(1)}%)`
        : "";
    fields.push({ name: "מחיר", value: `$${opts.price}${chg}`, inline: true });
  }
  if (opts.suggestedStop != null)
    fields.push({ name: "סטופ מוצע", value: `$${opts.suggestedStop}`, inline: true });
  if (top.length)
    fields.push({
      name: "אותות מובילים",
      value: top.map((s) => `${toneIcon(s.tone)} **${s.label}** — ${s.value}`).join("\n"),
    });

  return {
    title: `${opts.symbol}${opts.name ? ` · ${opts.name}` : ""} — ניתוח`,
    description: opts.verdict,
    color: gradeColor(opts.grade),
    fields,
    url: `https://www.tradingview.com/chart/?symbol=${opts.symbol}`,
    footer: FOOTER,
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
