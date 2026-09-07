"use client";

import { useEffect, useState } from "react";
import { Display } from "@/components/ui";
import { timeGreeting, sessionInfo, type SessionInfo } from "@/lib/greeting";

export default function HomeGreeting() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    return (
      <div className="mt-3 space-y-3">
        <Display>
          <span className="inline-block h-[0.9em] w-[5ch] rounded-lg shimmer align-middle" />
        </Display>
        <span className="inline-block h-[26px] w-[13ch] rounded-lg shimmer" />
      </div>
    );
  }

  const greeting = timeGreeting(now);
  const session: SessionInfo = sessionInfo(now);

  return (
    <div className="mt-3">
      <Display>{greeting}.</Display>
      <p
        className={
          "mt-2.5 font-medium leading-tight tracking-tight text-[clamp(18px,3.2vw,28px)] " +
          (session.bullish ? "trend-up-glow" : "trend-down-glow")
        }
      >
        {session.text}
      </p>
    </div>
  );
}
