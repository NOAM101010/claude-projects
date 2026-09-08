"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ExternalLink, Radar, AlertTriangle } from "lucide-react";
import { Card, Grade } from "@/components/ui";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import AccountPanel from "@/components/dashboard/account-panel";
import RegimeGauge from "@/components/dashboard/regime-gauge";
import EquityPanel, { type EquityPoint } from "@/components/dashboard/equity-panel";
import TerminalBackdrop from "@/components/dashboard/terminal-backdrop";
import NewsPanel from "@/components/dashboard/news-panel";
import VoiceBrief from "@/components/dashboard/voice-brief";
import LiveNumber from "@/components/dashboard/live-number";
import AlertChecker from "@/components/alert-checker";
import { useCountUp } from "@/components/dashboard/use-count-up";
import { useLiveData } from "@/components/dashboard/use-live-data";
import "@/components/dashboard/dashboard.css";

type DashboardData = {
  account: { accountSize: number | null; cashBalance: number | null; cashComputed: number | null };
  pnl: { today: number; month: number; total: number; monthReturnPct: number | null };
  equityCurve: EquityPoint[];
  bySetup: { setup: string; trades: number; winRate: number; netPnl: number; avgPct: number }[];
  winRate: number;
  closedTrades: number;
  openPositions: number;
  rollingWinRate: { index: number; winRate: number; date: string }[];
  bestDayOfWeek: { day: string; avgPct: number; trades: number }[];
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  longestWinStreak: number;
  longestLossStreak: number;
  openCost: number;
  exposurePct: number | null;
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
    earningsDate: string | null;
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

type QuotesData = {
  quotes: { symbol: string; label: string; price: number | null; changePercent: number | null }[];
};

const HUD_SYMBOLS = ["^GSPC", "^IXIC", "^VIX", "BTC-USD"];

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} />;
}

function tone(n: number | null | undefined) {
  if (n == null) return "";
  return n > 0 ? "text-[var(--up)]" : n < 0 ? "text-[var(--down)]" : "text-[var(--fg-dim)]";
}

function clock(ts: number | null) {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString("he-IL", { hour12: false });
}

