"use client";

import { X } from "lucide-react";
import { useAlertCheck } from "@/components/use-alert-check";
import { cn } from "@/lib/utils";

/**
 * רכיב דק שרק מריץ את בדיקת ההתראות ומציג toast fixed בפינה.
 * משובץ ב-command-center וב-watchlist.
 */
export default function AlertChecker() {
  const { toasts, dismiss } = useAlertCheck();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-[120] flex flex-col items-center gap-2 pointer-events-none sm:inset-x-auto sm:end-4 sm:items-end">
      {toasts.map((t) => {
        const closed = t.kind === "closed";
        const stopAlert = t.kind === "stopAlert";
        return (
          <div
            key={t.id}
            className={cn(
              "glass rounded-2xl px-4 py-3 pointer-events-auto flex items-center gap-3 max-w-sm border",
              closed
                ? "border-[rgba(248,113,113,0.55)] shadow-[0_0_28px_-8px_rgba(248,113,113,0.6)]"
                : "border-[rgba(245,158,11,0.45)] shadow-[0_0_28px_-8px_rgba(245,158,11,0.5)]"
            )}
          >
            <span className="text-lg">{closed || stopAlert ? "🛑" : "🔔"}</span>
            <div className="text-sm">
              {closed ? (
                <>
                  <span className="text-[var(--fg-dim)]">הפוזיציה ב-</span>
                  <span className="ticker">{t.symbol}</span>
                  <span className="text-[var(--fg-dim)]"> נסגרה בסטופ</span>
                  <span className="mono font-bold"> ${t.targetPrice}</span>
                  {t.pnl != null && (
                    <span
                      className={cn(
                        "mono font-bold",
                        t.pnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
                      )}
                    >
                      {" · P&L "}
                      {t.pnl >= 0 ? "+" : "-"}${Math.abs(t.pnl).toFixed(2)}
                    </span>
                  )}
                </>
              ) : stopAlert ? (
                <>
                  <span className="ticker">{t.symbol}</span>
                  <span className="text-[var(--fg-dim)]"> נגעה בסטופ</span>
                  <span className="mono font-bold"> ${t.targetPrice}</span>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    לא נסגרה אוטומטית — ההגדרה כבויה · נוכחי ${t.currentPrice.toFixed(2)}
                  </div>
                </>
              ) : (
                <>
                  <span className="ticker">{t.symbol}</span>{" "}
                  {t.direction === "above" ? "חצתה מעל" : "ירדה מתחת ל-"}
                  <span className="mono font-bold"> ${t.targetPrice}</span>
                  <span className="text-[var(--fg-dim)]">
                    {" "}
                    · נוכחי ${t.currentPrice.toFixed(2)}
                  </span>
                  {t.note && (
                    <div className="text-xs text-[var(--muted)] mt-0.5">{t.note}</div>
                  )}
                </>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors p-1 shrink-0"
              aria-label="סגור"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
