"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  score: number; // -100..100
  label: string;
  tone: "up" | "down" | "neutral";
};

export default function RegimeGauge({ score, label, tone }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const clamped = Math.max(-100, Math.min(100, score));
  // -100 -> -90deg, 0 -> 0deg, +100 -> +90deg
  const angle = mounted ? (clamped / 100) * 90 : 0;

  const toneColor =
    tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--warn)";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[280px]">
        <defs>
          <linearGradient id="regimeArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--down)" />
            <stop offset="50%" stopColor="var(--warn)" />
            <stop offset="100%" stopColor="var(--up)" />
          </linearGradient>
        </defs>

        {/* track */}
        <path
          d="M 12 100 A 88 88 0 0 1 188 100"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* colored arc */}
        <path
          d="M 12 100 A 88 88 0 0 1 188 100"
          fill="none"
          stroke="url(#regimeArc)"
          strokeWidth="14"
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* ticks */}
        {[-90, -45, 0, 45, 90].map((a) => {
          const rad = ((a - 90) * Math.PI) / 180;
          const x1 = 100 + Math.cos(rad) * 74;
          const y1 = 100 + Math.sin(rad) * 74;
          const x2 = 100 + Math.cos(rad) * 84;
          const y2 = 100 + Math.sin(rad) * 84;
          return (
            <line
              key={a}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="2"
            />
          );
        })}

        {/* needle */}
        <g
          className="gauge-needle"
          style={{ transform: `rotate(${angle}deg)`, transformBox: "view-box" }}
        >
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="26"
            stroke={toneColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
        <circle cx="100" cy="100" r="7" fill={toneColor} />
        <circle cx="100" cy="100" r="12" fill="none" stroke={toneColor} strokeOpacity="0.3" strokeWidth="2" />
      </svg>

      <div className="mt-1 text-center">
        <div
          className={cn(
            "mono text-2xl font-black",
            tone === "up" && "text-[var(--up)]",
            tone === "down" && "text-[var(--down)]",
            tone === "neutral" && "text-[var(--warn)]"
          )}
        >
          {clamped > 0 ? "+" : ""}
          {clamped}
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--fg-dim)] mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
}
