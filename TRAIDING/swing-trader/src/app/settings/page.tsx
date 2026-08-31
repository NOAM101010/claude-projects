"use client";

import { useEffect, useState } from "react";
import { PageContainer, Eyebrow, Display, Card, Button, Input } from "@/components/ui";
import PushSetup from "@/components/push-setup";
import { MessageCircle, Bell, Radar, CheckCircle2, XCircle } from "lucide-react";

type Settings = {
  discord_webhook_url: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [discordUrl, setDiscordUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings");
    const json = await res.json();
    if (json.ok) {
      setSettings(json.settings);
      setDiscordUrl(json.settings.discord_webhook_url ?? "");
    }
  }
  useEffect(() => { load(); }, []);

  function flash(msg: string) {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 3000);
  }

  async function saveDiscord() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: { discord_webhook_url: discordUrl.trim() || null } }),
    });
    flash("נשמר");
    await load();
    setSaving(false);
  }

  async function testDiscord() {
    if (!discordUrl.trim()) return;
    setTestingDiscord(true);
    const res = await fetch("/api/discord/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: discordUrl.trim() }),
    });
    const json = await res.json();
    alert(json.ok ? "נשלח! בדוק את הערוץ ב־Discord" : "נכשל: " + json.error);
    setTestingDiscord(false);
  }

  const hasDiscord = !!settings?.discord_webhook_url;

  return (
    <PageContainer className="space-y-10">
      <section>
        <Eyebrow>Settings</Eyebrow>
        <Display className="mt-3">
          חיבורים<br /><span className="trend-up-glow">והגדרות.</span>
        </Display>
      </section>

      {savedFlash && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-5 py-2.5 border border-[var(--up)]/40 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--up)]" />
          <span className="text-sm">{savedFlash}</span>
        </div>
      )}

      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[#7289DA]" />
          </div>
          <div>
            <h2 className="text-xl font-black">Discord Webhook · חינם</h2>
            <div className="flex items-center gap-2 text-xs mt-0.5">
              {hasDiscord ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-[var(--up)]" /><span className="text-[var(--up)]">מחובר</span></>
              ) : (
                <><XCircle className="w-3.5 h-3.5 text-[var(--muted)]" /><span className="text-[var(--muted)]">לא מחובר</span></>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 mb-5 p-4 rounded-xl bg-white/[0.02] border border-[var(--border)] text-sm text-[var(--fg-dim)] leading-relaxed space-y-2">
          <p><b className="text-[var(--fg)]">מה זה?</b> כתובת URL שאני שולח אליה התראות — סורק בוקר, ניתוחים. יופיע כהודעה בערוץ ב-Discord.</p>
          <p><b>איך:</b> 1. פתח שרת ב-Discord 2. צור ערוץ (#trades) 3. Settings → Integrations → Webhooks → New → Copy URL 4. הדבק כאן.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Input
            value={discordUrl}
            onChange={(e) => setDiscordUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="mono flex-1 min-w-[240px]"
          />
          <Button variant="outline" onClick={testDiscord} disabled={testingDiscord || !discordUrl.trim()}>
            {testingDiscord ? "שולח..." : "בדוק"}
          </Button>
          <Button variant="accent" onClick={saveDiscord} disabled={saving}>שמור</Button>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--warn)]/10 border border-[var(--warn)]/30 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[var(--warn)]" />
          </div>
          <div>
            <h2 className="text-xl font-black">התראות Push · חינם</h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">התראות למכשיר + סריקה אוטומטית ב-13:00</div>
          </div>
        </div>
        <PushSetup />
      </Card>

      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--info)]/10 border border-[var(--info)]/30 flex items-center justify-center">
            <Radar className="w-5 h-5 text-[var(--info)]" />
          </div>
          <div>
            <h2 className="text-xl font-black">קריטריוני הסורק · חינם</h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">Large Cap breakouts</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm mt-4">
          <Row label="Market Cap min" value="$5B" />
          <Row label="נפח יומי min" value="1M" />
          <Row label="קרבה ל־ATH" value="≤3%" />
          <Row label="Gap Up min" value="2%" />
          <Row label="Volume Spike" value="1.5x" />
          <Row label="Cup & Handle" value="פעיל" />
          <Row label="RSI Range" value="50-80" />
          <Row label="MA150 Distance" value="חישוב אוטומטי" />
        </div>
      </Card>
    </PageContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between p-2.5 rounded-lg bg-white/[0.03] border border-[var(--border)]">
      <span className="text-[var(--muted)] text-xs">{label}</span>
      <span className="mono font-bold text-sm">{value}</span>
    </div>
  );
}
