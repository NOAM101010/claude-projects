"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AlertToast = {
  id: string;
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  direction: string;
  note: string | null;
};

const POLL_MS = 60_000;
const POLL_IDLE_MS = 300_000;
const TOAST_MS = 8_000;

/**
 * בודק את /api/alerts/check כל 60ש' (רק כשהטאב גלוי). כשאין התראות פעילות
 * שנשארו (activeCount===0) מרווח הפולינג עולה ל-5 דקות, ויורד חזרה ל-60ש'
 * ברגע שיש התראה פעילה. התראות שהופעלו חוזרות כ-toasts שנעלמים לבד אחרי ~8ש'.
 * מנקה interval + טיימרים ב-unmount.
 */
export function useAlertCheck() {
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let currentMs = POLL_MS;
    const localTimers = timers.current;

    function schedule(ms: number) {
      if (interval && ms === currentMs) return;
      if (interval) clearInterval(interval);
      currentMs = ms;
      interval = setInterval(check, ms);
    }

    async function check() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/alerts/check", { method: "POST" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        schedule(json?.activeCount === 0 ? POLL_IDLE_MS : POLL_MS);
        if (!Array.isArray(json?.triggered) || json.triggered.length === 0) return;
        const now = Date.now();
        const fresh: AlertToast[] = json.triggered.map((t: any, i: number) => ({
          id: `${now}-${i}-${t.symbol}`,
          symbol: t.symbol,
          targetPrice: t.targetPrice,
          currentPrice: t.currentPrice,
          direction: t.direction,
          note: t.note ?? null,
        }));
        setToasts((prev) => [...prev, ...fresh]);
        for (const f of fresh) {
          const tm = setTimeout(() => dismiss(f.id), TOAST_MS);
          localTimers.set(f.id, tm);
        }
      } catch {
        /* דלג בשקט */
      }
    }

    schedule(POLL_MS);
    check();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      localTimers.forEach((t) => clearTimeout(t));
      localTimers.clear();
    };
  }, [dismiss]);

  return { toasts, dismiss };
}
