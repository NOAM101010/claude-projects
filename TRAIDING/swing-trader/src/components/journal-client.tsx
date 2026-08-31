"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { Upload, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Flame, Snowflake, X, Sparkles, AlertTriangle, Target } from "lucide-react";
import { Card, Button, Input, Select, Label, Badge } from "@/components/ui";
import PnlCalendar from "@/components/pnl-calendar";
import PnlCalendarMonth from "@/components/pnl-calendar-month";
import { cn } from "@/lib/utils";

type Trade = {
  id: string;
  ticker: string;
  quantity: number;
  buyPrice: number;
  buyAmount: number;
  buyDate: string;
  sellPrice: number | null;
  sellAmount: number | null;
  sellDate: string | null;
  commission: number;
  usdIlsRate: number | null;
  stopPrice: number | null;
  setup: string | null;
  notes: string | null;
};

type Benchmark = {
  perTrade: { tradeId: string; ticker: string; tradeReturnPct: number; spyReturnPct: number; alphaPct: number; beatMarket: boolean }[];
  avgAlphaPct: number;
  beatMarketRate: number;
  totalTrades: number;
};

type Stats = {
  totalTrades: number;
  openPositions: number;
  closedTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  breakeven: number;
  totalNetPnl: number;
  avgWinPct: number;
  avgLossPct: number;
  avgWinUsd: number;
  avgLossUsd: number;
  profitFactor: number | null;
  expectancy: number;
  bestTrade: (Trade & { grossPnl: number; pnlPercent: number; netPnl: number; holdDays: number }) | null;
  worstTrade: (Trade & { grossPnl: number; pnlPercent: number; netPnl: number; holdDays: number }) | null;
  avgHoldDaysWinners: number;
  avgHoldDaysLosers: number;
  currentStreak: { type: "win" | "loss" | "none"; count: number };
  longestWinStreak: number;
  longestLossStreak: number;
  byTicker: { ticker: string; trades: number; winRate: number; netPnl: number; avgPct: number }[];
  bySetup: { setup: string; trades: number; winRate: number; netPnl: number; avgPct: number }[];
  byMonth: { month: string; trades: number; netPnl: number; winRate: number }[];
  equityCurve: { date: string; cumulative: number; tradePnl: number; ticker: string }[];
  bestDayOfWeek: { day: string; avgPct: number; trades: number }[];
  riskOfRuin: { maxDrawdownUsd: number; maxDrawdownPct: number; recoveryTrades: number | null };
  totalCommission: number;
  commissionAsPctOfPnl: number | null;
  avgRMultiple: number | null;
  tradesWithStop: number;
  rollingWinRate: { index: number; winRate: number; date: string }[];
  distribution: { bucket: string; count: number }[];
  dailyPnl: { date: string; pnl: number; trades: number }[];
};

const SETUPS = ["ATH Breakout", "52W Breakout", "Gap & Go", "Cup & Handle", "אחר"];

function fmtUsd(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}
function fmtPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
function toneOf(n: number) {
  return n > 0 ? "up" : n < 0 ? "down" : "neutral";
}

function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "up" | "down" | "neutral" }) {
  return (
    <Card className="p-5">
      <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">{label}</div>
      <div className={cn(
        "mono text-2xl font-black mt-2",
        tone === "up" && "text-[var(--up)]",
        tone === "down" && "text-[var(--down)]"
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--fg-dim)] mt-1">{sub}</div>}
    </Card>
  );
}

