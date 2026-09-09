"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { useLiveData } from "@/components/dashboard/use-live-data";
import { MAX_CLIMBERS, type Range } from "@/components/wall/wall-math";
import type { ClimberData } from "@/components/wall/climber";
import WallLocked from "@/components/wall/wall-locked";
import "./wall.css";

export type WallPosition = {
  id: string;
  ticker: string;
  buyPrice: number;
  currentPrice: number | null;
  stopPrice: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  risk: number | null;
  distanceToStopPct: number | null;
  earningsDate: string | null;
  buyDate: string;
};

export type PositionsData = {
  positions: WallPosition[];
  totalOpenPnl: number;
  totalOpenRisk: number;
  count: number;
};

const WallScene = dynamic(() => import("@/components/wall/wall-scene"), {
  ssr: false,
  loading: () => <div className="shimmer rounded-2xl h-[76vh] w-full" />,
});

function stopPctOf(p: WallPosition): number | null {
  if (p.stopPrice == null || p.buyPrice === 0) return null;
  return ((p.stopPrice - p.buyPrice) / p.buyPrice) * 100;
}

function rMultipleOf(p: WallPosition): number | null {
  if (p.stopPrice == null || p.currentPrice == null) return null;
  const denom = p.buyPrice - p.stopPrice;
  if (denom === 0) return null;
  return (p.currentPrice - p.buyPrice) / denom;
}

