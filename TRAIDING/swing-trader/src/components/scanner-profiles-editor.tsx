"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SCANNER_CONFIG,
  normalizeProfileConfig,
  type ProfileConfig,
  type ScannerConfig,
} from "@/lib/scanner-config";
import { SIGNAL_KEYS, SIGNAL_LABELS, type SignalKey } from "@/lib/scoring";
import { Copy, Save, Star, Trash2 } from "lucide-react";

type Profile = {
  id: string;
  name: string;
  description: string | null;
  config: string;
  universe: string | null;
  isDefault: boolean;
};

type FilterField = {
  key: keyof ScannerConfig;
  label: string;
  step?: number;
  suffix?: string;
};

const FILTER_FIELDS: FilterField[] = [
  { key: "minMarketCap", label: "שווי שוק מינימלי", step: 100_000_000, suffix: "$" },
  { key: "minAvgVolume", label: "נפח יומי ממוצע מינימלי", step: 50_000 },
  { key: "minPrice", label: "מחיר מינימלי", step: 1, suffix: "$" },
  { key: "maxAtrPercent", label: "ATR מקסימלי", step: 0.5, suffix: "%" },
  { key: "nearAthPercent", label: "קרבה ל־ATH", step: 0.5, suffix: "%" },
  { key: "near52wHighPercent", label: "קרבה לשיא 52W", step: 0.5, suffix: "%" },
  { key: "gapUpMin", label: "Gap Up מינימלי", step: 0.5, suffix: "%" },
  { key: "volumeSpikeRatio", label: "יחס זינוק ווליום", step: 0.1, suffix: "×" },
  { key: "minRsi", label: "RSI מינימלי", step: 1 },
  { key: "maxRsi", label: "RSI מקסימלי", step: 1 },
];

function parseUniverseText(text: string): string[] | null {
  const list = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return list.length ? Array.from(new Set(list)) : null;
}

