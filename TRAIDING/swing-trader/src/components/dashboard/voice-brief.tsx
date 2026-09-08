"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VoiceBrief() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const warm = () => synth.getVoices();
    synth.addEventListener?.("voiceschanged", warm);
    return () => {
      synth.removeEventListener?.("voiceschanged", warm);
      synth.cancel();
    };
  }, [supported]);

  function speak(t: string) {
    if (!supported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "he-IL";
    const he = synth
      .getVoices()
      .find((v) => v.lang?.toLowerCase().startsWith("he"));
    if (he) u.voice = he;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    setSpeaking(true);
    synth.speak(u);
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/morning-brief");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "failed");
      setText(json.text as string);
      speak(json.text as string);
    } catch {
      setError("לא הצלחתי לטעון את סיכום הבוקר");
    } finally {
      setLoading(false);
    }
  }

  function stop() {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <div className="flex flex-col gap-2.5 items-start">
      <div className="flex gap-2">
        {speaking ? (
          <button
            onClick={stop}
            className="btn-metal btn-metal--active rounded-[11px] px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-2.5"
          >
            <Square className="w-3.5 h-3.5" />
            עצור
            <span className="vb-eq" aria-hidden><i /><i /><i /></span>
          </button>
        ) : (
          <button
            onClick={run}
            disabled={loading}
            className="btn-metal rounded-[11px] px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-2.5 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            סיכום בוקר
            {!loading && <span className="vb-dot" aria-hidden />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[var(--down)]">{error}</p>}
      {text && (
        <div className={cn("vb-card", speaking && "is-live")}>
          <p>{text}</p>
        </div>
      )}
      {text && !supported && (
        <p className="text-[11px] text-[var(--muted)]">
          הקראה קולית לא נתמכת בדפדפן הזה — מוצג הטקסט בלבד.
        </p>
      )}
    </div>
  );
}
