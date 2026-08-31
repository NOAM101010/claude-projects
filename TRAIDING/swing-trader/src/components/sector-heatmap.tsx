"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Sector = {
  etf: string;
  hebrewName: string;
  englishName: string;
  emoji: string;
  price: number | null;
  changePercent: number | null;
};

function heatClass(pct: number | null): string {
  if (pct == null) return "heat-neu";
  if (pct >= 2) return "heat-pos3";
  if (pct >= 1) return "heat-pos2";
  if (pct >= 0.3) return "heat-pos1";
  if (pct >= -0.3) return "heat-neu";
  if (pct >= -1) return "heat-neg1";
  if (pct >= -2) return "heat-neg2";
  return "heat-neg3";
}

export default function SectorHeatmap() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/sectors", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) {
          setSectors(json.sectors);
          setLoading(false);
        }
      } catch {}
    }
    load();
    const t = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const sorted = [...sectors].sort(
    (a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999)
  );

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1.5">
      {loading
        ? Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl shimmer" />
          ))
        : sorted.map((s) => (
            <a
              key={s.etf}
              href={`https://www.tradingview.com/chart/?symbol=${s.etf}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "rounded-xl border p-2 flex flex-col items-center justify-center h-16 transition-transform hover:scale-105",
                heatClass(s.changePercent)
              )}
              title={s.hebrewName}
            >
              <div className="mono text-[9px] font-bold opacity-80">{s.etf}</div>
              <div className="mono text-sm font-black mt-1">
                {s.changePercent != null
                  ? `${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%`
                  : "—"}
              </div>
            </a>
          ))}
    </div>
  );
}