function daysUntil(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function Rule({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="dash-rule mb-4">
      <span className="dash-rule-i">{index}</span>
      <h2 className="display-serif panel-title">{children}</h2>
    </div>
  );
}

function PnlNumber({
  label,
  value,
  sub,
  big,
  children,
}: {
  label: string;
  value: number;
  sub?: React.ReactNode;
  big?: boolean;
  children?: React.ReactNode;
}) {
  const animated = useCountUp(value);
  return (
    <Card className="p-5 holo-edge holo-edge--amber">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[rgba(245,158,11,0.45)] to-transparent" />
      <div className="text-[9.5px] uppercase tracking-[0.26em] font-bold text-[var(--muted)] mono">
        {label}
      </div>
      <LiveNumber
        value={value}
        className={cn(
          "mono font-black mt-2 tabular block",
          big ? "text-4xl md:text-5xl" : "text-3xl md:text-[34px]",
          tone(value)
        )}
      >
        {value >= 0 ? "+" : "−"}
        {formatCurrency(Math.abs(animated), 0)}
      </LiveNumber>
      {sub && <div className="text-[11px] text-[var(--fg-dim)] mt-1.5">{sub}</div>}
      {children}
    </Card>
  );
}

export default function CommandCenter() {
  const dashQ = useLiveData<DashboardData>("/api/dashboard", { intervalMs: 120_000 });
  const posQ = useLiveData<PositionsData>("/api/positions", { intervalMs: 20_000 });
  const regimeQ = useLiveData<RegimeData>("/api/regime", { intervalMs: 20_000 });
  const quotesQ = useLiveData<QuotesData>("/api/quotes/ticker", { intervalMs: 30_000 });
  const scanQ = useLiveData<ScannerData>("/api/scanner/results", { intervalMs: 0, once: true });

  const dash = dashQ.data;
  const pos = posQ.data;
  const regime = regimeQ.data;
  const scan = scanQ.data;

  const equity = dash?.equityCurve ?? [];
  const topSetups = useMemo(() => (dash?.bySetup ?? []).slice(0, 6), [dash]);
  const rollingWr = dash?.rollingWinRate ?? [];
  const dow = dash?.bestDayOfWeek ?? [];

  const hudQuotes = useMemo(() => {
    const all = quotesQ.data?.quotes ?? [];
    return HUD_SYMBOLS.map((s) => all.find((q) => q.symbol === s)).filter(
      (q): q is NonNullable<typeof q> => !!q && q.price != null
    );
  }, [quotesQ.data]);

  const maxDrawdown = useMemo(() => {
    let peak = -Infinity;
    let dd = 0;
    for (const p of equity) {
      if (p.cumulative > peak) peak = p.cumulative;
      dd = Math.max(dd, peak - p.cumulative);
    }
    return dd;
  }, [equity]);

  const winRate = dash?.winRate ?? 0;
  const losingStreak =
    dash?.currentStreak.type === "loss" && dash.currentStreak.count >= 3
      ? dash.currentStreak.count
      : 0;

  return (
    <div className="dash space-y-8 md:space-y-10">
      <TerminalBackdrop />
      <AlertChecker />

      <div className="space-y-8 md:space-y-10">
        <header className="flex flex-col-reverse lg:flex-row lg:items-end lg:justify-between gap-8">
          <div className="lg:pb-1">
            <div className="eyebrow">Control Room · 2026</div>
            <h1 className="display-serif dash-title dash-title-glow mt-4">
              חדר
              <br />
              <span className="text-[var(--warn-2)]">הבקרה.</span>
            </h1>
            <p className="text-[13px] text-[var(--fg-dim)] mt-5 max-w-sm leading-relaxed">
              מבט-על חי. החשבון, עקומת ההון, מד מצב השוק, הפוזיציות והסריקה —
              מתעדכנים לבד כל 20 שניות.
            </p>
            <div className="mt-6">
              <VoiceBrief />
            </div>
          </div>

          <div className="dash-hud rounded-lg self-start lg:self-auto">
            <div className="dash-hud-cell">
              <span className="dash-hud-k">Feed</span>
              <span className="dash-hud-v inline-flex items-center gap-2 text-[var(--up)]">
                <i
                  className="w-1.5 h-1.5 rounded-full bg-[var(--up)] pulse-dot"
                  style={{ boxShadow: "0 0 8px var(--up-glow)" }}
                />
                LIVE
              </span>
            </div>
            <div className="dash-hud-cell">
              <span className="dash-hud-k">Sync</span>
              <span className="dash-hud-v">{clock(posQ.updatedAt)}</span>
            </div>
            {hudQuotes.map((q) => (
              <div key={q.symbol} className="dash-hud-cell">
                <span className="dash-hud-k">{q.label}</span>
                <LiveNumber
                  value={q.price}
                  className={cn("dash-hud-v", tone(q.changePercent))}
                >
                  {q.price! >= 1000
                    ? Math.round(q.price!).toLocaleString("en-US")
                    : q.price!.toFixed(2)}
                  <span className="text-[9px] opacity-70 ms-1.5">
                    {q.changePercent != null ? formatPercent(q.changePercent, 1) : ""}
                  </span>
                </LiveNumber>
              </div>
            ))}
          </div>
        </header>

        {losingStreak > 0 && (
          <div className="relative overflow-hidden rounded-[14px] border border-[rgba(239,68,68,0.45)] bg-[var(--down-bg)] p-4 flex items-center gap-3.5 shadow-[inset_0_0_28px_-10px_var(--down-glow)]">
            <span className="absolute inset-y-0 start-0 w-[3px] bg-[var(--down)]" />
            <AlertTriangle className="w-5 h-5 text-[var(--down)] shrink-0" />
            <div>
              <div className="font-bold text-[var(--down-2)]">
                רצף של {losingStreak} הפסדים
              </div>
              <div className="text-xs text-[var(--fg-dim)] mt-0.5">
                שקול להקטין גודל פוזיציה או לקחת הפסקה קצרה עד שהתנאים משתפרים.
              </div>
            </div>
          </div>
        )}

        {/* ── 01 · THE VAULT ─────────────────────────────────────── */}
        <section>
          <Rule index="01">החשבון · עקומת ההון</Rule>
          <div className="grid lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-5 flex items-center">
              {dashQ.loading ? (
                <Skeleton className="w-full max-w-[460px] aspect-[1.4/1] mx-auto sm:mx-0" />
              ) : (
                <AccountPanel
                  accountSize={dash?.account.accountSize ?? null}
                  cashBalance={dash?.account.cashBalance ?? dash?.account.cashComputed ?? null}
                  totalOpenPnl={pos?.totalOpenPnl ?? null}
                  monthReturnPct={dash?.pnl.monthReturnPct ?? null}
                  exposurePct={dash?.exposurePct ?? null}
                  openRisk={pos?.totalOpenRisk ?? null}
                  openPositions={pos?.count ?? dash?.openPositions ?? 0}
                />
              )}
            </div>

            <Card className="lg:col-span-7 p-6 pb-4 flex flex-col holo-edge det-frame">
              <div className="flex items-start justify-between mb-1 relative z-[3]">
                <div>
                  <h3 className="display-serif panel-title">עקומת ההון</h3>
                  <div className="mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--muted-2)] mt-1">
                    Equity · {equity.length} closed
                  </div>
                </div>
                {dash && (
                  <div className="text-left">
                    <div
                      className={cn(
                        "mono text-2xl font-black tabular num",
                        tone(dash.pnl.total)
                      )}
                    >
                      {formatCurrency(dash.pnl.total, 0)}
                    </div>
                    {maxDrawdown > 0 && (
                      <div className="mono text-[9.5px] tracking-[0.16em] text-[var(--muted)] mt-0.5 num">
                        MAX DD −{formatCurrency(maxDrawdown, 0)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {dashQ.loading ? (
                <Skeleton className="w-full h-[260px] mt-4" />
              ) : equity.length > 1 ? (
                <div className="mt-2 -mx-2">
                  <EquityPanel points={equity} height={260} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-14">
                  <div className="display-serif text-2xl mb-2">אין עדיין טריידים סגורים</div>
                  <p className="text-sm text-[var(--fg-dim)] max-w-xs leading-relaxed">
                    סגור עסקה ראשונה ביומן והעקומה — עם תיבות הזיהוי — תתחיל להיבנות כאן.
                  </p>
                  <Link
                    href="/journal"
                    className="mt-5 text-xs font-bold text-[var(--warn-2)] inline-flex items-center gap-1 hover:gap-2 transition-[gap]"
                  >
                    ליומן <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* ── 02 · P&L ─────────────────────────────────────────────── */}
        <section>
          <Rule index="02">רווח והפסד</Rule>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5">
            {dashQ.loading ? (
              <>
                <Skeleton className="h-32 lg:col-span-3" />
                <Skeleton className="h-32 lg:col-span-3" />
                <Skeleton className="h-32 lg:col-span-6" />
              </>
            ) : (
              <>
                <div className="lg:col-span-3">
                  <PnlNumber label="Today" value={dash?.pnl.today ?? 0} sub="P&L היום" />
                </div>
                <div className="lg:col-span-3">
                  <PnlNumber
                    label="Month"
                    value={dash?.pnl.month ?? 0}
                    sub={
                      dash?.pnl.monthReturnPct != null ? (
                        <>
                          <span className="num">
                            {formatPercent(dash.pnl.monthReturnPct, 1)}
                          </span>{" "}
                          מהחשבון
                        </>
                      ) : (
                        "P&L החודש"
                      )
                    }
                  />
                </div>
                <div className="lg:col-span-6">
                  <PnlNumber
                    label="All time"
                    value={dash?.pnl.total ?? 0}
                    big
                    sub={
                      dash
                        ? `${dash.closedTrades} עסקאות סגורות · ${winRate.toFixed(0)}% הצלחה`
                        : undefined
                    }
                  >
                    <div className="seg-track mt-4">
                      {Array.from({ length: 20 }, (_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "seg-cell",
                            i * 5 < winRate && (winRate >= 50 ? "is-on" : "is-on-warn")
                          )}
                          style={{ transitionDelay: `${i * 24}ms` }}
                        />
                      ))}
                    </div>
                  </PnlNumber>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── 03 · המכשירים ────────────────────────────────────────── */}
        <section>
          <Rule index="03">מכשירי מדידה</Rule>
          <div className="grid lg:grid-cols-12 gap-5 items-start">
            <Card className="lg:col-span-5 p-6 holo-edge det-frame">
              {regimeQ.tick > 0 && <span className="panel-refresh" key={regimeQ.tick} />}
              <div className="flex items-start justify-between mb-3 relative z-[3]">
                <div>
                  <h3 className="display-serif panel-title">מד מצב שוק</h3>
                  <div className="mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--muted-2)] mt-1">
                    Market Regime
                  </div>
                </div>
                {regime && (
                  <div className="flex gap-3 mono text-[10px] text-[var(--fg-dim)]">
                    {regime.spy != null && (
                      <LiveNumber value={regime.spy}>SPY {regime.spy.toFixed(0)}</LiveNumber>
                    )}
                    {regime.vix != null && (
                      <LiveNumber value={regime.vix}>VIX {regime.vix.toFixed(1)}</LiveNumber>
                    )}
                  </div>
                )}
              </div>
              {regimeQ.loading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : regime ? (
                <>
                  <RegimeGauge score={regime.score} label={regime.label} tone={regime.tone} />
                  <ul className="mt-5 space-y-2 text-[12px] text-[var(--fg-dim)] leading-relaxed relative z-[3]">
                    {(regime.notes ?? []).map((n, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span
                          className={cn(
                            "mt-[7px] w-1 h-1 rounded-full shrink-0",
                            regime.tone === "down" ? "bg-[var(--down)]" : "bg-[var(--up)]"
                          )}
                        />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-[var(--fg-dim)] py-10 text-center">
                  לא ניתן לחשב מצב שוק כרגע.
                </p>
              )}
            </Card>

            <Card className="lg:col-span-7 p-6 holo-edge">
              <div className="flex items-start justify-between mb-5">
                <h3 className="display-serif panel-title">Win-rate לפי סטאפ</h3>
                <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
                  What works
                </span>
              </div>
              {dashQ.loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : topSetups.length ? (
                <div className="space-y-[18px]">
                  {topSetups.map((s, i) => (
                    <div key={s.setup} className="group">
                      <div className="flex items-baseline justify-between mb-2 text-sm gap-3">
                        <span className="font-semibold truncate flex items-baseline gap-2.5">
                          <span className="mono text-[9px] text-[var(--muted-2)]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {s.setup}
                        </span>
                        <span className="mono text-[11px] text-[var(--fg-dim)] shrink-0 tabular num">
                          {s.trades} · {s.winRate.toFixed(0)}%
                          <span className={cn("ms-2.5 font-bold", tone(s.netPnl))}>
                            {formatCurrency(s.netPnl, 0)}
                          </span>
                        </span>
                      </div>
                      <div className="h-[3px] bg-white/[0.05] overflow-hidden">
                        <div
                          className="h-full bar-grow transition-[width]"
                          style={{
                            width: `${s.winRate}%`,
                            animationDelay: `${i * 70}ms`,
                            background:
                              s.winRate >= 50
                                ? "linear-gradient(90deg, var(--up-3), var(--up))"
                                : "linear-gradient(90deg, var(--down-3), var(--down))",
                            boxShadow:
                              s.winRate >= 50
                                ? "0 0 10px var(--up-glow)"
                                : "0 0 10px var(--down-glow)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--fg-dim)] py-10 text-center">
                  אין עדיין נתוני סטאפים. תייג עסקאות ביומן כדי לראות מה עובד.
                </p>
              )}
            </Card>

            {rollingWr.length >= 3 && (
              <Card className="lg:col-span-7 p-6 holo-edge">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="display-serif panel-title">מגמת Win-Rate</h3>
                  <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
                    Last 10 · trailing
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={rollingWr}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="index" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={36} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg)", border: "1px solid var(--border-hi)", borderRadius: 12, fontSize: 12 }}
                      labelFormatter={(v: any) => `טרייד #${v}`}
                      formatter={(v: any) => [`${Number(v).toFixed(0)}%`, "Win Rate נגלל"]}
                    />
                    <ReferenceLine y={50} stroke="var(--muted)" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="var(--up)"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        const color = payload.winRate >= 50 ? "var(--up)" : "var(--down)";
                        return <circle key={index} cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {dow.length > 0 && (
              <Card className="lg:col-span-5 p-6 holo-edge">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="display-serif panel-title">איזה יום כניסה משתלם</h3>
                  <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
                    By entry day
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {dow.map((d) => (
                    <div key={d.day} className="rounded-xl border border-[var(--border-hi)] p-3 text-center">
                      <div className="text-xs text-[var(--fg-dim)]">{d.day}</div>
                      <div className={cn("mono font-bold mt-1 num", tone(d.avgPct))}>
                        {formatPercent(d.avgPct, 1)}
                      </div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">{d.trades} טריידים</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </section>

        {/* ── 04 · הרצפה ───────────────────────────────────────────── */}
        <section>
          <Rule index="04">הרצפה · חי</Rule>
          <div className="grid lg:grid-cols-12 gap-5 items-start">
            <Card className="lg:col-span-8 p-6 holo-edge">
              {posQ.tick > 0 && <span className="panel-refresh" key={posQ.tick} />}
              <div className="flex items-center justify-between mb-5 relative z-[3]">
                <h3 className="display-serif panel-title">פוזיציות פתוחות</h3>
                {pos && (
                  <div className="text-[11px] mono text-[var(--fg-dim)] tabular">
                    {pos.count} · P&L{" "}
                    <LiveNumber
                      value={pos.totalOpenPnl}
                      className={cn("font-bold", tone(pos.totalOpenPnl))}
                    >
                      {formatCurrency(pos.totalOpenPnl, 0)}
                    </LiveNumber>
                  </div>
                )}
              </div>
              {posQ.loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : pos && pos.positions.length ? (
                <div className="overflow-x-auto no-scrollbar relative z-[3]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted-2)] text-right">
                        <th className="font-bold pb-3">טיקר</th>
                        <th className="font-bold pb-3">כניסה</th>
                        <th className="font-bold pb-3">נוכחי</th>
                        <th className="font-bold pb-3">P&L%</th>
                        <th className="font-bold pb-3">לסטופ</th>
                        <th className="font-bold pb-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.positions.map((p) => {
                        const hot = p.distanceToStopPct != null && p.distanceToStopPct < 3;
                        const edays = p.earningsDate ? daysUntil(p.earningsDate) : null;
                        return (
                          <tr key={p.id} className="border-t border-[var(--border)] row-hover">
                            <td className="py-3 ticker">
                              <span className="inline-flex items-center gap-2 flex-wrap">
                                {p.ticker}
                                {edays != null && edays >= 0 && edays <= 14 && (
                                  <span className="det-chip">📅 רווחים בעוד {edays}d</span>
                                )}
                              </span>
                            </td>
                            <td className="py-3 mono text-[var(--muted)] tabular">
                              ${p.buyPrice.toFixed(2)}
                            </td>
                            <td className="py-3 mono tabular">
                              <LiveNumber value={p.currentPrice}>
                                {p.currentPrice != null ? `$${p.currentPrice.toFixed(2)}` : "—"}
                              </LiveNumber>
                            </td>
                            <td className="py-3 mono font-bold tabular">
                              <LiveNumber
                                value={p.unrealizedPnlPct}
                                className={tone(p.unrealizedPnlPct)}
                              >
                                {p.unrealizedPnlPct != null
                                  ? formatPercent(p.unrealizedPnlPct, 1)
                                  : "—"}
                              </LiveNumber>
                            </td>
                            <td
                              className={cn(
                                "py-3 mono tabular",
                                hot ? "text-[var(--down)]" : "text-[var(--fg-dim)]"
                              )}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {hot && (
                                  <span className="w-1 h-1 rounded-full bg-[var(--down)] pulse-dot" />
                                )}
                                {p.distanceToStopPct != null ? (
                                  <span className="num">
                                    {formatPercent(p.distanceToStopPct, 1)}
                                  </span>
                                ) : (
                                  "אין סטופ"
                                )}
                              </span>
                            </td>
                            <td className="py-3 text-left">
                              <a
                                href={`https://www.tradingview.com/chart/?symbol=${p.ticker}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--muted-2)] hover:text-[var(--warn-2)] transition-colors inline-flex"
                                aria-label={`${p.ticker} ב-TradingView`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm text-[var(--fg-dim)]">אין פוזיציות פתוחות כרגע.</p>
                  <Link
                    href="/scanner"
                    className="mt-4 text-xs font-bold text-[var(--up)] inline-flex items-center gap-1 hover:gap-2 transition-[gap]"
                  >
                    לחפש מועמדים <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </Card>

            <Card className="lg:col-span-4 p-6 flex flex-col holo-edge min-h-[220px]">
              <div className="flex items-center gap-2 mb-4">
                <Radar className="w-3.5 h-3.5 text-[var(--info)]" />
                <h3 className="display-serif panel-title">סריקת היום</h3>
              </div>
              {scanQ.loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : scan && scan.results.length ? (
                <>
                  <div className="mono text-[42px] font-black leading-none tabular">
                    {scan.results.length}
                    <span className="text-sm text-[var(--muted)] font-normal">
                      /{scan.totalScanned}
                    </span>
                  </div>
                  <div className="mono text-[9px] uppercase tracking-[0.22em] text-[var(--muted-2)] mt-2">
                    Passed the filter
                  </div>
                  <div className="mt-5 space-y-2.5">
                    {scan.results.slice(0, 3).map((r) => (
                      <div
                        key={r.symbol}
                        className="flex items-center justify-between border-t border-[var(--border)] pt-2.5"
                      >
                        <span className="ticker text-sm">{r.symbol}</span>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn("mono text-[11px] tabular num", tone(r.changePercent))}
                          >
                            {r.changePercent != null ? formatPercent(r.changePercent, 1) : ""}
                          </span>
                          <Grade value={r.grade} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/scanner"
                    className="mt-auto pt-5 text-xs font-bold text-[var(--up)] inline-flex items-center gap-1 hover:gap-2 transition-[gap]"
                  >
                    לסורק המלא <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-[var(--fg-dim)]">אין תוצאות סריקה עדיין.</p>
                  <Link
                    href="/scanner"
                    className="mt-4 text-xs font-bold text-[var(--up)] inline-flex items-center gap-1 hover:gap-2 transition-[gap]"
                  >
                    להריץ סריקה <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </section>

        {/* ── 05 · חדשות ───────────────────────────────────────────── */}
        <section>
          <Rule index="05">חדשות</Rule>
          <NewsPanel />
        </section>
      </div>
    </div>
  );
}
