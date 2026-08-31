"use client";

import { useState } from "react";
import { Card, Button, Input, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Search, TrendingUp, TrendingDown, Minus, ExternalLink, Target } from "lucide-react";

type SignalTone = "bullish" | "bearish" | "neutral";
type Signal = { label: string; value: string; tone: SignalTone; weight: number; explanation: string };
type Analysis = {
  symbol: string;
  name: string | null;
  price: number | null;
  changePercent: number | null;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  verdict: string;
  summary: string;
  signals: Signal[];
  keyLevels: {
    ath: number | null; high52w: number | null; low52w: number | null;
    ma50: number | null; ma150: number | null; ma200: number | null;
    suggestedStop: number | null;
  };
};

const GRADE_STYLE: Record<Analysis["grade"], string> = {
  A: "text-[var(--up)] border-[var(--up)]/40 bg-[var(--up-bg)]",
  B: "text-[var(--up)] border-[var(--up)]/30 bg-[var(--up-bg)]",
  C: "text-[var(--warn)] border-[var(--warn)]/40 bg-[var(--warn-bg)]",
  D: "text-[var(--down)] border-[var(--down)]/30 bg-[var(--down-bg)]",
  F: "text-[var(--down)] border-[var(--down)]/40 bg-[var(--down-bg)]",
};

function ToneIcon({ tone }: { tone: SignalTone }) {
  if (tone === "bullish") return <TrendingUp className="w-4 h-4 text-[var(--up)]" />;
  if (tone === "bearish") return <TrendingDown className="w-4 h-4 text-[var(--down)]" />;
  return <Minus className="w-4 h-4 text-[var(--muted)]" />;
}

export default function AnalyzeClient() {
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function run(sym?: string) {
    const q = (sym ?? symbol).trim().toUpperCase();
    if (!q) return;
    setSymbol(q);
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/analyze?symbol=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setAnalysis(json.analysis);
      else setError(json.error || "שגיאה בניתוח");
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search box */}
      <Card className="p-5">
        <div className="flex gap-2">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="הזן סימבול מניה — למשל AAPL, NVDA, MSFT"
            className="mono text-lg"
            autoFocus
          />
          <Button variant="accent" onClick={() => run()} disabled={loading}>
            <Search className="w-4 h-4" />
            {loading ? "מנתח..." : "נתח"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META"].map((s) => (
            <button
              key={s}
              onClick={() => run(s)}
              className="mono text-xs px-2.5 py-1 rounded-full border border-[var(--border-hi)] text-[var(--fg-dim)] hover:text-[var(--fg)] hover:border-[var(--up)]/40 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <Card className="p-5 border-[var(--down)]/40 bg-[var(--down-bg)]">
          <div className="text-[var(--down)] font-bold text-sm">{error}</div>
        </Card>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="h-32 rounded-2xl shimmer" />
          <div className="h-64 rounded-2xl shimmer" />
        </div>
      )}

      {analysis && !loading && (
        <>
          {/* Verdict header */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3">
                  <span className="mono text-2xl font-black">{analysis.symbol}</span>
                  {analysis.price != null && (
                    <span className="mono text-xl font-bold">${analysis.price.toFixed(2)}</span>
                  )}
                  {analysis.changePercent != null && (
                    <span className={cn("mono text-sm font-bold", analysis.changePercent >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                      {analysis.changePercent >= 0 ? "+" : ""}{analysis.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
                {analysis.name && <div className="text-sm text-[var(--fg-dim)] mt-1">{analysis.name}</div>}
              </div>
              <div className={cn("flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2", GRADE_STYLE[analysis.grade])}>
                <span className="text-3xl font-black leading-none">{analysis.grade}</span>
                <span className="mono text-xs mt-1">{analysis.score}/100</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border-hi)]">
              <div className={cn("inline-block text-xs font-bold px-3 py-1 rounded-full border mb-2", GRADE_STYLE[analysis.grade])}>
                {analysis.verdict}
              </div>
              <p className="text-sm text-[var(--fg-dim)] leading-relaxed">{analysis.summary}</p>
            </div>

            <a
              href={`https://www.tradingview.com/chart/?symbol=${analysis.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-dim)] hover:text-[var(--up)] mt-3 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> פתח גרף ב-TradingView
            </a>
          </Card>

          {/* Signals breakdown */}
          <Card className="p-6">
            <div className="text-sm font-bold mb-4">פירוט הניתוח — למה כן/לא</div>
            <div className="space-y-2">
              {analysis.signals.map((sig, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-4",
                    sig.tone === "bullish" && "border-[var(--up)]/25 bg-[var(--up-bg)]",
                    sig.tone === "bearish" && "border-[var(--down)]/25 bg-[var(--down-bg)]",
                    sig.tone === "neutral" && "border-[var(--border-hi)] bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <ToneIcon tone={sig.tone} />
                      <span className="font-bold text-sm">{sig.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-sm font-bold">{sig.value}</span>
                      {sig.weight !== 0 && (
                        <Badge className={cn(
                          "mono",
                          sig.weight > 0 ? "border-[var(--up)]/30 text-[var(--up)]" : "border-[var(--down)]/30 text-[var(--down)]"
                        )}>
                          {sig.weight > 0 ? "+" : ""}{sig.weight}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--fg-dim)] leading-relaxed">{sig.explanation}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Key levels */}
          <Card className="p-6">
            <div className="text-sm font-bold mb-4">רמות מפתח</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "שיא כל הזמנים", value: analysis.keyLevels.ath },
                { label: "שיא 52 שבועות", value: analysis.keyLevels.high52w },
                { label: "שפל 52 שבועות", value: analysis.keyLevels.low52w },
                { label: "ממוצע 50", value: analysis.keyLevels.ma50 },
                { label: "ממוצע 150", value: analysis.keyLevels.ma150 },
                { label: "ממוצע 200", value: analysis.keyLevels.ma200 },
              ].map((lvl) => (
                <div key={lvl.label} className="rounded-xl border border-[var(--border-hi)] p-3">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider">{lvl.label}</div>
                  <div className="mono text-base font-bold mt-1">
                    {lvl.value != null ? `$${lvl.value.toFixed(2)}` : "—"}
                  </div>
                </div>
              ))}
            </div>
            {analysis.keyLevels.suggestedStop != null && (
              <div className="mt-3 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn-bg)] p-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--warn)]" />
                <span className="text-sm">
                  סטופ מוצע (1.5×ATR):{" "}
                  <span className="mono font-bold text-[var(--warn)]">${analysis.keyLevels.suggestedStop.toFixed(2)}</span>
                </span>
              </div>
            )}
          </Card>

          <p className="text-[11px] text-[var(--muted)] text-center leading-relaxed px-4">
            הניתוח מבוסס על נתוני שוק אמיתיים (Yahoo Finance) וכללים טכניים — לא ייעוץ השקעות.
            ההחלטה תמיד שלך.
          </p>
        </>
      )}
    </div>
  );
}
