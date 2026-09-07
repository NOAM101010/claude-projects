"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export type EquityPoint = {
  date: string;
  cumulative: number;
  tradePnl?: number;
  ticker: string;
};

type Mark = {
  i: number;
  y: number;
  kind: "best" | "worst" | "dd";
  label: string;
  amount: number;
  ticker: string;
};

const TONE: Record<Mark["kind"], string> = {
  best: "var(--up)",
  worst: "var(--down)",
  dd: "var(--warn)",
};

/** best / worst / max-drawdown, derived from the curve itself — no API change */
function findMarks(points: EquityPoint[]): Mark[] {
  if (points.length < 3) return [];
  let bi = -1;
  let wi = -1;
  let best = 0;
  let worst = 0;
  points.forEach((p, i) => {
    const v = p.tradePnl ?? 0;
    if (v > best) {
      best = v;
      bi = i;
    }
    if (v < worst) {
      worst = v;
      wi = i;
    }
  });

  let peak = -Infinity;
  let maxDd = 0;
  let ddI = -1;
  points.forEach((p, i) => {
    if (p.cumulative > peak) peak = p.cumulative;
    const dd = peak - p.cumulative;
    if (dd > maxDd) {
      maxDd = dd;
      ddI = i;
    }
  });

  const marks: Mark[] = [];
  if (bi >= 0)
    marks.push({
      i: bi,
      y: points[bi].cumulative,
      kind: "best",
      label: "BEST",
      amount: best,
      ticker: points[bi].ticker,
    });
  if (wi >= 0 && wi !== bi)
    marks.push({
      i: wi,
      y: points[wi].cumulative,
      kind: "worst",
      label: "WORST",
      amount: worst,
      ticker: points[wi].ticker,
    });
  // a drawdown trough sitting on top of the worst trade would just overlap
  if (ddI >= 0 && maxDd > 0 && ddI !== wi && ddI !== bi)
    marks.push({
      i: ddI,
      y: points[ddI].cumulative,
      kind: "dd",
      label: "DRAWDOWN",
      amount: -maxDd,
      ticker: points[ddI].ticker,
    });

  return marks;
}

function money(n: number) {
  const s = formatCurrency(Math.abs(n), 0);
  return `${n < 0 ? "-" : "+"}${s}`;
}

/** dashed detection frame + mono caption, drawn inside the chart's own svg */
function DetectionBox({
  cx,
  cy,
  mark,
  delay,
  height,
}: {
  cx: number;
  cy: number;
  mark: Mark;
  delay: number;
  height: number;
}) {
  const w = 46;
  const h = 30;
  const color = TONE[mark.kind];
  const text = `${mark.label} · ${money(mark.amount)}`;
  const chipW = text.length * 5.4 + 16;
  // deterministic slots so two nearby marks never stack their captions:
  // the peak labels up, the loss labels down, the drawdown one step lower.
  const wantAbove = mark.kind === "best";
  const drop = mark.kind === "dd" ? 24 : 0;
  const above = wantAbove && cy - h / 2 - 26 > 4;
  const chipY = above
    ? cy - h / 2 - 24
    : Math.min(cy + h / 2 + 8 + drop, height - 22);
  // the worst trade and the drawdown trough often sit next to each other —
  // offset the "worst" caption sideways so the two never touch
  const chipX = Math.max(
    2,
    mark.kind === "worst" ? cx - chipW - 10 : cx - chipW / 2
  );
  const chipMid = chipX + chipW / 2;
  const t = 6;

  return (
    <g className="det-g" style={{ animationDelay: `${delay}ms` }}>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        fill={color}
        fillOpacity={0.06}
        stroke={color}
        strokeOpacity={0.55}
        strokeWidth={1}
        className="det-rect"
      />
      {/* corner ticks */}
      {(
        [
          [cx - w / 2, cy - h / 2, 1, 1],
          [cx + w / 2, cy - h / 2, -1, 1],
          [cx - w / 2, cy + h / 2, 1, -1],
          [cx + w / 2, cy + h / 2, -1, -1],
        ] as const
      ).map(([x, y, dx, dy], k) => (
        <path
          key={k}
          d={`M ${x + dx * t} ${y} L ${x} ${y} L ${x} ${y + dy * t}`}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
        />
      ))}
      <circle cx={cx} cy={cy} r={3} fill={color} />
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={color} strokeOpacity={0.35} />
      {/* leader line */}
      <polyline
        points={
          above
            ? `${cx},${cy - h / 2} ${cx},${chipY + 15}`
            : `${cx},${cy + h / 2} ${cx},${chipY + 7.5} ${chipMid},${chipY + 7.5}`
        }
        fill="none"
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1}
      />
      <rect
        x={chipX}
        y={chipY}
        width={chipW}
        height={15}
        fill="rgba(6,8,13,0.9)"
        stroke={color}
        strokeOpacity={0.6}
        strokeWidth={1}
      />
      <text
        className="det-text"
        x={chipMid}
        y={chipY + 10.5}
        textAnchor="middle"
        fill={color}
      >
        {text}
      </text>
    </g>
  );
}

export default function EquityPanel({
  points,
  height = 260,
}: {
  points: EquityPoint[];
  height?: number;
}) {
  const data = useMemo(() => points.map((p, i) => ({ ...p, i })), [points]);
  const marks = useMemo(() => findMarks(points), [points]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 26, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dashEq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--up)" stopOpacity={0.34} />
            <stop offset="70%" stopColor="var(--up)" stopOpacity={0.05} />
            <stop offset="100%" stopColor="var(--up)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.055)" />
        <XAxis
          dataKey="i"
          type="number"
          domain={[0, Math.max(1, data.length - 1)]}
          allowDecimals={false}
          tick={{ fontSize: 9, fill: "var(--muted-2)", fontFamily: "var(--font-mono)" }}
          tickFormatter={(i: number) => data[Math.round(i)]?.date?.slice(5) ?? ""}
          minTickGap={44}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "var(--muted-2)", fontFamily: "var(--font-mono)" }}
          width={46}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(6,8,13,0.94)",
            border: "1px solid var(--border-hi)",
            borderRadius: 4,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
          labelFormatter={(i: any) => {
            const p = data[Math.round(Number(i))];
            return p ? `${p.date} · ${p.ticker}` : "";
          }}
          formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "מצטבר"]}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="var(--up)"
          strokeWidth={1.75}
          fill="url(#dashEq)"
          isAnimationActive
          animationDuration={1200}
          dot={false}
          activeDot={{ r: 3, fill: "var(--up)", stroke: "var(--bg)" }}
        />
        {marks.map((m, k) => (
          <ReferenceDot
            key={m.kind}
            x={m.i}
            y={m.y}
            r={0}
            ifOverflow="extendDomain"
            shape={(p: any) => (
              <DetectionBox
                cx={p.cx}
                cy={p.cy}
                mark={m}
                delay={900 + k * 220}
                height={height}
              />
            )}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
