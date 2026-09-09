"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui";
import { useCountUp } from "@/components/dashboard/use-count-up";
import { cn, formatCurrency } from "@/lib/utils";
import "./reports.css";

type DailyPnl = { date: string; pnl: number; trades: number; winRate: number };
type WeeklyPnl = { weekStart: string; pnl: number; trades: number; winRate: number };

type ReportsData = {
  ok: boolean;
  dailyPnl: DailyPnl[];
  weeklyPnl: WeeklyPnl[];
  winRate: number;
  totalNetPnl: number;
  closedTrades: number;
};

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_HE = [
  "בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
  "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר",
];
const DOW_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function ymNow(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** heat tier class for a day cell: bright -> dark by |pnl| share of the month peak */
function tierClass(pnl: number, maxAbs: number): string {
  if (pnl === 0) return "rp-day--flat";
  const r = Math.min(Math.abs(pnl) / Math.max(maxAbs, 1), 1);
  const dir = pnl > 0 ? "up" : "down";
  const step = r > 0.66 ? 3 : r > 0.33 ? 2 : 1;
  return `rp-t${step}-${dir}`;
}

function shortMoney(n: number): string {
  const a = Math.abs(n);
  const body = a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a.toFixed(0);
  return `${n >= 0 ? "+" : "−"}$${body}`;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("shimmer", className)} />;
}

function SignedCurrency({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn(n >= 0 ? "rp-up" : "rp-down", className)}>
      {n >= 0 ? "+" : "−"}
      {formatCurrency(Math.abs(n), 0)}
    </span>
  );
}

/** "3–9 ביוני" from an ISO week-start date */
function weekSpanLabel(weekStartIso: string): string {
  const start = new Date(weekStartIso + "T00:00:00Z");
  const end = new Date(start.getTime() + 6 * 86400000);
  const d1 = start.getUTCDate();
  const d2 = end.getUTCDate();
  const m1 = start.getUTCMonth();
  const m2 = end.getUTCMonth();
  if (m1 === m2) return `${d1}–${d2} ${MONTHS_HE[m2]}`;
  return `${d1} ${MONTHS_HE[m1].replace("ב", "ל")} – ${d2} ${MONTHS_HE[m2]}`;
}

