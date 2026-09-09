"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
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

const WALL_H = 1400; // px of the climbable surface

function stopPct(p: WallPosition): number | null {
  if (p.stopPrice == null || p.buyPrice === 0) return null;
  return ((p.stopPrice - p.buyPrice) / p.buyPrice) * 100;
}

function rMultiple(p: WallPosition): number | null {
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

/* decorative climbing holds — deterministic scatter, computed once.
   Faded bouldering colours: burnt orange, slate blue, moss, granite, rust. */
const HOLD_HUES = ["#c8792e", "#3f7cc0", "#4c9e6b", "#8a8f99", "#b0472f", "#7d6bb0"];
const HOLD_SHAPES = ["", "wall-hold--b", "wall-hold--c"];
const HOLDS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: 5 + r(1) * 90,
    top: r(2) * 100,
    size: 6 + r(3) * 13,
    rot: r(4) * 180,
    hue: HOLD_HUES[Math.floor(r(5) * HOLD_HUES.length)],
    shape: HOLD_SHAPES[Math.floor(r(6) * HOLD_SHAPES.length)],
    op: 0.32 + r(7) * 0.24,
  };
});

/* ── climber figure — silhouette in a climbing pose ──────────── */
function ClimberFigure({ up }: { up: boolean }) {
  return (
    <svg
      className={cn("wall-figure", up ? "wall-figure--up" : "wall-figure--down")}
      width="24"
      height="32"
      viewBox="0 0 26 34"
      aria-hidden
    >
      <g
        className="wf-stroke"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ stroke: "currentColor" }}
      >
        {/* reaching arm up, bent arm gripping, high knee + low foot */}
        <path d="M13 13 L20.5 4.5" />
        <path d="M11.5 15 L6 13 L5.5 18.5" />
        <path d="M12 20 L7.5 22.5 L9 30.5" />
        <path d="M13.5 20 L17 26 L15 32.5" />
      </g>
      {/* chalk puff at the reaching hand */}
      <circle className="wf-chalk" cx="21" cy="4" r="1.5" opacity="0.55" />
      <circle className="wf-body" cx="12.5" cy="8" r="3.7" />
      <path className="wf-body" d="M9 12 L16 12 L14.4 20.5 L10.6 20.5 Z" />
    </svg>
  );
}

