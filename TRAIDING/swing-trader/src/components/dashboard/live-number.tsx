"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-live-data";

/**
 * Wraps a number that arrives from a polling endpoint.
 * When the value changes it replays a short chromatic glitch in the
 * direction of the move. Silent on first paint and under reduced-motion.
 */
export default function LiveNumber({
  value,
  children,
  className,
}: {
  value: number | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const prev = useRef<number | null | undefined>(undefined);
  const [pulse, setPulse] = useState<{ dir: "up" | "down"; n: number } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === undefined || before === null || value == null) return;
    if (before === value || reduced) return;
    seq.current += 1;
    setPulse({ dir: value > before ? "up" : "down", n: seq.current });
    const t = window.setTimeout(() => setPulse(null), 950);
    return () => window.clearTimeout(t);
  }, [value, reduced]);

  return (
    <span
      key={pulse?.n ?? 0}
      className={cn(
        "live-cell",
        pulse?.dir === "up" && "live-glitch-up",
        pulse?.dir === "down" && "live-glitch-down",
        className
      )}
    >
      {children}
    </span>
  );
}
