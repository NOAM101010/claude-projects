"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowUpRight, ExternalLink, Radar, TrendingUp } from "lucide-react";
import { PageContainer, Eyebrow, Display, Card, Grade } from "@/components/ui";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import HoloCard from "@/components/dashboard/holo-card";
import RegimeGauge from "@/components/dashboard/regime-gauge";
import { useCountUp } from "@/components/dashboard/use-count-up";

type DashboardData = {
  account: { accountSize: number | null; cashBalance: number | null };
  pnl: { today: number; month: number; total: number; monthReturnPct: number | null };
  equityCurve: { date: string; cumulative: number; ticker: string }[];
  bySetup: { setup: string; trades: number; winRate: number; netPnl: number; avgPct: number }[];
  winRate: number;
  closedTrades: number;
  openPositions: number;
};

type PositionsData = {
  positions: {
    id: string;
    ticker: string;
    buyPrice: number;
    currentPrice: number | null;
    unrealizedPnl: number | null;
    unrealizedPnlPct: number | null;
    risk: number | null;
    distanceToStopPct: number | null;
    stopPrice: number | null;
  }[];
  totalOpenPnl: number;
  totalOpenRisk: number;
  count: number;
};

type RegimeData = {
  score: number;
  label: string;
  tone: "up" | "down" | "neutral";
  spy: number | null;
  vix: number | null;
  notes: string[];
};

type ScannerData = {
  results: { symbol: string; score: number | null; grade: string | null; changePercent: number | null }[];
  lastRunAt: string | null;
  totalScanned: number;
};

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.ok) setData(j as T);
        else setError(j.error ?? "שגיאה");
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url]);
  return { data, loading, error };
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

function tone(n: number | null | undefined) {
  if (n == null) return "";
  return n > 0 ? "text-[var(--up)]" : n < 0 ? "text-[var(--down)]" : "text-[var(--fg-dim)]";
}

