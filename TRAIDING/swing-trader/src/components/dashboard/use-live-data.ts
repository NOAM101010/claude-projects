"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** ms epoch of the last successful fetch */
  updatedAt: number | null;
  /** bumps on every successful refresh that is NOT the first load */
  tick: number;
  refresh: () => void;
};

type Options = {
  /** desktop cadence; coarse pointers get 2x. 0 = fetch once, never poll. */
  intervalMs?: number;
  /** skip polling entirely (e.g. static data) */
  once?: boolean;
};

/**
 * Polls a JSON endpoint on an interval with a single in-flight request.
 *
 * ─ one AbortController per request, aborted on unmount / re-fetch
 * ─ pauses while the tab is hidden, refreshes immediately on return
 * ─ coarse pointers (phones) poll at half the rate to save battery/quota
 * ─ never sets state after unmount; `loading` only true on the FIRST load,
 *   so a refresh does not flash skeletons over live content.
 */
export function useLiveData<T>(url: string, { intervalMs = 20_000, once = false }: Options = {}): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const firstRef = useRef(true);
  const hasDataRef = useRef(false);
  const [manual, setManual] = useState(0);

  const refresh = useCallback(() => setManual((n) => n + 1), []);

  useEffect(() => {
    aliveRef.current = true;
    firstRef.current = !hasDataRef.current;
    if (!hasDataRef.current) setLoading(true);

    // `force` = a mount/refresh must always win over an in-flight poll,
    // otherwise React StrictMode's double-mount leaves us with an aborted
    // first request and a skipped second one (= no data, forever).
    const run = async (force = false) => {
      if (inFlightRef.current && !force) return;
      inFlightRef.current = true;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
        const json = await res.json();
        if (!aliveRef.current || ac.signal.aborted) return;
        if (json?.ok === false) {
          setError(json.error ?? "שגיאה");
        } else {
          setError(null);
          setData(json as T);
          hasDataRef.current = true;
          setUpdatedAt(Date.now());
          if (!firstRef.current) setTick((n) => n + 1);
        }
      } catch (e) {
        if (!aliveRef.current || (e as Error)?.name === "AbortError") return;
        setError(String(e));
      } finally {
        // only the newest request owns the flags
        if (abortRef.current === ac) {
          inFlightRef.current = false;
          if (aliveRef.current) {
            firstRef.current = false;
            setLoading(false);
          }
        }
      }
    };

    void run(true);

    if (once || intervalMs <= 0) {
      return () => {
        aliveRef.current = false;
        abortRef.current?.abort();
      };
    }

    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    const period = coarse ? intervalMs * 2 : intervalMs;

    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void run();
    }, period);

    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      aliveRef.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
    };
  }, [url, intervalMs, once, manual]);

  return { data, loading, error, updatedAt, tick, refresh };
}

/** true when the user asked for less motion (live, updates on change) */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** true on a real pointer device that also allows motion */
export function useInteractive(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(
      "(pointer: fine) and (prefers-reduced-motion: no-preference)"
    );
    const update = () => setOk(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return ok;
}