export default function JournalClient({
  initialTrades,
  stats,
  benchmark,
}: {
  initialTrades: Trade[];
  stats: Stats;
  benchmark: Benchmark;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagMsg, setAutoTagMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    ticker: "", quantity: "", buyPrice: "", buyDate: "",
    sellPrice: "", sellDate: "", commission: "", stopPrice: "", setup: "", notes: "",
  });
  const [filterTicker, setFilterTicker] = useState<string | null>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trades/import", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setImportMsg(`יובאו ${json.imported} טריידים חדשים (${json.skipped} דולגו — כפולים/חסרים)`);
        router.refresh();
      } else {
        setImportMsg(`שגיאה: ${json.error}`);
      }
    } catch (err: any) {
      setImportMsg(`שגיאה: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ ticker: "", quantity: "", buyPrice: "", buyDate: "", sellPrice: "", sellDate: "", commission: "", stopPrice: "", setup: "", notes: "" });
    setShowForm(true);
  }

  function openEditForm(t: Trade) {
    setEditingId(t.id);
    setForm({
      ticker: t.ticker,
      quantity: String(t.quantity),
      buyPrice: String(t.buyPrice),
      buyDate: t.buyDate.slice(0, 10),
      sellPrice: t.sellPrice != null ? String(t.sellPrice) : "",
      sellDate: t.sellDate ? t.sellDate.slice(0, 10) : "",
      commission: String(t.commission),
      stopPrice: t.stopPrice != null ? String(t.stopPrice) : "",
      setup: t.setup || "",
      notes: t.notes || "",
    });
    setShowForm(true);
  }

  async function runAutoTag() {
    setAutoTagging(true);
    setAutoTagMsg(null);
    try {
      const res = await fetch("/api/trades/auto-tag", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setAutoTagMsg(`תויגו ${json.tagged} מתוך ${json.checked} טריידים ללא סטאפ`);
        router.refresh();
      } else {
        setAutoTagMsg("שגיאה בזיהוי אוטומטי");
      }
    } finally {
      setAutoTagging(false);
    }
  }

  async function saveTrade() {
    const payload = {
      ticker: form.ticker,
      quantity: Number(form.quantity),
      buyPrice: Number(form.buyPrice),
      buyDate: form.buyDate,
      sellPrice: form.sellPrice || null,
      sellDate: form.sellDate || null,
      commission: form.commission ? Number(form.commission) : 0,
      stopPrice: form.stopPrice || null,
      setup: form.setup || null,
      notes: form.notes || null,
    };
    if (editingId) {
      await fetch(`/api/trades/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setShowForm(false);
    router.refresh();
  }

  async function deleteTrade(id: string) {
    if (!confirm("למחוק את הטרייד?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const filteredTrades = useMemo(() => {
    if (!filterTicker) return initialTrades;
    return initialTrades.filter((t) => t.ticker === filterTicker);
  }, [initialTrades, filterTicker]);

  return (
    <div className="space-y-8">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" onClick={openAddForm}>
          <Plus className="w-4 h-4" /> הוסף טרייד
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
          <Upload className="w-4 h-4" /> {importing ? "מייבא..." : "ייבוא מאקסל"}
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        {stats.totalTrades > 0 && (
          <Button variant="outline" onClick={runAutoTag} disabled={autoTagging}>
            <Sparkles className="w-4 h-4" /> {autoTagging ? "מזהה..." : "זהה סטאפים אוטומטית"}
          </Button>
        )}
        {importMsg && <span className="text-xs text-[var(--fg-dim)]">{importMsg}</span>}
        {autoTagMsg && <span className="text-xs text-[var(--fg-dim)]">{autoTagMsg}</span>}
      </div>

      {/* Losing streak warning */}
      {stats.currentStreak.type === "loss" && stats.currentStreak.count >= 3 && (
        <Card className="p-5 border-[var(--down)]/40 bg-[var(--down-bg)] flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--down)] shrink-0" />
          <div>
            <div className="font-bold text-[var(--down)]">אתה ברצף של {stats.currentStreak.count} הפסדים ברצף</div>
            <div className="text-xs text-[var(--fg-dim)] mt-0.5">שקול להקטין גודל פוזיציה או לקחת הפסקה קצרה עד שהתנאים משתפרים.</div>
          </div>
        </Card>
      )}

      {stats.totalTrades === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-lg font-bold mb-2">אין עדיין טריידים</div>
          <div className="text-sm text-[var(--fg-dim)]">ייבא מהאקסל שלך או הוסף טרייד ראשון ידנית.</div>
        </Card>
      ) : (
        <>
          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.wins}W / ${stats.losses}L`} tone={stats.winRate >= 50 ? "up" : "down"} />
            <StatCard label="Total P&L" value={fmtUsd(stats.totalNetPnl)} tone={toneOf(stats.totalNetPnl)} />
            <StatCard
              label="Profit Factor"
              value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "∞"}
              sub={stats.profitFactor != null && stats.profitFactor >= 1.5 ? "מצוין" : stats.profitFactor != null && stats.profitFactor >= 1 ? "רווחי" : "מתחת ל-1"}
              tone={stats.profitFactor == null || stats.profitFactor >= 1 ? "up" : "down"}
            />
            <StatCard
              label="Expectancy / טרייד"
              value={fmtUsd(stats.expectancy)}
              sub="ממוצע צפוי לכל טרייד"
              tone={toneOf(stats.expectancy)}
            />
            <StatCard
              label="רצף נוכחי"
              value={
                <span className="flex items-center gap-2">
                  {stats.currentStreak.type === "win" ? <Flame className="w-5 h-5 text-[var(--up)]" /> : stats.currentStreak.type === "loss" ? <Snowflake className="w-5 h-5 text-[var(--down)]" /> : null}
                  {stats.currentStreak.count}
                </span>
              }
              sub={stats.currentStreak.type === "win" ? "רצף ניצחונות" : stats.currentStreak.type === "loss" ? "רצף הפסדים" : "—"}
              tone={stats.currentStreak.type === "win" ? "up" : stats.currentStreak.type === "loss" ? "down" : "neutral"}
            />
            <StatCard label="הכי ארוך W/L" value={`${stats.longestWinStreak} / ${stats.longestLossStreak}`} sub="רצפי שיא" />
            <StatCard
              label="זמן החזקה ממוצע"
              value={`${stats.avgHoldDaysWinners.toFixed(0)}d / ${stats.avgHoldDaysLosers.toFixed(0)}d`}
              sub="מנצחים / מפסידים"
            />
            <StatCard label="פוזיציות פתוחות" value={stats.openPositions} sub={`${stats.closedTrades} סגורות`} />
          </div>

          {/* Avg Win/Loss */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">ממוצע ניצחון</div>
              <div className="mono text-xl font-black mt-2 text-[var(--up)]">{fmtPct(stats.avgWinPct)} · {fmtUsd(stats.avgWinUsd)}</div>
            </Card>
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">ממוצע הפסד</div>
              <div className="mono text-xl font-black mt-2 text-[var(--down)]">{fmtPct(stats.avgLossPct)} · {fmtUsd(stats.avgLossUsd)}</div>
            </Card>
          </div>

          {/* Benchmark vs SPY + R-Multiple + Commission */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {benchmark.totalTrades > 0 && (
              <Card className="p-5">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)] flex items-center gap-1.5">
                  <Target className="w-3 h-3" /> Alpha מול SPY
                </div>
                <div className={cn("mono text-xl font-black mt-2", toneOf(benchmark.avgAlphaPct) === "up" ? "text-[var(--up)]" : "text-[var(--down)]")}>
                  {fmtPct(benchmark.avgAlphaPct)}
                </div>
                <div className="text-xs text-[var(--fg-dim)] mt-1">
                  {benchmark.beatMarketRate.toFixed(0)}% מהטריידים ניצחו את SPY
                </div>
              </Card>
            )}
            {stats.tradesWithStop > 0 && (
              <Card className="p-5">
                <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">R-Multiple ממוצע</div>
                <div className={cn("mono text-xl font-black mt-2", stats.avgRMultiple != null && stats.avgRMultiple >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                  {stats.avgRMultiple != null ? `${stats.avgRMultiple >= 0 ? "+" : ""}${stats.avgRMultiple.toFixed(2)}R` : "—"}
                </div>
                <div className="text-xs text-[var(--fg-dim)] mt-1">{stats.tradesWithStop} טריידים עם סטופ מוגדר</div>
              </Card>
            )}
            <Card className="p-5">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">סה״כ עמלות</div>
              <div className="mono text-xl font-black mt-2 text-[var(--fg)]">${stats.totalCommission.toFixed(2)}</div>
              {stats.commissionAsPctOfPnl != null && (
                <div className="text-xs text-[var(--fg-dim)] mt-1">{stats.commissionAsPctOfPnl.toFixed(0)}% מהרווח/הפסד הגולמי</div>
              )}
            </Card>
          </div>

          {/* Equity Curve */}
          {stats.equityCurve.length > 1 && (
            <Card className="p-6">
              <div className="text-sm font-bold mb-4">Equity Curve — הצטברות רווח/הפסד לאורך זמן</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.equityCurve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--up)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--up)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={50} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg)", border: "1px solid var(--border-hi)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "מצטבר"]}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="var(--up)" strokeWidth={2} fill="url(#eqGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 text-xs text-[var(--fg-dim)]">
                Max Drawdown: <span className="text-[var(--down)] font-bold">-${stats.riskOfRuin.maxDrawdownUsd.toFixed(2)}</span>
                {" "}({stats.riskOfRuin.maxDrawdownPct.toFixed(0)}% מהשיא)
              </div>
            </Card>
          )}

          {/* Daily P&L calendars */}
          <PnlCalendar dailyPnl={stats.dailyPnl} />
          <PnlCalendarMonth dailyPnl={stats.dailyPnl} compact />

          {/* Rolling Win Rate */}
          {stats.rollingWinRate.length >= 3 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-bold">מגמת Win Rate (ממוצע נגלל של 10 טריידים אחרונים)</div>
                {(() => {
                  const first = stats.rollingWinRate[0].winRate;
                  const last = stats.rollingWinRate[stats.rollingWinRate.length - 1].winRate;
                  const diff = last - first;
                  const up = diff > 2;
                  const down = diff < -2;
                  return (
                    <span className={cn(
                      "text-xs font-bold flex items-center gap-1",
                      up ? "text-[var(--up)]" : down ? "text-[var(--down)]" : "text-[var(--fg-dim)]"
                    )}>
                      {up && <TrendingUp className="w-3.5 h-3.5" />}
                      {down && <TrendingDown className="w-3.5 h-3.5" />}
                      {diff >= 0 ? "+" : ""}{diff.toFixed(0)} נק׳ מתחילת היומן
                    </span>
                  );
                })()}
              </div>
              <div className="text-xs text-[var(--fg-dim)] mb-4">
                כל נקודה = אחוז הצלחה ב-10 הטריידים שקדמו לה (לא כולל טריידים פתוחים). קו מקווקו = 50% (שובר שוויון).
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.rollingWinRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="index" tick={{ fontSize: 10, fill: "var(--muted)" }} label={{ value: "מספר טרייד סגור", position: "insideBottom", offset: -5, fontSize: 10, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} width={40} domain={[0, 100]} />
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
              <div className="text-xs text-[var(--fg-dim)] mt-3">
                Win Rate נגלל נוכחי: <span className="font-bold text-[var(--fg)]">{stats.rollingWinRate[stats.rollingWinRate.length - 1].winRate.toFixed(0)}%</span>
                {" · "}נקודות ירוקות = מעל 50%, אדומות = מתחת ל-50%
              </div>
            </Card>
          )}

          {/* By Ticker / By Setup */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="text-sm font-bold mb-4">ביצועים לפי מניה</div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {stats.byTicker.map((t) => (
                  <button
                    key={t.ticker}
                    onClick={() => setFilterTicker(filterTicker === t.ticker ? null : t.ticker)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-right",
                      filterTicker === t.ticker ? "border-[var(--up)]/50 bg-[var(--up-bg)]" : "border-[var(--border-hi)] hover:bg-white/5"
                    )}
                  >
                    <span className="mono font-bold">{t.ticker}</span>
                    <span className="text-xs text-[var(--fg-dim)]">{t.trades} טריידים · {t.winRate.toFixed(0)}% WR</span>
                    <span className={cn("mono font-bold", toneOf(t.netPnl) === "up" ? "text-[var(--up)]" : "text-[var(--down)]")}>
                      {fmtUsd(t.netPnl)}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm font-bold mb-4">ביצועים לפי סטאפ</div>
              <div className="space-y-2">
                {stats.bySetup.map((s) => (
                  <div key={s.setup} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-hi)]">
                    <span className="font-bold text-sm">{s.setup}</span>
                    <span className="text-xs text-[var(--fg-dim)]">{s.trades} · {s.winRate.toFixed(0)}% WR · {fmtPct(s.avgPct)}</span>
                    <span className={cn("mono font-bold text-sm", toneOf(s.netPnl) === "up" ? "text-[var(--up)]" : "text-[var(--down)]")}>
                      {fmtUsd(s.netPnl)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Day of week */}
          {stats.bestDayOfWeek.length > 0 && (
            <Card className="p-6">
              <div className="text-sm font-bold mb-4">איזה יום כניסה הכי משתלם לך?</div>
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                {stats.bestDayOfWeek.map((d) => (
                  <div key={d.day} className="rounded-xl border border-[var(--border-hi)] p-3 text-center">
                    <div className="text-xs text-[var(--fg-dim)]">{d.day}</div>
                    <div className={cn("mono font-bold mt-1", toneOf(d.avgPct) === "up" ? "text-[var(--up)]" : "text-[var(--down)]")}>
                      {fmtPct(d.avgPct)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">{d.trades} טריידים</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Best/Worst */}
          <div className="grid md:grid-cols-2 gap-4">
            {stats.bestTrade && (
              <Card className="p-6 border-[var(--up)]/30">
                <div className="flex items-center gap-2 text-[var(--up)] text-xs font-bold uppercase tracking-wider mb-3">
                  <TrendingUp className="w-4 h-4" /> הטרייד הכי טוב
                </div>
                <div className="flex items-center justify-between">
                  <span className="mono font-black text-xl">{stats.bestTrade.ticker}</span>
                  <span className="mono text-xl font-black text-[var(--up)]">{fmtUsd(stats.bestTrade.netPnl)}</span>
                </div>
                <div className="text-xs text-[var(--fg-dim)] mt-2">
                  {fmtPct(stats.bestTrade.pnlPercent)} · {stats.bestTrade.holdDays} ימים · ${stats.bestTrade.buyPrice.toFixed(2)} → ${stats.bestTrade.sellPrice?.toFixed(2)}
                </div>
              </Card>
            )}
            {stats.worstTrade && (
              <Card className="p-6 border-[var(--down)]/30">
                <div className="flex items-center gap-2 text-[var(--down)] text-xs font-bold uppercase tracking-wider mb-3">
                  <TrendingDown className="w-4 h-4" /> הטרייד הכי גרוע
                </div>
                <div className="flex items-center justify-between">
                  <span className="mono font-black text-xl">{stats.worstTrade.ticker}</span>
                  <span className="mono text-xl font-black text-[var(--down)]">{fmtUsd(stats.worstTrade.netPnl)}</span>
                </div>
                <div className="text-xs text-[var(--fg-dim)] mt-2">
                  {fmtPct(stats.worstTrade.pnlPercent)} · {stats.worstTrade.holdDays} ימים · ${stats.worstTrade.buyPrice.toFixed(2)} → ${stats.worstTrade.sellPrice?.toFixed(2)}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Trades Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-[var(--border-hi)]">
          <div className="text-sm font-bold">
            כל הטריידים {filterTicker && <span className="text-[var(--up)]">— {filterTicker}</span>}
          </div>
          {filterTicker && (
            <button onClick={() => setFilterTicker(null)} className="text-xs text-[var(--fg-dim)] flex items-center gap-1">
              <X className="w-3 h-3" /> נקה סינון
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border-hi)]">
                <th className="text-right p-3">טיקר</th>
                <th className="text-right p-3">כמות</th>
                <th className="text-right p-3">כניסה</th>
                <th className="text-right p-3">תאריך כניסה</th>
                <th className="text-right p-3">יציאה</th>
                <th className="text-right p-3">תאריך יציאה</th>
                <th className="text-right p-3">P&L</th>
                <th className="text-right p-3">%</th>
                <th className="text-right p-3">R</th>
                <th className="text-right p-3">סטאפ</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((t) => {
                const isOpen = t.sellPrice == null || t.sellDate == null;
                const pnl = !isOpen ? (t.sellPrice! - t.buyPrice) * t.quantity - t.commission : null;
                const pct = !isOpen ? ((t.sellPrice! - t.buyPrice) / t.buyPrice) * 100 : null;
                const riskPerShare = t.stopPrice != null ? t.buyPrice - t.stopPrice : null;
                const rMult = !isOpen && riskPerShare ? (t.sellPrice! - t.buyPrice) / riskPerShare : null;
                return (
                  <tr key={t.id} className="border-b border-[var(--border-hi)]/50 hover:bg-white/[0.02]">
                    <td className="p-3 mono font-bold">{t.ticker}</td>
                    <td className="p-3 mono">{t.quantity}</td>
                    <td className="p-3 mono">${t.buyPrice.toFixed(2)}</td>
                    <td className="p-3 text-xs text-[var(--fg-dim)]">{new Date(t.buyDate).toLocaleDateString("he-IL")}</td>
                    <td className="p-3 mono">{t.sellPrice != null ? `$${t.sellPrice.toFixed(2)}` : <Badge className="border-[var(--warn)]/30 text-[var(--warn)]">פתוח</Badge>}</td>
                    <td className="p-3 text-xs text-[var(--fg-dim)]">{t.sellDate ? new Date(t.sellDate).toLocaleDateString("he-IL") : "—"}</td>
                    <td className={cn("p-3 mono font-bold", pnl != null ? (pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]") : "text-[var(--muted)]")}>
                      {pnl != null ? fmtUsd(pnl) : "—"}
                    </td>
                    <td className={cn("p-3 mono", pct != null ? (pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]") : "text-[var(--muted)]")}>
                      {pct != null ? fmtPct(pct) : "—"}
                    </td>
                    <td className={cn("p-3 mono text-xs", rMult != null ? (rMult >= 0 ? "text-[var(--up)]" : "text-[var(--down)]") : "text-[var(--muted)]")}>
                      {rMult != null ? `${rMult >= 0 ? "+" : ""}${rMult.toFixed(1)}R` : "—"}
                    </td>
                    <td className="p-3 text-xs text-[var(--fg-dim)]">{t.setup || "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEditForm(t)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--fg-dim)]">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteTrade(t.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--down)]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="text-lg font-bold">{editingId ? "עריכת טרייד" : "טרייד חדש"}</div>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>טיקר</Label>
                <Input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} placeholder="AAPL" />
              </div>
              <div>
                <Label>כמות</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <Label>מחיר כניסה</Label>
                <Input type="number" step="0.01" value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>תאריך כניסה</Label>
                <Input type="date" value={form.buyDate} onChange={(e) => setForm({ ...form, buyDate: e.target.value })} />
              </div>
              <div>
                <Label>מחיר יציאה (ריק = פתוח)</Label>
                <Input type="number" step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
              </div>
              <div>
                <Label>תאריך יציאה</Label>
                <Input type="date" value={form.sellDate} onChange={(e) => setForm({ ...form, sellDate: e.target.value })} />
              </div>
              <div>
                <Label>עמלה ($)</Label>
                <Input type="number" step="0.01" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} />
              </div>
              <div>
                <Label>מחיר סטופ (אופציונלי)</Label>
                <Input type="number" step="0.01" value={form.stopPrice} onChange={(e) => setForm({ ...form, stopPrice: e.target.value })} placeholder="לחישוב R-Multiple" />
              </div>
              <div className="col-span-2">
                <Label>סטאפ</Label>
                <Select value={form.setup} onChange={(e) => setForm({ ...form, setup: e.target.value })}>
                  <option value="">בחר</option>
                  {SETUPS.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="col-span-2">
                <Label>הערות</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="accent" className="flex-1" onClick={saveTrade}>שמור</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
