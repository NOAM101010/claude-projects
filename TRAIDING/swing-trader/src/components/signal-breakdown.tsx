"use client";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type SignalTone = "bullish" | "bearish" | "neutral";

export type BreakdownSignal = {
  key?: string;
  label: string;
  value: string;
  tone: SignalTone;
  weight: number;
  explanation: string;
};

export function ToneIcon({ tone }: { tone: SignalTone }) {
  if (tone === "bullish") return <TrendingUp className="w-4 h-4 text-[var(--up)]" />;
  if (tone === "bearish") return <TrendingDown className="w-4 h-4 text-[var(--down)]" />;
  return <Minus className="w-4 h-4 text-[var(--muted)]" />;
}

/** פירוט האותות של מנוע הניקוד — משותף לדף הניתוח ולשורות הסורק. */
export default function SignalBreakdown({
  signals,
  compact = false,
  className,
}: {
  signals: BreakdownSignal[];
  compact?: boolean;
  className?: string;
}) {
  if (!signals?.length) {
    return (
      <div className="text-xs text-[var(--muted)] py-2">אין פירוט אותות לשורה הזו.</div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2", className)}>
      {signals.map((sig, i) => (
        <div
          key={sig.key ?? i}
          className={cn(
            "rounded-xl border",
            compact ? "p-3" : "p-4",
            sig.tone === "bullish" && "border-[var(--up)]/25 bg-[var(--up-bg)]",
            sig.tone === "bearish" && "border-[var(--down)]/25 bg-[var(--down-bg)]",
            sig.tone === "neutral" && "border-[var(--border-hi)] bg-white/[0.02]"
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <ToneIcon tone={sig.tone} />
              <span className={cn("font-bold", compact ? "text-xs" : "text-sm")}>{sig.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("mono font-bold", compact ? "text-xs" : "text-sm")}>{sig.value}</span>
              {sig.weight !== 0 && (
                <Badge
                  className={cn(
                    "mono",
                    sig.weight > 0
                      ? "border-[var(--up)]/30 text-[var(--up)]"
                      : "border-[var(--down)]/30 text-[var(--down)]"
                  )}
                >
                  {sig.weight > 0 ? "+" : ""}
                  {sig.weight}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-[var(--fg-dim)] leading-relaxed">{sig.explanation}</p>
        </div>
      ))}
    </div>
  );
}
