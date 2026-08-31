"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

type DailyPnl = { date: string; pnl: number; trades: number };

const MONTHS_HE = [
  "ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יונ׳",
  "יול׳", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳",
];
const DOW_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function colorFor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0) return "rgba(255,255,255,0.04)";
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
  if (pnl > 0) {
    const alpha = 0.15 + intensity * 0.75;
    return `rgba(16,185,129,${alpha.toFixed(2)})`;
  }
  if (pnl < 0) {
    const alpha = 0.15 + intensity * 0.75;
    return `rgba(239,68,68,${alpha.toFixed(2)})`;
  }
  return "rgba(255,255,255,0.08)";
}

export default function PnlCalendar({ dailyPnl }: { dailyPnl: DailyPnl[] }) {
  const years = useMemo(() => {
    const set = new Set(dailyPnl.map((d) => d.date.slice(0, 4)));
    return Array.from(set).sort();
  }, [dailyPnl]);

  const [year, setYear] = useState(years[years.length - 1] ?? String(new Date().getFullYear()));

  const dataMap = useMemo(() => {
    const m = new Map<string, DailyPnl>();
    for (const d of dailyPnl) m.set(d.date, d);
    return m;
  }, [dailyPnl]);

  const { weeks, monthLabels, maxAbs } = useMemo(() => {
    const yearNum = Number(year);
    const jan1 = new Date(Date.UTC(yearNum, 0, 1));
    const dec31 = new Date(Date.UTC(yearNum, 11, 31));
    // Start grid on the Sunday on/before Jan 1
    const startDow = jan1.getUTCDay();
    const gridStart = new Date(jan1.getTime() - startDow * 86400000);

    const days: { date: string; inYear: boolean; dow: number }[] = [];
    let cursor = new Date(gridStart);
    while (cursor <= dec31 || days.length % 7 !== 0) {
      const dateStr = cursor.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        inYear: cursor.getUTCFullYear() === yearNum,
        dow: cursor.getUTCDay(),
      });
      cursor = new Date(cursor.getTime() + 86400000);
      if (cursor > dec31 && cursor.getUTCDay() === 0) break;
    }

    const weeksArr: { date: string; inYear: boolean; dow: number }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7));
    }

    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    weeksArr.forEach((week, wi) => {
      const firstInYearDay = week.find((d) => d.inYear);
      if (!firstInYearDay) return;
      const m = Number(firstInYearDay.date.slice(5, 7)) - 1;
      if (m !== lastMonth) {
        labels.push({ weekIndex: wi, label: MONTHS_HE[m] });
        lastMonth = m;
      }
    });

    const maxAbsVal = Math.max(
      1,
      ...dailyPnl.filter((d) => d.date.startsWith(year)).map((d) => Math.abs(d.pnl))
    );

    return { weeks: weeksArr, monthLabels: labels, maxAbs: maxAbsVal };
  }, [year, dailyPnl]);

  const [hover, setHover] = useState<DailyPnl | null>(null);

  const yearTotal = dailyPnl
    .filter((d) => d.date.startsWith(year))
    .reduce((s, d) => s + d.pnl, 0);
  const yearTradingDays = dailyPnl.filter((d) => d.date.startsWith(year)).length;

  if (dailyPnl.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="text-sm font-bold">מפת רווח/הפסד יומית</div>
        {years.length > 1 && (
          <div className="flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold border transition-colors",
                  y === year
                    ? "border-[var(--up)]/40 bg-[var(--up-bg)] text-[var(--up)]"
                    : "border-[var(--border-hi)] text-[var(--fg-dim)] hover:text-[var(--fg)]"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="text-xs text-[var(--fg-dim)] mb-4">
        {yearTradingDays} ימי מסחר ב-{year} · סה״כ{" "}
        <span className={cn("font-bold", yearTotal >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
          {yearTotal >= 0 ? "+" : ""}${yearTotal.toFixed(2)}
        </span>
      </div>

      <div dir="ltr" className="overflow-x-auto">
        <div className="inline-block min-w-max">
          <div className="flex gap-[5px] mb-2 relative h-5">
            {monthLabels.map((m) => (
              <div
                key={m.weekIndex}
                className="absolute text-xs font-semibold text-[var(--muted)]"
                style={{ left: m.weekIndex * 23 }}
              >
                {m.label}
              </div>
            ))}
          </div>
          <div className="flex gap-[5px]">
            <div className="flex flex-col gap-[5px] justify-between pt-0.5 ml-1">
              {DOW_HE.map((d, i) => (
                <div key={i} className="h-[18px] text-[11px] text-[var(--muted)] leading-none w-4">
                  {i % 2 === 1 ? d : ""}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[5px]">
                {week.map((day, di) => {
                  const data = dataMap.get(day.date);
                  return (
                    <div
                      key={di}
                      onMouseEnter={() => day.inYear && setHover(data ?? { date: day.date, pnl: 0, trades: 0 })}
                      onMouseLeave={() => setHover(null)}
                      className={cn(
                        "w-[18px] h-[18px] rounded-[4px] transition-transform hover:scale-125 hover:z-10 relative",
                        !day.inYear && "opacity-0 pointer-events-none"
                      )}
                      style={{
                        background: day.inYear ? colorFor(data?.pnl ?? 0, maxAbs) : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-[var(--fg-dim)] h-4">
          {hover && hover.trades > 0 ? (
            <span>
              {new Date(hover.date).toLocaleDateString("he-IL")} ·{" "}
              <span className={cn("font-bold", hover.pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]")}>
                {hover.pnl >= 0 ? "+" : ""}${hover.pnl.toFixed(2)}
              </span>{" "}
              · {hover.trades} טריידים
            </span>
          ) : hover ? (
            <span>{new Date(hover.date).toLocaleDateString("he-IL")} · אין טריידים</span>
          ) : (
            "עבור עם העכבר על יום כדי לראות פרטים"
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
          <span>הפסד</span>
          <span className="w-3 h-3 rounded-[3px]" style={{ background: "rgba(239,68,68,0.8)" }} />
          <span className="w-3 h-3 rounded-[3px]" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="w-3 h-3 rounded-[3px]" style={{ background: "rgba(16,185,129,0.8)" }} />
          <span>רווח</span>
        </div>
      </div>
    </Card>
  );
}
