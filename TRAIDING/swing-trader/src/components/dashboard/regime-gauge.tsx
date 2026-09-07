"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "./use-count-up";

type Props = {
  score: number; // -100..100
  label: string;
  tone: "up" | "down" | "neutral";
};

const CX = 100;
const CY = 106;
const R = 82;

function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
}

/**
 * Market regime read as a physical instrument: engraved bezel, minor/major
 * ticks, a counterweighted needle that swings in on mount and eases between
 * readings, and a travelling hot dot on the arc. Colour follows direction.
 */
export default function RegimeGauge({ score, label, tone }: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setArmed(true), 60);
    return () => window.clearTimeout(id);
  }, []);

  const clamped = Math.max(-100, Math.min(100, Math.round(score)));
  const angle = armed ? (clamped / 100) * 90 : -90;
  const animated = useCountUp(armed ? clamped : 0, 1400);

  const color =
    tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--warn)";
  const glow =
    tone === "up"
      ? "rgba(16,185,129,0.30)"
      : tone === "down"
      ? "rgba(239,68,68,0.30)"
      : "rgba(245,158,11,0.26)";

  return (
    <div className="gauge-wrap">
      <div
        className="gauge-halo gauge-pulse"
        style={{
          background: `radial-gradient(ellipse 62% 78% at 50% 88%, ${glow}, transparent 68%)`,
        }}
        aria-hidden
      />
      <svg
        viewBox="0 0 200 152"
        className="w-full max-w-[330px] relative"
        role="img"
        aria-label={`מצב שוק ${clamped}, ${label}`}
      >
        <defs>
          <linearGradient id="regimeArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--down)" />
            <stop offset="34%" stopColor="var(--down-2)" />
            <stop offset="50%" stopColor="var(--warn)" />
            <stop offset="66%" stopColor="var(--up-2)" />
            <stop offset="100%" stopColor="var(--up)" />
          </linearGradient>
          <filter id="regimeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* bezel */}
        <path
          d={`M ${CX - R - 9} ${CY} A ${R + 9} ${R + 9} 0 0 1 ${CX + R + 9} ${CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
        {/* track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* live spectrum */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#regimeArc)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* minor ticks every 10 pts, major every 50 */}
        {Array.from({ length: 21 }, (_, k) => {
          const v = -100 + k * 10;
          const a = (v / 100) * 90;
          const major = v % 50 === 0;
          const p1 = polar(a, R - 8);
          const p2 = polar(a, major ? R - 19 : R - 14);
          return (
            <line
              key={v}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={major ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)"}
              strokeWidth={major ? 1.4 : 1}
            />
          );
        })}
        {/* engraved scale numbers */}
        {[-100, 0, 100].map((v) => {
          const p = polar((v / 100) * 90, R - 35);
          return (
            <text
              key={v}
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fill="var(--muted-2)"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                letterSpacing: "0.06em",
                direction: "ltr",
              }}
            >
              {v > 0 ? `+${v}` : v}
            </text>
          );
        })}

        {/* travelling hot dot on the arc */}
        <g
          className="gauge-needle-g"
          style={{ transform: `rotate(${angle}deg)`, transformBox: "view-box" }}
        >
          <circle cx={CX} cy={CY - R} r="4" fill={color} filter="url(#regimeGlow)" />
          {/* needle + counterweight */}
          <line
            x1={CX}
            y1={CY + 13}
            x2={CX}
            y2={CY - R + 12}
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <line
            x1={CX}
            y1={CY + 13}
            x2={CX}
            y2={CY - R + 12}
            stroke={color}
            strokeWidth="1"
            strokeLinecap="round"
            opacity={0.65}
            filter="url(#regimeGlow)"
          />
        </g>
        <circle cx={CX} cy={CY} r="8" fill="#0a0d14" stroke={color} strokeWidth="1.4" />
        <circle cx={CX} cy={CY} r="2.6" fill={color} />
        <circle cx={CX} cy={CY} r="14" fill="none" stroke={color} strokeOpacity="0.18" />

        {/* readout, engraved into the dial face */}
        <text
          x={CX}
          y={CY + 40}
          textAnchor="middle"
          fill={color}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 22,
            fontWeight: 700,
            direction: "ltr",
          }}
        >
          {animated > 0 ? "+" : ""}
          {Math.round(animated)}
        </text>
      </svg>

      <div className="-mt-1 text-center">
        <div
          className={cn(
            "text-[10px] uppercase tracking-[0.28em] font-bold",
            tone === "up" && "text-[var(--up)]",
            tone === "down" && "text-[var(--down)]",
            tone === "neutral" && "text-[var(--warn)]"
          )}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
