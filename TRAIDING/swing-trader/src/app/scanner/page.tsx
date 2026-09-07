"use client";

import { useEffect, useState, useCallback } from "react";
import { PageContainer, Eyebrow, Display, Card, Grade, Button } from "@/components/ui";
import AddToWatchlistInline from "@/components/add-to-watchlist-inline";
import SignalBreakdown, { type BreakdownSignal } from "@/components/signal-breakdown";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { SETUP_LABELS } from "@/lib/setups";
import { Radar, Loader2, ChevronDown } from "lucide-react";

type ScanResult = {
  id: string;
  symbol: string;
  price: number | null;
  changePercent: number | null;
  volumeRatio: number | null;
  matchedSetups: string;
  signals: string | null;
  verdict: string | null;
  confidence: number | null;
  score: number | null;
  grade: string | null;
  distanceFromHigh: number | null;
  distanceFromMa150: number | null;
};

type Folder = { id: string; name: string };

type Profile = { id: string; name: string; description: string | null; isDefault: boolean };

function parseSignals(raw: string | null): BreakdownSignal[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as BreakdownSignal[]) : [];
  } catch {
    return [];
  }
}

function parseSetups(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/** מקבץ את תוצאות הפרופיל לפי הסטאפ הראשי (החזק ביותר) שנמצא בכל מניה. */
function groupBySetup(results: ScanResult[]): { setup: string; rows: ScanResult[] }[] {
  const groups = new Map<string, ScanResult[]>();
  for (const r of results) {
    const primary = parseSetups(r.matchedSetups)[0] ?? "other";
    const list = groups.get(primary);
    if (list) list.push(r);
    else groups.set(primary, [r]);
  }
  return [...groups.entries()]
    .map(([setup, rows]) => ({ setup, rows }))
    .sort((a, b) => b.rows.length - a.rows.length);
}

export default function ScannerPage() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [totalScanned, setTotalScanned] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      const [scanRes, folderRes] = await Promise.all([
        fetch("/api/scanner/results"),
        fetch("/api/watchlist/folders"),
      ]);
      const scanJson = await scanRes.json();
      const folderJson = await folderRes.json();
      if (scanJson.ok) {
        setResults(scanJson.results);
        setLastScanTime(scanJson.lastRunAt);
        setTotalScanned(scanJson.totalScanned ?? 0);
      }
      if (folderJson.ok) {
        setFolders((folderJson.folders ?? []).map((f: any) => ({ id: f.id, name: f.name })));
      }
    } catch {}
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles");
      const json = await res.json();
      if (!json.ok) return;
      const list: Profile[] = json.profiles ?? [];
      setProfiles(list);
      setProfileId((cur) => cur || list.find((p) => p.isDefault)?.id || list[0]?.id || "");
    } catch {}
  }, []);

  useEffect(() => { loadExisting(); }, [loadExisting]);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const url = profileId
        ? `/api/scanner/run?profileId=${encodeURIComponent(profileId)}`
        : "/api/scanner/run";
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "scan failed");
      await loadExisting();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  }

  const selectedProfile = profiles.find((p) => p.id === profileId) ?? null;
  const groups = groupBySetup(results);

  return (
    <PageContainer className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>
            {lastScanTime
              ? `סריקה אחרונה · ${new Date(lastScanTime).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}`
              : "מוכן לסריקה"}
          </Eyebrow>
          <Display className="mt-3">
            סורק<br /><span className="trend-up-glow">מניות.</span>
          </Display>
          <p className="text-sm text-[var(--fg-dim)] mt-4 max-w-lg">
            כל פרופיל מחפש סטאפ אחד ספציפי. הסורק עובר על 500+ מניות Large Cap ($5B+)
            ומחזיר רק מניות שבהן הסטאפ של הפרופיל באמת נמצא.
          </p>
          {selectedProfile?.description && (
            <p className="text-xs text-[var(--muted)] mt-2 max-w-lg">
              {selectedProfile.name} — {selectedProfile.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {profiles.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              פרופיל סריקה
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                disabled={scanning}
                className="bg-[var(--bg)] border border-[var(--border-hi)] rounded-lg px-3 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--up)]/50"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isDefault ? " ★" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button variant="accent" size="lg" onClick={runScan} disabled={scanning}>
            {scanning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> סורק... (30-60 שניות)</>
            ) : (
              <><Radar className="w-4 h-4" /> סרוק הכל</>
            )}
          </Button>
          {error && <span className="text-xs text-[var(--down)]">{error}</span>}
        </div>
      </section>

      {results.length === 0 ? (
        <Card className="p-10 text-center text-sm text-[var(--muted)]">
          {lastScanTime
            ? "הסריקה האחרונה לא מצאה מניה שעומדת בסטאפ של הפרופיל."
            : "הרץ סריקה כדי לראות תוצאות"}
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.setup}>
            <Card className="overflow-hidden">
              <div className="p-5 md:p-6 border-b border-[var(--border)] flex items-center gap-3">
                <h2 className="text-lg font-black">{SETUP_LABELS[g.setup] ?? g.setup}</h2>
                <span className="mono text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--up)]/10 text-[var(--up)]">
                  {g.rows.length}
                </span>
              </div>

              <div className="p-3 md:p-4">
                <div className="space-y-1.5">
                  {g.rows.map((r, i) => {
                    const setups = parseSetups(r.matchedSetups);
                    const grade = r.grade ?? "?";
                    const expanded = expandedId === r.id;
                    const signals = expanded ? parseSignals(r.signals) : [];
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "rounded-xl bg-white/[0.02] border",
                          expanded ? "border-[var(--border-hi)]" : "border-transparent"
                        )}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedId(expanded ? null : r.id);
                            }
                          }}
                          className="cursor-pointer rounded-xl px-4 py-3 row-hover flex flex-wrap items-center gap-3 md:gap-4"
                        >
                          <span className="mono text-[var(--muted)] font-bold text-sm w-6">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <a
                            href={`https://www.tradingview.com/chart/?symbol=${r.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ticker text-lg hover:text-[var(--up)] transition-colors duration-200 min-w-[70px]"
                          >
                            {r.symbol}
                          </a>
                          <div className="hidden md:block flex-1 min-w-0">
                            <div className="text-xs text-[var(--fg-dim)] truncate">
                              {setups.map((s) => SETUP_LABELS[s] ?? s).join(" · ")}
                            </div>
                            {r.verdict && (
                              <div className="text-[11px] text-[var(--muted)] truncate mt-0.5">
                                {r.verdict}
                              </div>
                            )}
                          </div>
                          {r.confidence != null && (
                            <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-full border border-[var(--up)]/30 text-[var(--up)]">
                              {Math.round(r.confidence * 100)}%
                            </span>
                          )}
                          <span className="hidden md:block mono text-sm">{formatCurrency(r.price)}</span>
                          <span className={cn("mono text-sm font-bold",
                            (r.changePercent ?? 0) >= 0 ? "trend-up" : "trend-down")}>
                            {formatPercent(r.changePercent)}
                          </span>
                          <span className="hidden md:block mono text-sm text-[var(--muted)]">
                            {r.volumeRatio ? `${r.volumeRatio.toFixed(1)}×` : "—"}
                          </span>
                          <Grade value={grade} size="sm" />
                          <span onClick={(e) => e.stopPropagation()}>
                            <AddToWatchlistInline symbol={r.symbol} folders={folders} />
                          </span>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-[var(--muted)] transition-transform",
                              expanded && "rotate-180"
                            )}
                          />
                        </div>

                        {expanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-[var(--border)]">
                            {r.verdict && (
                              <div className="md:hidden text-xs text-[var(--fg-dim)] mb-2">{r.verdict}</div>
                            )}
                            <div className="text-xs font-bold text-[var(--muted)] mb-2">
                              פירוט האותות {r.score != null && `· ${Math.round(r.score)}/100`}
                              {r.confidence != null && ` · ביטחון בתבנית ${Math.round(r.confidence * 100)}%`}
                            </div>
                            <SignalBreakdown signals={signals} compact />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </section>
        ))
      )}

      {totalScanned > 0 && (
        <div className="text-center text-xs text-[var(--muted)] pb-6">
          נסרקו {totalScanned} מניות · {results.length} תוצאות סה&quot;כ
        </div>
      )}
    </PageContainer>
  );
}
