"use client";

import { useEffect, useState } from "react";

function usIsOpen(now: Date) {
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  const preOpen = 4 * 60;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const afterEnd = 20 * 60;
  if (day === 0 || day === 6) return { state: "closed", label: "סגור", color: "text-[var(--muted)]", dot: "bg-[var(--muted-2)]" };
  if (mins < preOpen) return { state: "closed", label: "סגור", color: "text-[var(--muted)]", dot: "bg-[var(--muted-2)]" };
  if (mins < open) return { state: "pre", label: "Pre-Market", color: "text-[var(--warn)]", dot: "bg-[var(--warn)]" };
  if (mins < close) return { state: "open", label: "שוק פתוח", color: "text-[var(--up)]", dot: "bg-[var(--up)]" };
  if (mins < afterEnd) return { state: "after", label: "After Hours", color: "text-[var(--warn)]", dot: "bg-[var(--warn)]" };
  return { state: "closed", label: "סגור", color: "text-[var(--muted)]", dot: "bg-[var(--muted-2)]" };
}

export default function MarketClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="h-4 w-32 rounded shimmer" />;
  const state = usIsOpen(now);
  const il = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" });

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${state.dot} ${state.state === "open" || state.state === "pre" || state.state === "after" ? "pulse-dot" : ""}`}
          style={state.state === "open" ? { boxShadow: "0 0 12px var(--up)" } : undefined}
        />
        <span className={`font-bold ${state.color}`}>{state.label}</span>
      </div>
      <div className="mono text-[var(--fg-dim)]">
        {il}
        <span className="text-[var(--muted)] text-[9px] tracking-wider uppercase mr-1">IL</span>
      </div>
    </div>
  );
}