function daysIn(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

export default function WallInner() {
  const params = useSearchParams();
  const focusParam = params.get("focus");
  const { data, loading } = useLiveData<PositionsData>("/api/positions", {
    intervalMs: 20_000,
  });
  const positions = useMemo(() => data?.positions ?? [], [data]);

  // ── tab visibility → pause the render loop ──────────────────────
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ── falling detection (id vanished → keep it around, falling, 1.8s) ─
  const snapshotRef = useRef<Map<string, WallPosition>>(new Map());
  const prevIdsRef = useRef<string[]>([]);
  const [falling, setFalling] = useState<WallPosition[]>([]);
  const fallTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const p of positions) snapshotRef.current.set(p.id, p);
    const currentIds = new Set(positions.map((p) => p.id));
    const gone = prevIdsRef.current.filter((id) => !currentIds.has(id));

    if (gone.length) {
      const snaps = gone
        .map((id) => snapshotRef.current.get(id))
        .filter((p): p is WallPosition => !!p);
      if (snaps.length) {
        setFalling((prev) => [
          ...prev,
          ...snaps.filter((s) => !prev.some((x) => x.id === s.id)),
        ]);
        for (const s of snaps) {
          const t = setTimeout(() => {
            setFalling((prev) => prev.filter((x) => x.id !== s.id));
            fallTimersRef.current.delete(s.id);
          }, 1800);
          fallTimersRef.current.set(s.id, t);
        }
      }
    }

    // a reappearing id cancels its fall
    setFalling((prev) => {
      const revived = prev.filter((f) => currentIds.has(f.id));
      for (const r of revived) {
        const t = fallTimersRef.current.get(r.id);
        if (t) clearTimeout(t);
        fallTimersRef.current.delete(r.id);
      }
      return revived.length ? prev.filter((f) => !currentIds.has(f.id)) : prev;
    });

    prevIdsRef.current = positions.map((p) => p.id);
  }, [positions]);

  useEffect(() => {
    const timers = fallTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // ── milestone crossing (whole % / R line) → transient "crossed" flag ─
  const prevPctRef = useRef<Map<string, number>>(new Map());
  const prevRRef = useRef<Map<string, number>>(new Map());
  const [crossed, setCrossed] = useState<Map<string, { pct?: number; r?: number }>>(
    new Map()
  );
  const crossTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const hits = new Map<string, { pct?: number; r?: number }>();
    for (const p of positions) {
      const pct = p.unrealizedPnlPct ?? 0;
      const prevPct = prevPctRef.current.get(p.id);
      if (prevPct != null && Math.floor(pct) !== Math.floor(prevPct)) {
        hits.set(p.id, { pct: Math.floor(pct) });
      }
      prevPctRef.current.set(p.id, pct);

      const r = rMultipleOf(p);
      if (r != null) {
        const prevR = prevRRef.current.get(p.id);
        if (prevR != null && Math.floor(r) !== Math.floor(prevR) && Math.floor(r) >= 1) {
          hits.set(p.id, { ...(hits.get(p.id) ?? {}), r: Math.floor(r) });
        }
        prevRRef.current.set(p.id, r);
      }
    }

    if (hits.size) {
      setCrossed((prev) => {
        const next = new Map(prev);
        for (const [id, v] of hits) next.set(id, v);
        return next;
      });
      for (const id of hits.keys()) {
        const old = crossTimersRef.current.get(id);
        if (old) clearTimeout(old);
        const t = setTimeout(() => {
          setCrossed((m) => {
            const c = new Map(m);
            c.delete(id);
            return c;
          });
          crossTimersRef.current.delete(id);
        }, 800);
        crossTimersRef.current.set(id, t);
      }
    }
  }, [positions]);

  useEffect(() => {
    const timers = crossTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // ── focus (click overrides the URL param) ───────────────────────
  const [clickFocus, setClickFocus] = useState<string | null>(null);
  const activeFocus = clickFocus ?? focusParam ?? null;

  // ── assemble climbers ──────────────────────────────────────────
  const climbers = useMemo<ClimberData[]>(() => {
    const build = (p: WallPosition, isFalling: boolean): ClimberData => ({
      id: p.id,
      ticker: p.ticker,
      pct: p.unrealizedPnlPct ?? 0,
      stopPct: stopPctOf(p),
      rMultiple: rMultipleOf(p),
      currentPrice: p.currentPrice,
      buyPrice: p.buyPrice,
      stopPrice: p.stopPrice,
      unrealizedPnl: p.unrealizedPnl,
      earningsDate: p.earningsDate,
      buyDate: p.buyDate,
      falling: isFalling,
      crossed: crossed.get(p.id) ?? null,
    });
    const live = positions.map((p) => build(p, false));
    const dead = falling
      .filter((f) => !positions.some((p) => p.id === f.id))
      .map((p) => build(p, true));
    return [...live, ...dead];
  }, [positions, falling, crossed]);

  // ── dynamic vertical range ─────────────────────────────────────
  const range = useMemo<Range>(() => {
    const stops = climbers
      .map((c) => c.stopPct)
      .filter((v): v is number => v != null);
    const curs = climbers.map((c) => c.pct);
    return {
      min: Math.min(-5, ...stops),
      max: Math.max(5, ...curs.map((v) => v + 2)),
    };
  }, [climbers]);

  const focused = activeFocus
    ? climbers.find((c) => c.id === activeFocus) ?? null
    : null;

  // ── locked / loading ───────────────────────────────────────────
  if (loading && positions.length === 0) {
    return <div className="shimmer rounded-2xl h-[76vh] w-full" />;
  }
  if (positions.length === 0 && falling.length === 0) {
    return <WallLocked />;
  }

  const overCap = climbers.length - MAX_CLIMBERS;
  const earnDays = focused ? daysUntil(focused.earningsDate) : null;

  return (
    <div className="wall-stage-3d">
      <div className="wall-stage-3d__bar">
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
          Shared Climb · {positions.length} מטפסים · טווח {range.min.toFixed(1)}% ↔ +
          {range.max.toFixed(1)}%
          {overCap > 0 ? ` · +${overCap} מוסתרים` : ""}
        </div>
        <Link
          href="/"
          className="btn-metal rounded-full px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          חזרה ללוח
        </Link>
      </div>

      <div className="wall-canvas">
        <WallScene
          climbers={climbers}
          focusId={activeFocus}
          range={range}
          hidden={hidden}
          onSelect={(id) => setClickFocus((cur) => (cur === id ? null : id))}
        />

        {focused && (
          <div className="wall-focus metal-panel">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow mb-1.5">In Focus</div>
                <span className="ticker text-xl">{focused.ticker}</span>
              </div>
              <button
                type="button"
                onClick={() => setClickFocus(null)}
                className="btn-metal rounded-full w-7 h-7 grid place-items-center"
                aria-label="נקה פוקוס"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              className={cn(
                "rounded-xl border p-3 text-center",
                focused.pct >= 0
                  ? "border-[var(--up)]/25 bg-[var(--up-wash)]"
                  : "border-[var(--down)]/25 bg-[rgba(239,68,68,0.06)]"
              )}
            >
              <div
                className={cn(
                  "mono text-2xl font-black tabular",
                  focused.pct >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                )}
              >
                {formatPercent(focused.pct, 2)}
              </div>
              <div className="mono text-[10px] text-[var(--muted)] mt-0.5">
                {focused.unrealizedPnl != null
                  ? formatCurrency(focused.unrealizedPnl)
                  : "—"}
              </div>
            </div>

            <dl className="space-y-2.5 text-sm">
              <Row k="מחיר כניסה" v={formatCurrency(focused.buyPrice)} />
              <Row
                k="מחיר נוכחי"
                v={
                  focused.currentPrice != null
                    ? formatCurrency(focused.currentPrice)
                    : "—"
                }
              />
              <Row
                k="סטופ / עוגן"
                v={focused.stopPrice != null ? formatCurrency(focused.stopPrice) : "אין עוגן"}
                tone={focused.stopPrice != null ? undefined : "down"}
              />
              <Row
                k="מרווח מוגן"
                v={
                  focused.stopPct != null && focused.stopPrice != null
                    ? `${formatCurrency(focused.stopPrice - focused.buyPrice)} · ${formatPercent(
                        focused.stopPct,
                        1
                      )}`
                    : "—"
                }
              />
              <Row
                k="R נוכחי"
                v={focused.rMultiple != null ? `${focused.rMultiple.toFixed(2)}R` : "—"}
                tone={
                  focused.rMultiple != null
                    ? focused.rMultiple >= 0
                      ? "up"
                      : "down"
                    : undefined
                }
              />
              <Row k="ימים בפוזיציה" v={`${daysIn(focused.buyDate)}d`} />
            </dl>

            {earnDays != null && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-[11px] font-bold",
                  earnDays <= 7
                    ? "border-[var(--warn-2)]/35 bg-[var(--warn-bg)] text-[var(--warn-2)]"
                    : "border-[var(--border)] text-[var(--fg-dim)]"
                )}
              >
                <span className="uppercase tracking-[0.14em]">דוחות</span>
                <span className="mono">
                  {earnDays <= 0 ? "היום/עבר" : `בעוד ${earnDays}d`}
                </span>
              </div>
            )}

            <Link
              href="/"
              className="btn-metal rounded-full px-4 py-2 text-xs font-bold w-full inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              חזרה ללוח
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">
        {k}
      </dt>
      <dd
        className={cn(
          "mono tabular text-sm font-bold",
          tone === "up" && "text-[var(--up)]",
          tone === "down" && "text-[var(--down)]"
        )}
      >
        {v}
      </dd>
    </div>
  );
}
