"use client";

import { useState } from "react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Radar, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RunScannerButton({ children }: { children?: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/scanner/run", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "scan failed");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <LiquidButton size="lg" onClick={run} disabled={running}>
        {running ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> סורק...</>
        ) : (
          <><Radar className="w-4 h-4" /> {children ?? "הרץ סריקה"}</>
        )}
      </LiquidButton>
      {error && (
        <span className="text-xs text-[var(--down)]">{error}</span>
      )}
    </div>
  );
}
