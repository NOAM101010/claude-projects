import { prisma } from "./prisma";

export type SettingKey =
  | "discord_webhook_url"
  | "discord_webhook_scan"
  | "discord_webhook_analysis"
  | "discord_webhook_summary"
  | "discord_webhook_updates"
  | "discord_webhook_watchlist"
  | "discord_watchlist_message_id"
  | "morning_brief_enabled"
  | "premarket_alert_enabled"
  | "auto_close_on_stop"
  | "account_size"
  | "cash_balance"
  | "finnhub_api_key";

export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  await prisma.setting.deleteMany({ where: { key } });
}

export function maskKey(v: string | null): string {
  if (!v) return "";
  if (v.length <= 12) return "•".repeat(v.length);
  return v.slice(0, 8) + "•".repeat(Math.max(4, v.length - 12)) + v.slice(-4);
}