export default function ClimbWall({
  positions,
  focusId,
  loading,
}: {
  positions: WallPosition[];
  focusId?: string | null;
  loading: boolean;
}) {
  // ── falling detection ────────────────────────────────────────────
  const snapshotRef = useRef<Map<string, WallPosition>>(new Map());
  const prevIdsRef = useRef<string[]>([]);
  const [falling, setFalling] = useState<WallPosition[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const p of positions) snapshotRef.current.set(p.id, p);
    const currentIds = new Set(positions.map((p) => p.id));
    const gone = prevIdsRef.current.filter((id) => !currentIds.has(id));

    if (gone.length) {
      const snaps = gone
        .map((id) => snapshotRef.current.get(id))
        .filter((p): p is WallPosition => !!p);
      if (snaps.length) {
        setFalling((prev) => [...prev, ...snaps.filter((s) => !prev.some((x) => x.id === s.id))]);
        for (const s of snaps) {
          const t = setTimeout(() => {
            setFalling((prev) => prev.filter((x) => x.id !== s.id));
            timersRef.current.delete(s.id);
          }, 1500);
          timersRef.current.set(s.id, t);
        }
      }
    }
    // a reappearing id cancels its fall
    if (falling.length) {
      const revived = falling.filter((f) => currentIds.has(f.id));
      if (revived.length) {
        for (const r of revived) {
          const t = timersRef.current.get(r.id);
          if (t) clearTimeout(t);
          timersRef.current.delete(r.id);
        }
        setFalling((prev) => prev.filter((f) => !currentIds.has(f.id)));
      }
    }

    prevIdsRef.current = positions.map((p) => p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.map((p) => `${p.id}:${p.currentPrice}`).join(",")]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // ── price-change flash ──────────────────────────────────────────
  const prevPctRef = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Map<string, "up" | "down">>(new Map());
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const next = new Map(flash);
    let changed = false;
    for (const p of positions) {
      const cur = p.unrealizedPnlPct ?? 0;
      const prev = prevPctRef.current.get(p.id);
      if (prev != null && Math.abs(cur - prev) > 1e-6) {
        next.set(p.id, cur >= prev ? "up" : "down");
        changed = true;
        const old = flashTimersRef.current.get(p.id);
        if (old) clearTimeout(old);
        const t = setTimeout(() => {
          setFlash((m) => {
            const c = new Map(m);
            c.delete(p.id);
            return c;
          });
          flashTimersRef.current.delete(p.id);
        }, 800);
        flashTimersRef.current.set(p.id, t);
      }
      prevPctRef.current.set(p.id, cur);
    }
    if (changed) setFlash(next);
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timers = flashTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // ── milestone: climber crosses a whole %/R line upward ──────────
  const prevFloorRef = useRef<Map<string, number>>(new Map());
  const [planted, setPlanted] = useState<Map<string, number>>(new Map());
  const plantTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const p of positions) {
      const cur = p.unrealizedPnlPct ?? 0;
      const floor = Math.floor(cur);
      const prev = prevFloorRef.current.get(p.id);
      if (prev != null && floor > prev && floor >= 1) {
        setPlanted((m) => {
          const c = new Map(m);
          c.set(p.id, floor);
          return c;
        });
        const old = plantTimersRef.current.get(p.id);
        if (old) clearTimeout(old);
        const t = setTimeout(() => {
          setPlanted((m) => {
            const c = new Map(m);
            c.delete(p.id);
            return c;
          });
          plantTimersRef.current.delete(p.id);
        }, 1500);
        plantTimersRef.current.set(p.id, t);
      }
      prevFloorRef.current.set(p.id, floor);
    }
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timers = plantTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  // ── local focus (click) overrides the URL param ──────────────────
  const [clickFocus, setClickFocus] = useState<string | null>(null);
  const activeFocus = clickFocus ?? focusId ?? null;

  const climbers = useMemo(() => {
    const live = positions.map((p) => ({ pos: p, falling: false }));
    const dead = falling
      .filter((f) => !positions.some((p) => p.id === f.id))
      .map((p) => ({ pos: p, falling: true }));
    return [...live, ...dead];
  }, [positions, falling]);

  // ── vertical range ──────────────────────────────────────────────
  const { min, max } = useMemo(() => {
    const stops = climbers
      .map((c) => stopPct(c.pos))
      .filter((v): v is number => v != null);
    const curs = climbers
      .map((c) => c.pos.unrealizedPnlPct)
      .filter((v): v is number => v != null);
    const lo = Math.min(-5, ...stops);
    const hi = Math.max(5, ...curs.map((v) => v + 2));
    return { min: lo, max: hi };
  }, [climbers]);

  const yFor = (pct: number) => (WALL_H * (max - pct)) / (max - min);

  const gridLines = useMemo(() => {
    const lines: { pct: number; strong: boolean }[] = [];
    const start = Math.ceil(min / 0.5) * 0.5;
    for (let v = start; v <= max + 1e-9; v += 0.5) {
      const rounded = Math.round(v * 10) / 10;
      lines.push({ pct: rounded, strong: Math.abs(rounded % 1) < 1e-9 });
    }
    return lines;
  }, [min, max]);

  const focused = activeFocus
    ? climbers.find((c) => c.pos.id === activeFocus)?.pos ?? null
    : null;

  // ── empty / locked ──────────────────────────────────────────────
  if (!loading && positions.length === 0 && falling.length === 0) {
    return (
      <div className="wall-locked flex flex-col items-center justify-center text-center py-24 px-6 min-h-[60vh]">
        <div className="wall-rock" />
        <div className="wall-bars" />
        <div className="wall-chain wall-chain--a" />
        <div className="wall-chain wall-chain--b" />
        <div className="relative z-10 flex flex-col items-center">
          <svg className="wall-padlock mb-6" width="66" height="72" viewBox="0 0 66 72" aria-hidden>
            <defs>
              <linearGradient id="lockgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#20242b" />
                <stop offset="0.5" stopColor="#15181d" />
                <stop offset="1" stopColor="#0c0e11" />
              </linearGradient>
            </defs>
            <path className="shackle" d="M18 32 V22 C18 13.7 24.7 7 33 7 C41.3 7 48 13.7 48 22 V32" />
            <rect className="body" x="10" y="31" width="46" height="36" rx="7" />
            <circle className="keyhole" cx="33" cy="46" r="4.2" />
            <rect className="keyhole" x="31.4" y="46" width="3.2" height="11" rx="1.4" />
          </svg>
          <div className="eyebrow mb-4">Wall Sealed</div>
          <h3 className="text-3xl font-black tracking-tight mb-3">הקיר נעול</h3>
          <p className="text-sm text-[var(--fg-dim)] max-w-xs leading-relaxed mb-7">
            אין לך פוזיציות פתוחות. הקיר נפתח ברגע שאתה בטרייד — כל פוזיציה
            הופכת למטפס, והסטופ שלה לעוגן.
          </p>
          <Link
            href="/scanner"
            className="btn-metal rounded-full px-6 py-2.5 text-sm font-bold inline-flex items-center gap-2"
          >
            <Radar className="w-4 h-4" />
            פתח את הסורק
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="shimmer rounded-2xl h-[70vh] w-full" />;
  }

  const rLines = focused
    ? [1, 2, 3]
        .map((n) => {
          const s = stopPct(focused);
          if (s == null || focused.stopPrice == null) return null;
          const perR = ((focused.buyPrice - focused.stopPrice) / focused.buyPrice) * 100;
          return { n, pct: perR * n };
        })
        .filter((v): v is { n: number; pct: number } => v != null && v.pct <= max)
    : [];

  const entryY = yFor(0);
  const focusedY = focused ? yFor(focused.unrealizedPnlPct ?? 0) : null;
  const earnDays = focused ? daysUntil(focused.earningsDate) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-stretch">
      {/* ── the wall ─────────────────────────────────────────────── */}
      <div className="wall-stage flex-1 w-full flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-[var(--metal-edge)] bg-black/25">
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
            Shared Climb · {positions.length} מטפסים · טווח {min.toFixed(1)}% ↔ +{max.toFixed(1)}%
          </div>
          <Link
            href="/"
            className="btn-metal rounded-full px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            חזרה ללוח
          </Link>
        </div>

        <div
          className="relative overflow-y-auto overflow-x-auto no-scrollbar flex-1"
          style={{ maxHeight: "76vh" }}
        >
          <div className="wall-inner" style={{ height: WALL_H, minWidth: 340 }}>
            <div className="wall-rock" />
            <div className="wall-strata" />
            <div className="wall-rail" />
            <div className="wall-lightpool" />

            {/* decorative holds */}
            {HOLDS.map((h, i) => (
              <span
                key={i}
                className={cn("wall-hold", h.shape)}
                style={
                  {
                    left: `${h.left}%`,
                    top: `${h.top}%`,
                    width: h.size,
                    height: h.size * 0.82,
                    opacity: h.op,
                    transform: `rotate(${h.rot}deg)`,
                    "--hold": h.hue,
                  } as React.CSSProperties
                }
              />
            ))}

            {/* focused climber's current-price line */}
            {focused && focusedY != null && (
              <span className="wall-priceline" style={{ top: focusedY }} />
            )}

            {/* grid bands */}
            {gridLines.map((g) => {
              const isEntry = Math.abs(g.pct) < 1e-9;
              return (
                <div
                  key={g.pct}
                  className={cn(
                    "wall-band",
                    isEntry
                      ? "wall-band--entry"
                      : g.strong
                      ? "wall-band--full"
                      : "wall-band--half"
                  )}
                  style={{ top: yFor(g.pct) }}
                >
                  <span className="wall-band__tag">
                    {g.pct > 0 ? "+" : ""}
                    {g.pct.toFixed(g.strong ? 0 : 1)}%
                  </span>
                  <span className="wall-band__line" />
                </div>
              );
            })}

            {/* R marker lines for the focused climber */}
            {rLines.map((r) => (
              <div key={`r${r.n}`} className="wall-band wall-band--r" style={{ top: yFor(r.pct) }}>
                <span className="wall-band__tag">R{r.n}</span>
                <span className="wall-band__line" />
              </div>
            ))}

            {/* the focused climber's trail from entry to now */}
            {focused && focusedY != null && focusedY < entryY && (
              <span
                className="wall-trail"
                style={{ top: focusedY + 6, height: Math.max(0, entryY - focusedY) }}
              />
            )}

            {/* climbers */}
            {climbers.map(({ pos, falling: isFalling }) => {
              const pct = pos.unrealizedPnlPct ?? 0;
              const sp = stopPct(pos);
              const up = pct >= 0;
              const r = rMultiple(pos);
              const dim = activeFocus != null && activeFocus !== pos.id && !isFalling;
              const isFocus = activeFocus === pos.id;
              const climberY = yFor(pct);
              const anchorY = sp != null ? yFor(sp) : null;
              const span = anchorY != null ? Math.max(0, anchorY - climberY) : 0;
              const fl = flash.get(pos.id);
              return (
                <div
                  key={pos.id}
                  data-falling={isFalling ? "true" : undefined}
                  className={cn(
                    "wall-climber",
                    dim && "wall-climber--dim",
                    isFocus && "wall-climber--focus"
                  )}
                  style={
                    {
                      transform: `translateY(${climberY}px)`,
                      zIndex: isFocus ? 6 : 3,
                      "--fall-from": `${climberY}px`,
                    } as React.CSSProperties
                  }
                >
                  {/* protected span + rope + anchor */}
                  {anchorY != null && (
                    <>
                      <span
                        className={cn("wall-span", up ? "wall-span--up" : "wall-span--down")}
                        style={{ top: 14, height: span }}
                      />
                      <svg
                        className="wall-rope-svg"
                        style={{ top: 14, height: Math.max(span, 1) }}
                        viewBox="0 0 18 100"
                        preserveAspectRatio="none"
                        aria-hidden
                      >
                        <path className="rope-line" d="M11 0 C 2 34, 1 66, 4 100" vectorEffect="non-scaling-stroke" />
                        <path className="rope-hi" d="M11 0 C 2 34, 1 66, 4 100" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <svg
                        className="wall-anchor"
                        style={{ top: span + 14 }}
                        viewBox="0 0 20 16"
                        aria-hidden
                      >
                        <rect className="piton" x="12" y="6" width="8" height="4" rx="1" />
                        <path
                          className="carabiner"
                          d="M13 8 C13 3.5 9.5 2 6 2 C2.5 2 1 5 1 8 C1 11 2.5 14 6 14 C9.5 14 13 12.5 13 8 Z"
                        />
                        <path className="carabiner" d="M6 2 L11 4.5" />
                      </svg>
                    </>
                  )}

                  <span
                    className={cn("wall-halo", up ? "wall-halo--up" : "wall-halo--down")}
                  />

                  {planted.has(pos.id) && (
                    <span className="wall-plant" key={`plant-${planted.get(pos.id)}`} aria-hidden>
                      <span className="wall-plant__spark" />
                      <svg viewBox="0 0 13 15" width="13" height="15">
                        <rect x="0" y="0" width="1.6" height="15" fill="currentColor" />
                        <path d="M1.6 0.6 L12 3.4 L1.6 6.2 Z" fill="currentColor" />
                      </svg>
                    </span>
                  )}

                  <div className="relative flex items-center gap-1.5">
                    <ClimberFigure up={up} />
                    <button
                      type="button"
                      onClick={() =>
                        setClickFocus((cur) => (cur === pos.id ? null : pos.id))
                      }
                      className="wall-flag"
                    >
                      <span className="ticker text-sm">{pos.ticker}</span>
                      <span
                        className={cn(
                          "mono text-[11px] tabular",
                          up ? "text-[var(--up)]" : "text-[var(--down)]"
                        )}
                      >
                        {formatPercent(pct, 1)}
                      </span>
                      {r != null && (
                        <span className="mono text-[10px] text-[var(--muted-2)] tabular">
                          {r.toFixed(1)}R
                        </span>
                      )}
                      {sp == null && (
                        <span className="mono text-[9px] text-[var(--warn-2)]">אין סטופ</span>
                      )}
                      {fl && (
                        <span
                          className={cn(
                            "wall-flash wall-flash--on",
                            fl === "up" ? "wall-flash--up" : "wall-flash--down"
                          )}
                        />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── focus panel ──────────────────────────────────────────── */}
      {focused && (
        <div className="metal-panel rounded-2xl p-6 w-full lg:w-[300px] shrink-0 space-y-4 self-start">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow mb-1.5">In Focus</div>
              <span className="ticker text-xl">{focused.ticker}</span>
            </div>
            <button
              type="button"
              onClick={() => setClickFocus(null)}
              className="btn-metal rounded-full px-3 py-1 text-[11px] font-bold"
            >
              סגור
            </button>
          </div>

          <div
            className={cn(
              "rounded-xl border p-3 text-center",
              (focused.unrealizedPnlPct ?? 0) >= 0
                ? "border-[var(--up)]/25 bg-[var(--up-wash)]"
                : "border-[var(--down)]/25 bg-[rgba(239,68,68,0.06)]"
            )}
          >
            <div
              className={cn(
                "mono text-2xl font-black tabular",
                (focused.unrealizedPnlPct ?? 0) >= 0
                  ? "text-[var(--up)]"
                  : "text-[var(--down)]"
              )}
            >
              {formatPercent(focused.unrealizedPnlPct, 2)}
            </div>
            <div className="mono text-[10px] text-[var(--muted)] mt-0.5">
              {focused.unrealizedPnl != null ? formatCurrency(focused.unrealizedPnl) : "—"}
            </div>
          </div>

          <dl className="space-y-2.5 text-sm">
            <Row k="מחיר כניסה" v={formatCurrency(focused.buyPrice)} />
            <Row
              k="מחיר נוכחי"
              v={focused.currentPrice != null ? formatCurrency(focused.currentPrice) : "—"}
            />
            <Row
              k="סטופ / עוגן"
              v={focused.stopPrice != null ? formatCurrency(focused.stopPrice) : "אין סטופ"}
              tone={focused.stopPrice != null ? undefined : "down"}
            />
            <Row
              k="מרווח מוגן"
              v={
                focused.risk != null
                  ? `${formatCurrency(-focused.risk)} · ${formatPercent(
                      focused.distanceToStopPct,
                      1
                    )}`
                  : "—"
              }
            />
            <Row
              k="R נוכחי"
              v={rMultiple(focused) != null ? `${rMultiple(focused)!.toFixed(2)}R` : "—"}
              tone={
                rMultiple(focused) != null
                  ? rMultiple(focused)! >= 0
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
        </div>
      )}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10px] uppercase tracking-[0.15em] font-bold text-[var(--muted)]">{k}</dt>
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
