import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, deleteSetting, type SettingKey } from "@/lib/settings";

const KEYS: SettingKey[] = [
  "discord_webhook_url",
  "morning_brief_enabled",
  "premarket_alert_enabled",
];

export async function GET() {
  const values: Record<string, string | null> = {};
  for (const k of KEYS) {
    values[k] = await getSetting(k);
  }
  return NextResponse.json({ ok: true, settings: values });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const updates: Record<string, string | null> = body?.settings ?? {};
  for (const [k, v] of Object.entries(updates)) {
    if (!KEYS.includes(k as SettingKey)) continue;
    if (v === null || v === "" || v === undefined) {
      await deleteSetting(k as SettingKey);
    } else {
      await setSetting(k as SettingKey, String(v));
    }
  }
  return NextResponse.json({ ok: true });
}
