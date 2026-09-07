"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

type Props = {
  accountSize: number | null;
  cashBalance: number | null;
  openPnl: number | null;
  monthReturnPct: number | null;
  openRisk: number | null;
};

function money(n: number | null) {
  return n == null ? "—" : formatCurrency(n, 0);
}

export default function HoloCard({
  accountSize,
  cashBalance,
  openPnl,
  monthReturnPct,
  openRisk,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)"
    );
    const update = () => setInteractive(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive) return;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const ry = (px - 0.5) * 16; // deg
        const rx = -(py - 0.5) * 14;
        el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      });
    },
    [interactive]
  );

  const onLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return (
    <div className="holo-scene mx-auto sm:mx-0">
      <div
        ref={cardRef}
        className={cn("holo-card", flipped && "is-flipped")}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        aria-label="הפוך כרטיס חשבון"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
      >
        {/* FRONT */}
        <div className="holo-face">
          <div className="holo-content">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-black tracking-tight">SWING TERMINAL</div>
                <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--up)] mt-1">
                  Trading Account
                </div>
              </div>
              <div className="holo-chip" aria-hidden />
            </div>

            <div>
              <div className="mono text-[13px] tracking-[0.22em] text-[var(--fg-2)]">
                •••• •••• •••• 2026
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
                    גודל חשבון
                  </div>
                  <div className="mono text-3xl font-black leading-none mt-1">
                    {money(accountSize)}
                  </div>
                </div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] text-left">
                  לחץ להיפוך
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="holo-face holo-face--back">
          <div className="holo-content">
            <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--up)]">
              Account Snapshot
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Metric label="Buying Power" value={money(cashBalance)} />
              <Metric
                label="P&L פתוח"
                value={openPnl == null ? "—" : formatCurrency(openPnl, 0)}
                tone={openPnl == null ? undefined : openPnl >= 0 ? "up" : "down"}
              />
              <Metric
                label="תשואת החודש"
                value={monthReturnPct == null ? "—" : formatPercent(monthReturnPct, 1)}
                tone={
                  monthReturnPct == null
                    ? undefined
                    : monthReturnPct >= 0
                    ? "up"
                    : "down"
                }
              />
              <Metric
                label="סיכון פתוח"
                value={openRisk == null ? "—" : formatCurrency(-Math.abs(openRisk), 0)}
                tone="down"
              />
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] text-left">
              לחץ לחזרה
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mono text-lg font-bold mt-0.5",
          tone === "up" && "text-[var(--up)]",
          tone === "down" && "text-[var(--down)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}