export default function ReportsClient() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ym, setYm] = useState<string>(ymNow());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/reports");
        const json = (await res.json()) as ReportsData;
        if (!alive) return;
        if (!json.ok) throw new Error("failed");
        setData(json);
        if (json.dailyPnl.length) {
          setYm(json.dailyPnl[json.dailyPnl.length - 1].date.slice(0, 7));
        }
      } catch {
        if (alive) setError("לא הצלחתי לטעון את הביצועים");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dailyMap = useMemo(() => {
    const m = new Map<string, DailyPnl>();
    for (const d of data?.dailyPnl ?? []) m.set(d.date, d);
    return m;
  }, [data]);

  const [year, month] = ym.split("-").map(Number);

  const monthDays = useMemo(
    () => (data?.dailyPnl ?? []).filter((d) => d.date.startsWith(ym)),
    [data, ym]
  );

  const monthStats = useMemo(() => {
    if (!monthDays.length) return null;
    const best = monthDays.reduce((a, b) => (b.pnl > a.pnl ? b : a));
    const worst = monthDays.reduce((a, b) => (b.pnl < a.pnl ? b : a));
    const profitDays = monthDays.filter((d) => d.pnl > 0).length;
    const lossDays = monthDays.filter((d) => d.pnl < 0).length;
    const totalPnl = monthDays.reduce((s, d) => s + d.pnl, 0);
    const totalTrades = monthDays.reduce((s, d) => s + d.trades, 0);
    return {
      best,
      worst,
      profitDays,
      lossDays,
      totalPnl,
      totalTrades,
      avgDaily: totalPnl / monthDays.length,
    };
  }, [monthDays]);

  const grid = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const startDow = firstOfMonth.getUTCDay();
    const gridStart = new Date(firstOfMonth.getTime() - startDow * 86400000);
    const days: { date: string; inMonth: boolean; dayNum: number }[] = [];
    let cursor = new Date(gridStart);
    while (days.length < 42) {
      days.push({
        date: cursor.toISOString().slice(0, 10),
        inMonth: cursor.getUTCMonth() === month - 1,
        dayNum: cursor.getUTCDate(),
      });
      cursor = new Date(cursor.getTime() + 86400000);
    }
    while (days.length > 35 && days.slice(-7).every((d) => !d.inMonth)) {
      days.splice(-7, 7);
    }
    const weeks: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [year, month]);

  const maxAbs = useMemo(
    () => Math.max(1, ...monthDays.map((d) => Math.abs(d.pnl))),
    [monthDays]
  );

  const sortedDates = data?.dailyPnl.map((d) => d.date) ?? [];
  const minYm = sortedDates[0]?.slice(0, 7);
  const atMin = !!minYm && ym <= minYm;
  const atMax = ym >= ymNow();
  const atThisMonth = ym === ymNow();

  const animatedTotal = useCountUp(data?.totalNetPnl ?? 0);

  if (loading) {
    return (
      <div className="rp space-y-8">
        <Shimmer className="h-32 w-full rounded-2xl" />
        <div className="grid lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-8 p-5 md:p-6">
            <div className="rp-skel-grid mb-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Shimmer key={i} className="h-3 rounded" />
              ))}
            </div>
            <div className="rp-skel-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <Shimmer key={i} className="rp-skel-cell" />
              ))}
            </div>
          </Card>
          <Card className="lg:col-span-4 p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Shimmer key={i} className="h-6 rounded" />
            ))}
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-10 text-center text-sm text-[var(--down)]">{error}</Card>
    );
  }

  if (!data || !data.closedTrades) {
    return (
      <Card className="p-12 text-center">
        <div className="display-serif text-2xl mb-2">אין עדיין טריידים סגורים</div>
        <p className="text-sm text-[var(--fg-dim)]">
          הוסף וסגור טרייד ביומן — והביצועים יתחילו להיבנות כאן.
        </p>
      </Card>
    );
  }

  const monthWeeks = (data.weeklyPnl ?? []).filter((w) => {
    const end = new Date(new Date(w.weekStart + "T00:00:00Z").getTime() + 6 * 86400000);
    return w.weekStart.startsWith(ym) || end.toISOString().slice(0, 7) === ym;
  });

  return (
    <div className="rp space-y-8">
      {/* hero: all-time net P&L, engraved — + month stepper */}
      <div className="metal-panel rp-hero">
        <div>
          <div className="rp-hero-k">Net P&amp;L · All time</div>
          <div className="rp-hero-num">
            {animatedTotal >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(animatedTotal), 0)}
          </div>
          <div className="rp-hero-sub">
            {data.closedTrades} closed · {data.winRate.toFixed(0)}% win rate
          </div>
        </div>

        <div className="rp-nav">
          <button
            onClick={() => setYm(shiftYm(ym, -1))}
            disabled={atMin}
            aria-label="חודש קודם"
            className="btn-metal rp-nav-key disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="rp-nav-label">
            {MONTHS_EN[month - 1]} {year}
          </div>
          <button
            onClick={() => setYm(shiftYm(ym, 1))}
            disabled={atMax}
            aria-label="חודש הבא"
            className="btn-metal rp-nav-key disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setYm(ymNow())}
            className={cn(
              "btn-metal rounded-[10px] px-3.5 h-[34px] text-xs font-semibold",
              atThisMonth && "btn-metal--active"
            )}
          >
            החודש הזה
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* the ledger wall */}
        <Card className="lg:col-span-8 p-5 md:p-6 holo-edge">
          <div className="rp-cal-scroll no-scrollbar">
            <div className="rp-cal">
              <div className="rp-dow-row">
                {DOW_HE.map((d) => (
                  <div key={d} className="rp-dow">{d}</div>
                ))}
              </div>
              {grid.map((week, wi) => (
                <div key={wi} className="rp-week-row">
                  {week.map((day, di) => {
                    const d = dailyMap.get(day.date);
                    const has = !!d && d.trades > 0;
                    const pnl = d?.pnl ?? 0;
                    return (
                      <div
                        key={di}
                        className={cn(
                          "rp-day",
                          !day.inMonth && "rp-day--out",
                          day.inMonth && has && "rp-day--live",
                          day.inMonth && has && tierClass(pnl, maxAbs),
                          day.inMonth && !has && "rp-day--flat"
                        )}
                        title={
                          has
                            ? `${day.date}: ${formatCurrency(pnl, 2)} · ${d!.trades} טריידים · ${d!.winRate.toFixed(0)}% הצלחה`
                            : day.date
                        }
                      >
                        <span className="rp-day-n">{day.dayNum}</span>
                        {day.inMonth && has && (
                          <div className="rp-day-body">
                            <span
                              className={cn(
                                "rp-day-pnl",
                                pnl >= 0 ? "rp-up" : "rp-down"
                              )}
                            >
                              {shortMoney(pnl)}
                            </span>
                            <span className="rp-day-meta">
                              {d!.trades}T · {d!.winRate.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* month stats */}
        <Card className="lg:col-span-4 p-6 holo-edge holo-edge--amber">
          <h3 className="rp-panel-title mb-4">סטטיסטיקות החודש</h3>
          {monthStats ? (
            <dl>
              <div className="rp-stat">
                <dt className="rp-stat-k">P&amp;L החודש</dt>
                <dd className="rp-stat-v">
                  <SignedCurrency n={monthStats.totalPnl} />
                </dd>
              </div>
              <div className="rp-stat">
                <dt className="rp-stat-k">יום הכי טוב</dt>
                <dd>
                  <span className="rp-chip rp-chip--up">
                    {monthStats.best.date.slice(8)} · {shortMoney(monthStats.best.pnl)}
                  </span>
                </dd>
              </div>
              <div className="rp-stat">
                <dt className="rp-stat-k">יום הכי גרוע</dt>
                <dd>
                  <span className="rp-chip rp-chip--down">
                    {monthStats.worst.date.slice(8)} · {shortMoney(monthStats.worst.pnl)}
                  </span>
                </dd>
              </div>
              <div className="rp-stat">
                <dt className="rp-stat-k">ימי רווח / הפסד</dt>
                <dd className="rp-stat-v">
                  <span className="rp-up">{monthStats.profitDays}</span>
                  {" / "}
                  <span className="rp-down">{monthStats.lossDays}</span>
                </dd>
              </div>
              <div className="rp-stat">
                <dt className="rp-stat-k">ממוצע יומי</dt>
                <dd className="rp-stat-v">
                  <SignedCurrency n={monthStats.avgDaily} />
                </dd>
              </div>
              <div className="rp-stat">
                <dt className="rp-stat-k">סה&quot;כ טריידים</dt>
                <dd className="rp-stat-v">{monthStats.totalTrades}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[var(--fg-dim)] py-6 text-center">
              אין טריידים סגורים בחודש הזה.
            </p>
          )}
        </Card>
      </div>

      {/* weekly summaries */}
      <Card className="p-6 holo-edge">
        <h3 className="rp-panel-title mb-4">סיכומי שבוע</h3>
        {monthWeeks.length ? (
          <div>
            {monthWeeks.map((w) => (
              <div
                key={w.weekStart}
                className={cn(
                  "rp-week",
                  w.pnl > 0 ? "rp-week--up" : w.pnl < 0 ? "rp-week--down" : "rp-week--flat"
                )}
              >
                <span className="rp-week-span">שבוע {weekSpanLabel(w.weekStart)}</span>
                <div className="rp-week-figs">
                  <span className="rp-week-muted">{w.trades} עסקאות</span>
                  <span className="rp-week-muted">{w.winRate.toFixed(0)}%</span>
                  <SignedCurrency n={w.pnl} className="font-bold" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-dim)] py-4 text-center">
            אין שבועות עם טריידים בחודש הזה.
          </p>
        )}
      </Card>
    </div>
  );
}
