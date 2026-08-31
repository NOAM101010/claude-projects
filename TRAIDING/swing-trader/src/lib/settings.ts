import { prisma } from "./prisma";

export type SettingKey =
  | "discord_webhook_url"
  | "morning_brief_enabled"
  | "premarket_alert_enabled";

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
