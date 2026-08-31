"use client";

import { useEffect, useState, useCallback } from "react";
import { PageContainer, Eyebrow, Display, Card, Grade, Button } from "@/components/ui";
import AddToWatchlistInline from "@/components/add-to-watchlist-inline";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { Radar, Loader2, TrendingUp, CandlestickChart, ArrowUpRight, Star } from "lucide-react";

type ScanResult = {
  id: string;
  symbol: string;
  price: number | null;
  changePercent: number | null;
  volumeRatio: number | null;
  matchedSetups: string;
  score: number | null;
  grade: string | null;
  distanceFromHigh: number | null;
  distanceFromMa150: number | null;
};

type Folder = { id: string; name: string };

type ScanCategory = {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bgColor: string;
  setupKeys: string[];
};

const CATEGORIES: ScanCategory[] = [
  {
    key: "ath",
    title: "פריצות ATH / 52W",
    subtitle: "מניות ששוברות שיא כל הזמנים או שיא 52 שבועות",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-[var(--up)]",
    borderColor: "border-[var(--up)]/30",
    bgColor: "bg-[var(--up)]/10",
    setupKeys: ["breakout_ath", "near_ath", "breakout_52w", "near_52w"],
  },
  {
    key: "gap",
    title: "כניסה לגאפ",
    subtitle: "מניות שנכנסות לתוך אזור גאפ שלא נסגר — המחיר מתקרב לאזור הצהוב",
    icon: <ArrowUpRight className="w-5 h-5" />,
    color: "text-[var(--warn)]",
    borderColor: "border-[var(--warn)]/30",
    bgColor: "bg-[var(--warn)]/10",
    setupKeys: ["gap_entry", "gap_up"],
  },
  {
    key: "cup",
    title: "Cup & Handle",
    subtitle: "תבנית כוס ואוזן — ירידה, התאוששות, ואוזן קטנה לפני פריצה",
    icon: <CandlestickChart className="w-5 h-5" />,
    color: "text-[var(--info)]",
    borderColor: "border-[var(--info)]/30",
    bgColor: "bg-[var(--info)]/10",
    setupKeys: ["cup_and_handle"],
  },
];

const SETUP_LABELS: Record<string, string> = {
  breakout_ath: "פריצת ATH",
  near_ath: "קרוב ל־ATH",
  breakout_52w: "פריצת 52W",
  near_52w: "קרוב ל־52W",
  gap_up: "Gap Up",
  gap_entry: "נכנס לגאפ",
  high_volume: "ווליום גבוה",
  cup_and_handle: "Cup & Handle",
};

function groupResults(results: ScanResult[]): Record<string, ScanResult[]> {
  const groups: Record<string, ScanResult[]> = {};
  for (const cat of CATEGORIES) {
    groups[cat.key] = [];
  }
  for (const r of results) {
    const setups: string[] = r.matchedSetups ? JSON.parse(r.matchedSetups) : [];
    for (const cat of CATEGORIES) {
      if (setups.some((s) => cat.setupKeys.includes(s))) {
        groups[cat.key].push(r);
      }
    }
  }
  return groups;
}

export default function ScannerPage() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [totalScanned, setTotalScanned] = useState(0);

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

  useEffect(() => { loadExisting(); }, [loadExisting]);

  async function runScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scanner/run", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "scan failed");
      await loadExisting();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  }

  const grouped = groupResults(results);

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
            לחץ על &quot;סרוק הכל&quot; — הסורק בודק 500+ מניות Large Cap ($5B+) ומחלק את התוצאות ל-3 קטגוריות
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
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

      {/* Scanner Categories */}
      {CATEGORIES.map((cat) => {
        const catResults = grouped[cat.key] ?? [];
        return (
          <section key={cat.key}>
            <Card className="overflow-hidden">
              {/* Category Header */}
              <div className={cn("p-5 md:p-6 border-b", cat.borderColor, "border-[var(--border)]")}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cat.bgColor, cat.borderColor, "border", cat.color)}>
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-black">{cat.title}</h2>
                      <span className={cn(
                        "mono text-xs font-bold px-2 py-0.5 rounded-full",
                        catResults.length > 0
                          ? cn(cat.bgColor, cat.color)
                          : "bg-white/5 text-[var(--muted)]"
                      )}>
                        {catResults.length}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{cat.subtitle}</p>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="p-3 md:p-4">
                {catResults.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[var(--muted)]">
                    {results.length === 0
                      ? "הרץ סריקה כדי לראות תוצאות"
                      : "לא נמצאו תוצאות בקטגוריה הזו"}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {catResults.map((r, i) => {
                      const setups: string[] = r.matchedSetups ? JSON.parse(r.matchedSetups) : [];
                      const grade = r.grade ?? "?";
                      return (
                        <div
                          key={r.id}
                          className="rounded-xl px-4 py-3 row-hover flex flex-wrap items-center gap-3 md:gap-4 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                        >
                          <span className="mono text-[var(--muted)] font-bold text-sm w-6">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <a
                            href={`https://www.tradingview.com/chart/?symbol=${r.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ticker text-lg hover:text-[var(--up)] min-w-[70px]"
                          >
                            {r.symbol}
                          </a>
                          <span className="hidden md:block text-xs text-[var(--fg-dim)] flex-1 truncate">
                            {setups.map((s) => SETUP_LABELS[s] ?? s).join(" · ")}
                          </span>
                          <span className="hidden md:block mono text-sm">{formatCurrency(r.price)}</span>
                          <span className={cn("mono text-sm font-bold",
                            (r.changePercent ?? 0) >= 0 ? "trend-up" : "trend-down")}>
                            {formatPercent(r.changePercent)}
                          </span>
                          <span className="hidden md:block mono text-sm text-[var(--muted)]">
                            {r.volumeRatio ? `${r.volumeRatio.toFixed(1)}×` : "—"}
                          </span>
                          <Grade value={grade} size="sm" />
                          <AddToWatchlistInline symbol={r.symbol} folders={folders} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </section>
        );
      })}

      {totalScanned > 0 && (
        <div className="text-center text-xs text-[var(--muted)] pb-6">
          נסרקו {totalScanned} מניות · {results.length} תוצאות סה&quot;כ
        </div>
      )}
    </PageContainer>
  );
}
