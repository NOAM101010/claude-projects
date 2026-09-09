import Link from "next/link";
import { Lock, Radar } from "lucide-react";
import "./wall.css";

/** shown when there are no open positions (and nobody falling) — no Canvas mounted */
export default function WallLocked() {
  return (
    <div className="wall-locked flex flex-col items-center justify-center text-center py-24 px-6 min-h-[60vh]">
      <div className="wall-rock" />
      <div className="wall-chain wall-chain--a" />
      <div className="wall-chain wall-chain--b" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl border border-[var(--metal-edge)] bg-gradient-to-b from-[var(--metal-2)] to-[var(--metal-1)] flex items-center justify-center mb-6 shadow-[inset_0_1px_0_var(--metal-hi)]">
          <Lock className="w-6 h-6 text-[var(--warn-2)]" />
        </div>
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