export default function ScannerProfilesEditor({ onFlash }: { onFlash?: (msg: string) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<ProfileConfig>(normalizeProfileConfig(null));
  const [universeText, setUniverseText] = useState("");
  const [busy, setBusy] = useState(false);

  const applyProfile = useCallback((p: Profile) => {
    setSelectedId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    setConfig(normalizeProfileConfig(p.config));
    let universe: string[] = [];
    try {
      const arr = p.universe ? JSON.parse(p.universe) : [];
      if (Array.isArray(arr)) universe = arr.map(String);
    } catch {}
    setUniverseText(universe.join(", "));
  }, []);

  const load = useCallback(
    async (preferId?: string) => {
      const res = await fetch("/api/profiles", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) return;
      const list: Profile[] = json.profiles ?? [];
      setProfiles(list);
      const next = list.find((p) => p.id === preferId) ?? list.find((p) => p.isDefault) ?? list[0];
      if (next) applyProfile(next);
    },
    [applyProfile]
  );

  useEffect(() => { load(); }, [load]);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  function setFilter(key: keyof ScannerConfig, value: number | boolean) {
    setConfig((c) => ({ ...c, filters: { ...c.filters, [key]: value } }));
  }

  function setWeight(key: SignalKey, value: number) {
    setConfig((c) => ({ ...c, weights: { ...c.weights, [key]: value } }));
  }

  async function save() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch(`/api/profiles/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || selected?.name,
          description: description.trim() || null,
          config,
          universe: parseUniverseText(universeText),
        }),
      });
      await load(selectedId);
      onFlash?.("הפרופיל נשמר");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${name.trim() || "פרופיל"} — עותק ${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
          description: description.trim() || null,
          config,
          universe: parseUniverseText(universeText),
        }),
      });
      const json = await res.json();
      await load(json?.profile?.id);
      onFlash?.("הפרופיל שוכפל");
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch(`/api/profiles/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      await load(selectedId);
      onFlash?.("נקבע כברירת מחדל");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId || profiles.length <= 1) return;
    if (!confirm(`למחוק את הפרופיל "${name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/profiles/${selectedId}`, { method: "DELETE" });
      setSelectedId("");
      await load();
      onFlash?.("הפרופיל נמחק");
    } finally {
      setBusy(false);
    }
  }

  if (!profiles.length) {
    return <div className="text-sm text-[var(--muted)] mt-4">טוען פרופילים...</div>;
  }

  return (
    <div className="mt-4 space-y-6">
      {/* בחירת פרופיל */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedId}
          onChange={(e) => {
            const p = profiles.find((x) => x.id === e.target.value);
            if (p) applyProfile(p);
          }}
          className="max-w-xs"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.isDefault ? " ★" : ""}
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={makeDefault} disabled={busy || !!selected?.isDefault}>
          <Star className="w-3.5 h-3.5" /> ברירת מחדל
        </Button>
        <Button variant="outline" size="sm" onClick={duplicate} disabled={busy}>
          <Copy className="w-3.5 h-3.5" /> שכפל
        </Button>
        <Button variant="danger" size="sm" onClick={remove} disabled={busy || profiles.length <= 1}>
          <Trash2 className="w-3.5 h-3.5" /> מחק
        </Button>
      </div>

      {/* שם + תיאור */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-[var(--muted)] mb-1.5">שם הפרופיל</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="text-[11px] text-[var(--muted)] mb-1.5">תיאור</div>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* פילטרים */}
      <div>
        <div className="text-sm font-bold mb-3">פילטרים — מי בכלל נכנס לתוצאות</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {FILTER_FIELDS.map((f) => (
            <div key={f.key} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between text-[11px] text-[var(--muted)] mb-1.5">
                <span>{f.label}</span>
                {f.suffix && <span className="mono">{f.suffix}</span>}
              </div>
              <Input
                type="number"
                step={f.step ?? 1}
                value={String(config.filters[f.key] ?? "")}
                onChange={(e) => setFilter(f.key, Number(e.target.value))}
                className="mono py-2"
              />
            </div>
          ))}
          <label className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3 flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-xs">זיהוי Cup &amp; Handle</span>
            <input
              type="checkbox"
              checked={!!config.filters.cupAndHandle}
              onChange={(e) => setFilter("cupAndHandle", e.target.checked)}
              className="w-4 h-4 accent-[var(--up)]"
            />
          </label>
        </div>
      </div>

      {/* משקלים */}
      <div>
        <div className="text-sm font-bold mb-1">משקלי הניקוד — כמה כל אות שווה</div>
        <p className="text-[11px] text-[var(--muted)] mb-3">
          הניקוד מתחיל ב־50 וכל אות מוסיף/מוריד לפי המשקל שלו. משקל 0 = האות לא נספר ולא מוצג.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
          {SIGNAL_KEYS.map((k) => {
            const v = config.weights[k];
            return (
              <div key={k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--fg-dim)]">{SIGNAL_LABELS[k]}</span>
                  <span className={cn("mono font-bold", v === 0 ? "text-[var(--muted)]" : "text-[var(--up)]")}>
                    {v}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={v}
                  onChange={(e) => setWeight(k, Number(e.target.value))}
                  className="w-full accent-[var(--up)]"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Universe */}
      <div>
        <div className="text-sm font-bold mb-1">רשימת סימבולים (Universe)</div>
        <p className="text-[11px] text-[var(--muted)] mb-2">
          מופרד בפסיק / רווח / שורה. השאר ריק כדי לסרוק את היקום המלא (500+ Large Cap).
        </p>
        <Textarea
          value={universeText}
          onChange={(e) => setUniverseText(e.target.value)}
          rows={3}
          placeholder="AAPL, NVDA, MSFT ..."
          className="mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" onClick={save} disabled={busy}>
          <Save className="w-4 h-4" /> {busy ? "שומר..." : "שמור פרופיל"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfig((c) => ({ ...c, filters: { ...DEFAULT_SCANNER_CONFIG } }))}
          disabled={busy}
        >
          אפס פילטרים
        </Button>
      </div>
    </div>
  );
}