function PnlNumber({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const animated = useCountUp(value);
  return (
    <Card className="p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--muted)]">{label}</div>
      <div className={cn("mono text-3xl md:text-4xl font-black mt-2 tabular", tone(value))}>
        {value >= 0 ? "+" : "−"}
        {formatCurrency(Math.abs(animated), 0)}
      </div>
      {sub && <div className="text-xs text-[var(--fg-dim)] mt-1">{sub}</div>}
    </Card>
  );
}

export default function DashboardPage() {
  const { data: dash, loading: dashLoading } = useApi<DashboardData>("/api/dashboard");
  const { data: pos, loading: posLoading } = useApi<PositionsData>("/api/positions");
  const { data: regime, loading: regimeLoading } = useApi<RegimeData>("/api/regime");
  const { data: scan, loading: scanLoading } = useApi<ScannerData>("/api/scanner/results");

  const equity = dash?.equityCurve ?? [];
  const topSetups = useMemo(
    () => (dash?.bySetup ?? []).slice(0, 6),
    [dash]
  );
  const maxSetupTrades = Math.max(1, ...topSetups.map((s) => s.trades));

  return (
    <PageContainer className="space-y-8 md:space-y-10">
      <section>
        <Eyebrow>Control Room</Eyebrow>
        <Display className="mt-3">
          חדר<br />
          <span className="trend-up-glow">הבקרה.</span>
        </Display>
        <p className="text-sm text-[var(--fg-dim)] mt-4 max-w-lg">
          מבט-על חי: מצב החשבון, עקומת ההון, מד מצב השוק, הפוזיציות הפתוחות וסריקת היום — במסך אחד.
        </p>
      </section>

      {/* Row 1 — Holo card + equity curve */}
      <div className="grid lg:grid-cols-5 gap-5 items-stretch">
        <div className="lg:col-span-2 flex">
          {dashLoading ? (
            <Skeleton className="w-full max-w-[380px] aspect-[1.586/1] mx-auto sm:mx-0" />
          ) : (
            <HoloCard
              accountSize={dash?.account.accountSize ?? null}
              cashBalance={dash?.account.cashBalance ?? null}
              openPnl={pos?.totalOpenPnl ?? null}
              monthReturnPct={dash?.pnl.monthReturnPct ?? null}
              openRisk={pos?.totalOpenRisk ?? null}
            />
          )}
        </div>

        <Card className="lg:col-span-3 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--up)]" />
              עקומת הון
            </div>
            {dash && (
              <div className={cn("mono text-sm font-bold", tone(dash.pnl.total))}>
                {formatCurrency(dash.pnl.total, 0)}
              </div>
            )}
          </div>
          {dashLoading ? (
            <Skeleton className="w-full h-[220px]" />
          ) : equity.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equity} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dashEq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--up)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--up)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={48} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg)",
                    border: "1px solid var(--border-hi)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "מצטבר"]}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--up)"
                  strokeWidth={2}
                  fill="url(#dashEq)"
                  isAnimationActive
                  animationDuration={1100}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <div className="text-lg font-black mb-1">אין עדיין טריידים סגורים</div>
              <p className="text-sm text-[var(--fg-dim)] max-w-xs">
                סגור עסקה ראשונה ביומן והעקומה תתחיל להיבנות כאן.
              </p>
              <Link
                href="/journal"
                className="mt-4 text-xs font-bold text-[var(--up)] inline-flex items-center gap-1"
              >
                ליומן <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2 — P&L trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {dashLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <PnlNumber label="P&L היום" value={dash?.pnl.today ?? 0} />
            <PnlNumber
              label="P&L החודש"
              value={dash?.pnl.month ?? 0}
              sub={
                dash?.pnl.monthReturnPct != null
                  ? `${formatPercent(dash.pnl.monthReturnPct, 1)} מהחשבון`
                  : undefined
              }
            />
            <PnlNumber
              label="P&L כולל"
              value={dash?.pnl.total ?? 0}
              sub={dash ? `${dash.closedTrades} עסקאות · ${dash.winRate.toFixed(0)}% הצלחה` : undefined}
            />
          </>
        )}
      </div>

      {/* Row 3 — Win-rate by setup + Regime gauge */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <div className="text-sm font-bold mb-5">Win-rate לפי סטאפ</div>
          {dashLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : topSetups.length ? (
            <div className="space-y-4">
              {topSetups.map((s) => (
                <div key={s.setup}>
                  <div className="flex items-baseline justify-between mb-1.5 text-sm">
                    <span className="font-semibold truncate">{s.setup}</span>
                    <span className="mono text-xs text-[var(--fg-dim)]">
                      {s.trades} · {s.winRate.toFixed(0)}%
                      <span className={cn("ml-2 font-bold", tone(s.netPnl))}>
                        {formatCurrency(s.netPnl, 0)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bar-grow"
                      style={{
                        width: `${s.winRate}%`,
                        background:
                          s.winRate >= 50
                            ? "linear-gradient(90deg, var(--up-3), var(--up))"
                            : "linear-gradient(90deg, var(--down-3), var(--down))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-dim)] py-6 text-center">
              אין עדיין נתוני סטאפים. תייג עסקאות ביומן כדי לראות מה עובד.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="text-sm font-bold mb-2">מד מצב שוק · Market Regime</div>
          {regimeLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : regime ? (
            <>
              <RegimeGauge score={regime.score} label={regime.label} tone={regime.tone} />
              <div className="mt-4 flex items-center gap-4 text-xs text-[var(--fg-dim)] justify-center mono">
                {regime.spy != null && <span>SPY {regime.spy.toFixed(0)}</span>}
                {regime.vix != null && <span>VIX {regime.vix.toFixed(1)}</span>}
              </div>
              <ul className="mt-4 space-y-1.5 text-xs text-[var(--fg-dim)] leading-relaxed">
                {(regime.notes ?? []).map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--up)] mt-[3px]">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-[var(--fg-dim)] py-6 text-center">
              לא ניתן לחשב מצב שוק כרגע.
            </p>
          )}
        </Card>
      </div>

      {/* Row 4 — Open positions + Scanner today */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold">פוזיציות פתוחות</div>
            {pos && (
              <div className="text-xs mono text-[var(--fg-dim)]">
                {pos.count} · P&L{" "}
                <span className={cn("font-bold", tone(pos.totalOpenPnl))}>
                  {formatCurrency(pos.totalOpenPnl, 0)}
                </span>
              </div>
            )}
          </div>
          {posLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : pos && pos.positions.length ? (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] text-right">
                    <th className="font-bold pb-2">טיקר</th>
                    <th className="font-bold pb-2">כניסה</th>
                    <th className="font-bold pb-2">נוכחי</th>
                    <th className="font-bold pb-2">P&L%</th>
                    <th className="font-bold pb-2">מרחק לסטופ</th>
                    <th className="font-bold pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pos.positions.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--border)] row-hover">
                      <td className="py-2.5 ticker">{p.ticker}</td>
                      <td className="py-2.5 mono text-[var(--fg-dim)]">${p.buyPrice.toFixed(2)}</td>
                      <td className="py-2.5 mono">
                        {p.currentPrice != null ? `$${p.currentPrice.toFixed(2)}` : "—"}
                      </td>
                      <td className={cn("py-2.5 mono font-bold", tone(p.unrealizedPnlPct))}>
                        {p.unrealizedPnlPct != null ? formatPercent(p.unrealizedPnlPct, 1) : "—"}
                      </td>
                      <td
                        className={cn(
                          "py-2.5 mono",
                          p.distanceToStopPct != null && p.distanceToStopPct < 3
                            ? "text-[var(--down)]"
                            : "text-[var(--fg-dim)]"
                        )}
                      >
                        {p.distanceToStopPct != null ? formatPercent(p.distanceToStopPct, 1) : "אין סטופ"}
                      </td>
                      <td className="py-2.5 text-left">
                        <a
                          href={`https://www.tradingview.com/chart/?symbol=${p.ticker}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--muted)] hover:text-[var(--up)] inline-flex"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-dim)] py-6 text-center">
              אין פוזיציות פתוחות כרגע.
            </p>
          )}
        </Card>

        <Card className="p-6 flex flex-col">
          <div className="flex items-center gap-2 text-sm font-bold mb-4">
            <Radar className="w-4 h-4 text-[var(--info)]" />
            סריקת היום
          </div>
          {scanLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : scan && scan.results.length ? (
            <>
              <div className="mono text-3xl font-black">
                {scan.results.length}
                <span className="text-sm text-[var(--fg-dim)] font-normal"> / {scan.totalScanned}</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] mt-1">
                מניות תפסו
              </div>
              <div className="mt-4 space-y-2">
                {scan.results.slice(0, 3).map((r) => (
                  <div
                    key={r.symbol}
                    className="flex items-center justify-between border-t border-[var(--border)] pt-2"
                  >
                    <span className="ticker text-sm">{r.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("mono text-xs", tone(r.changePercent))}>
                        {r.changePercent != null ? formatPercent(r.changePercent, 1) : ""}
                      </span>
                      <Grade value={r.grade} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/scanner"
                className="mt-auto pt-4 text-xs font-bold text-[var(--up)] inline-flex items-center gap-1"
              >
                לסורק המלא <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </>
          ) : (
            <p className="text-sm text-[var(--fg-dim)] py-6 text-center flex-1 flex items-center justify-center">
              אין תוצאות סריקה עדיין.
            </p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
