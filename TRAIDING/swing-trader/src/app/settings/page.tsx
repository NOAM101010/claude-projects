"use client";

import { useEffect, useState } from "react";
import { PageContainer, Eyebrow, Display, Card, Button, Input } from "@/components/ui";
import PushSetup from "@/components/push-setup";
import ScannerProfilesEditor from "@/components/scanner-profiles-editor";
import { MessageCircle, Bell, Radar, CheckCircle2, XCircle, Wallet, ShieldCheck } from "lucide-react";

type Settings = {
  discord_webhook_url: string | null;
  discord_webhook_scan: string | null;
  discord_webhook_analysis: string | null;
  discord_webhook_summary: string | null;
  discord_webhook_updates: string | null;
  discord_webhook_watchlist: string | null;
  account_size: string | null;
  cash_balance: string | null;
  finnhub_api_key: string | null;
  auto_close_on_stop: string | null;
};

type DiscordChannel = {
  key:
    | "discord_webhook_scan"
    | "discord_webhook_analysis"
    | "discord_webhook_summary"
    | "discord_webhook_updates"
    | "discord_webhook_watchlist";
  kind: "scan" | "analysis" | "summary" | "updates" | "watchlist";
  label: string;
};

const DISCORD_CHANNELS: DiscordChannel[] = [
  { key: "discord_webhook_scan", kind: "scan", label: "סריקות (אוטומטי + ידני)" },
  { key: "discord_webhook_analysis", kind: "analysis", label: "ניתוחי מניות" },
  { key: "discord_webhook_summary", kind: "summary", label: "דוחות יום / שבוע" },
  { key: "discord_webhook_updates", kind: "updates", label: "עדכונים / מצב שוק" },
  { key: "discord_webhook_watchlist", kind: "watchlist", label: "רשימת מעקב" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [discordUrl, setDiscordUrl] = useState("");
  const [discordChannels, setDiscordChannels] = useState<Record<string, string>>({});
  const [accountSize, setAccountSize] = useState("");
  const [cashBalance, setCashBalance] = useState("");
  const [finnhubKey, setFinnhubKey] = useState("");
  const [autoCloseOnStop, setAutoCloseOnStop] = useState(true);
  const [savingFinnhub, setSavingFinnhub] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings");
    const json = await res.json();
    if (json.ok) {
      setSettings(json.settings);
      setDiscordUrl(json.settings.discord_webhook_url ?? "");
      setDiscordChannels({
        discord_webhook_scan: json.settings.discord_webhook_scan ?? "",
        discord_webhook_analysis: json.settings.discord_webhook_analysis ?? "",
        discord_webhook_summary: json.settings.discord_webhook_summary ?? "",
        discord_webhook_updates: json.settings.discord_webhook_updates ?? "",
        discord_webhook_watchlist: json.settings.discord_webhook_watchlist ?? "",
      });
      setAccountSize(json.settings.account_size ?? "");
      setCashBalance(json.settings.cash_balance ?? "");
      setFinnhubKey(json.settings.finnhub_api_key ?? "");
      setAutoCloseOnStop(json.settings.auto_close_on_stop !== "false");
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
      body: JSON.stringify({
        settings: {
          discord_webhook_url: discordUrl.trim() || null,
          discord_webhook_scan: (discordChannels.discord_webhook_scan ?? "").trim() || null,
          discord_webhook_analysis: (discordChannels.discord_webhook_analysis ?? "").trim() || null,
          discord_webhook_summary: (discordChannels.discord_webhook_summary ?? "").trim() || null,
          discord_webhook_updates: (discordChannels.discord_webhook_updates ?? "").trim() || null,
          discord_webhook_watchlist: (discordChannels.discord_webhook_watchlist ?? "").trim() || null,
        },
      }),
    });
    flash("נשמר");
    await load();
    setSaving(false);
  }

  async function testDiscordChannel(ch: DiscordChannel) {
    const direct = (discordChannels[ch.key] ?? "").trim();
    const payload = direct ? { url: direct } : { kind: ch.kind };
    setTesting(ch.key);
    const res = await fetch("/api/discord/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    alert(json.ok ? "נשלח! בדוק את הערוץ ב־Discord" : "נכשל: " + json.error);
    setTesting(null);
  }

  async function saveAccount() {
    setSavingAccount(true);
    const clean = (v: string) => {
      const n = v.replace(/[^0-9.]/g, "");
      return n === "" ? null : n;
    };
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: { account_size: clean(accountSize), cash_balance: clean(cashBalance) },
      }),
    });
    flash("חשבון המסחר נשמר");
    await load();
    setSavingAccount(false);
  }

  async function saveFinnhub() {
    setSavingFinnhub(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: { finnhub_api_key: finnhubKey.trim() || null },
      }),
    });
    flash("מפתח Finnhub נשמר");
    await load();
    setSavingFinnhub(false);
  }

  async function saveAutoClose(next: boolean) {
    setAutoCloseOnStop(next);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings: { auto_close_on_stop: next ? "true" : "false" } }),
    });
    flash(next ? "סגירה אוטומטית בסטופ — מופעל" : "סגירה אוטומטית בסטופ — כבוי");
    await load();
  }

  async function testDiscord() {
    if (!discordUrl.trim()) return;
    setTesting("legacy");
    const res = await fetch("/api/discord/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: discordUrl.trim() }),
    });
    const json = await res.json();
    alert(json.ok ? "נשלח! בדוק את הערוץ ב־Discord" : "נכשל: " + json.error);
    setTesting(null);
  }

  const hasDiscord =
    !!settings?.discord_webhook_url ||
    !!settings?.discord_webhook_scan ||
    !!settings?.discord_webhook_analysis ||
    !!settings?.discord_webhook_summary ||
    !!settings?.discord_webhook_updates ||
    !!settings?.discord_webhook_watchlist;

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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--up)]/10 border border-[var(--up)]/30 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[var(--up)]" />
          </div>
          <div>
            <h2 className="text-xl font-black">חשבון המסחר</h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              מזין את הכרטיס הפיננסי ואת תשואת החודש בלוח הבקרה
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)] mb-2">
              גודל חשבון ($)
            </label>
            <Input
              inputMode="decimal"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              placeholder="50000"
              className="mono"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)] mb-2">
              מזומן פנוי (השאר ריק לחישוב אוטומטי מגודל החשבון פחות פוזיציות פתוחות)
            </label>
            <Input
              inputMode="decimal"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              placeholder="חישוב אוטומטי"
              className="mono"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="accent" onClick={saveAccount} disabled={savingAccount}>
            {savingAccount ? "שומר..." : "שמור"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--info)]/10 border border-[var(--info)]/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-[var(--info)]" />
          </div>
          <div>
            <h2 className="text-xl font-black">מפתח Finnhub API</h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              חינם מ-finnhub.io — לחדשות ולוח רווחים
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input
            type="password"
            value={finnhubKey}
            onChange={(e) => setFinnhubKey(e.target.value)}
            placeholder="מפתח Finnhub API"
            className="mono flex-1 min-w-[240px]"
          />
          <Button variant="accent" onClick={saveFinnhub} disabled={savingFinnhub}>
            {savingFinnhub ? "שומר..." : "שמור"}
          </Button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3 leading-relaxed">
          בלי המפתח — עדיין מקבלים כותרות מ-Yahoo, פחות מקורות.
        </p>
      </Card>

      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--down)]/10 border border-[var(--down)]/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[var(--down)]" />
          </div>
          <div>
            <h2 className="text-xl font-black">סטופ = מחיר יציאה</h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              המחיר שנוגע בסטופ סוגר את הפוזיציה אוטומטית
            </div>
          </div>
        </div>
        <label className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-4 flex items-start justify-between gap-3 cursor-pointer">
          <span>
            <span className="text-sm font-bold">סגירה אוטומטית של פוזיציה כשהמחיר נוגע בסטופ</span>
            <span className="block text-[11px] text-[var(--muted)] mt-0.5">
              כשמופעל — ברגע שמחיר השוק של מניה פתוחה נוגע במחיר הסטופ שרשמת, הפוזיציה נסגרת
              במחיר הסטופ וכל הנתונים מתעדכנים. כשכבוי — הפוזיציה לא נסגרת אוטומטית, ולא
              נשלחת התראה. עדיין תופיע אזהרת &quot;קרוב לסטופ&quot; בלוח הבקרה.
            </span>
          </span>
          <input
            type="checkbox"
            checked={autoCloseOnStop}
            onChange={(e) => saveAutoClose(e.target.checked)}
            className="w-4 h-4 accent-[var(--up)] mt-0.5"
          />
        </label>
      </Card>

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
          <p><b className="text-[var(--fg)]">מה זה?</b> כתובות webhook נפרדות לכל סוג התראה — סריקות, ניתוחים, דוחות. כל אחת יכולה להגיע לערוץ אחר ב-Discord.</p>
          <p><b>איך:</b> 1. פתח שרת ב-Discord 2. צור ערוץ 3. Settings → Integrations → Webhooks → New → Copy URL 4. הדבק כאן.</p>
          <p className="text-xs text-[var(--muted)]">השאר ריק כדי להשתמש ב-webhook הכללי.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)] mb-2">
              כללי (fallback) — משמש כשאין webhook ספציפי
            </label>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="mono flex-1 min-w-[240px]"
              />
              <Button variant="outline" onClick={testDiscord} disabled={testing === "legacy" || !discordUrl.trim()}>
                {testing === "legacy" ? "שולח..." : "בדוק"}
              </Button>
            </div>
          </div>

          {DISCORD_CHANNELS.map((ch) => (
            <div key={ch.key}>
              <label className="block text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)] mb-2">
                {ch.label}
              </label>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={discordChannels[ch.key] ?? ""}
                  onChange={(e) =>
                    setDiscordChannels((s) => ({ ...s, [ch.key]: e.target.value }))
                  }
                  placeholder="ריק = webhook כללי"
                  className="mono flex-1 min-w-[240px]"
                />
                <Button
                  variant="outline"
                  onClick={() => testDiscordChannel(ch)}
                  disabled={testing === ch.key}
                >
                  {testing === ch.key ? "שולח..." : "בדוק"}
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button variant="accent" onClick={saveDiscord} disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
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
            <h2 className="text-xl font-black">פרופילי הסורק · פילטרים ומשקלים</h2>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              מי נכנס לתוצאות, וכמה כל אות שווה בניקוד
            </div>
          </div>
        </div>
        <ScannerProfilesEditor onFlash={flash} />
      </Card>
    </PageContainer>
  );
}
