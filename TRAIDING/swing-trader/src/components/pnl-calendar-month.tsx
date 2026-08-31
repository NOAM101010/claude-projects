"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

type DailyPnl = { date: string; pnl: number; trades: number };

const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const DOW_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function bgFor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0 || pnl === 0) return "rgba(255,255,255,0.03)";
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
  const alpha = 0.12 + intensity * 0.55;
  return pnl > 0 ? `rgba(16,185,129,${alpha.toFixed(2)})` : `rgba(239,68,68,${alpha.toFixed(2)})`;
}
function borderFor(pnl: number): string {
  if (pnl > 0) return "rgba(16,185,129,0.45)";
  if (pnl < 0) return "rgba(239,68,68,0.45)";
  return "rgba(255,255,255,0.08)";
}

export default function PnlCalendarMonth({
  dailyPnl,
  compact = false,
}: {
  dailyPnl: DailyPnl[];
  compact?: boolean;
}) {
  const dataMap = useMemo(() => {
    const m = new Map<string, DailyPnl>();
    for (const d of dailyPnl) m.set(d.date, d);
    return m;
  }, [dailyPnl]);

  const sortedDates = useMemo(() => dailyPnl.map((d) => d.date).sort(), [dailyPnl]);
  const initial = sortedDates.length
    ? sortedDates[sortedDates.length - 1].slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  const [ym, setYm] = useState(initial); // "YYYY-MM"

  const [year, month] = ym.split("-").map(Number);

  const { weeks, monthTotal, monthTrades, maxAbs } = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const lastOfMonth = new Date(Date.UTC(year, month, 0));
    const startDow = firstOfMonth.getUTCDay();
    const gridStart = new Date(firstOfMonth.getTime() - startDow * 86400000);

    const days: { date: string; inMonth: boolean; dayNum: number }[] = [];
    let cursor = new Date(gridStart);
    while (days.length < 42) {
      const dateStr = cursor.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        inMonth: cursor.getUTCMonth() === month - 1,
        dayNum: cursor.getUTCDate(),
      });
      cursor = new Date(cursor.getTime() + 86400000);
    }
    // Trim trailing all-empty week
    while (days.length > 35 && days.slice(-7).every((d) => !d.inMonth)) {
      days.splice(-7, 7);
    }

    const weeksArr: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) weeksArr.push(days.slice(i, i + 7));

    const monthPrefix = ym;
    const monthDays = dailyPnl.filter((d) => d.date.startsWith(monthPrefix));
    const total = monthDays.reduce((s, d) => s + d.pnl, 0);
    const tradeCount = monthDays.reduce((s, d) => s + d.trades, 0);
    const maxAbsVal = Math.max(1, ...monthDays.map((d) => Math.abs(d.pnl)));

    return { weeks: weeksArr, monthTotal: total, monthTrades: tradeCount, maxAbs: maxAbsVal };
  }, [year, month, ym, dailyPnl]);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYm(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  if (dailyPnl.length === 0) return null;

  const minYm = sortedDates[0]?.slice(0, 7);
  const maxYm = sortedDates[sortedDates.length - 1]?.slice(0, 7);
  const atMin = minYm && ym <= minYm;
  const atMax = maxYm && ym >= maxYm && ym >= new Date().toISOString().slice(0, 7);

  return (
    <Card className={compact ? "p-4" : "p-6"}>
      <div className={cn("mx-auto", compact && "max-w-[280px]")}>
        <div className="flex items-center justify-between mb-1">
          <div className={cn("font-bold", compact ? "text-xs" : "text-sm")}>לוח שנה חודשי</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              disabled={!!atMin}
              className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--fg-dim)]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className={cn("font-bold text-center", compact ? "text-xs min-w-[80px]" : "text-sm min-w-[110px]")}>
              {compact ? `${MONTHS_HE[month - 1].slice(0, 3)}׳ ${year}` : `${MONTHS_HE[month - 1]} ${year}`}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              disabled={!!atMax}
              className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-[var(--fg-dim)]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className={cn("text-[var(--fg-dim)]", compact ? "text-[10px] mb-2" : "text-xs mb-4")}>
          {monthTrades} טריידים · סה״כ{" "}
          <span className={cn("font-bold", monthTotal >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
            {monthTotal >= 0 ? "+" : ""}${monthTotal.toFixed(2)}
          </span>
        </div>

        <div className={cn("grid grid-cols-7", compact ? "gap-1 mb-1" : "gap-1.5 mb-1.5")}>
          {DOW_HE.map((d) => (
            <div key={d} className={cn("text-center font-bold text-[var(--muted)] uppercase", compact ? "text-[9px]" : "text-[10px]")}>
              {d}
            </div>
          ))}
        </div>

        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          {weeks.map((week, wi) => (
            <div key={wi} className={cn("grid grid-cols-7", compact ? "gap-1" : "gap-1.5")}>
              {week.map((day, di) => {
                const data = dataMap.get(day.date);
                const pnl = data?.pnl ?? 0;
                const hasTrades = !!data && data.trades > 0;
                return (
                  <div
                    key={di}
                    className={cn(
                      "aspect-square border flex flex-col items-center justify-center transition-transform",
                      compact ? "rounded-md p-0.5" : "rounded-xl p-1",
                      day.inMonth ? "hover:scale-105" : "opacity-25 pointer-events-none"
                    )}
                    style={{
                      background: day.inMonth ? bgFor(pnl, maxAbs) : "transparent",
                      borderColor: day.inMonth ? borderFor(pnl) : "rgba(255,255,255,0.06)",
                    }}
                    title={hasTrades ? `${day.date}: $${pnl.toFixed(2)} (${data!.trades} טריידים)` : day.date}
                  >
                    <span className={cn("text-[var(--muted)] leading-none mb-0.5", compact ? "text-[8px]" : "text-[10px]")}>{day.dayNum}</span>
                    {hasTrades && (
                      <span
                        className={cn(
                          "mono font-bold leading-none",
                          compact ? "text-[8px]" : "text-[10px] sm:text-xs",
                          pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                        )}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {Math.abs(pnl) >= 1000 ? `${(pnl / 1000).toFixed(1)}k` : pnl.toFixed(0)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
