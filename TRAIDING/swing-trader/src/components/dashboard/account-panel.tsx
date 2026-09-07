"use client";

import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { useCountUp } from "./use-count-up";
import LiveNumber from "./live-number";

type Props = {
  accountSize: number | null;
  cashBalance: number | null;
  totalOpenPnl: number | null;
  monthReturnPct: number | null;
  exposurePct: number | null;
  openRisk: number | null;
  openPositions: number;
};

function tone(n: number | null | undefined) {
  if (n == null) return "text-[var(--fg-dim)]";
  return n > 0 ? "text-[var(--up)]" : n < 0 ? "text-[var(--down)]" : "text-[var(--fg-dim)]";
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-[var(--muted)] mono">
        {label}
      </div>
      <div className="mono text-lg font-bold mt-1 num">{children}</div>
    </div>
  );
}

export default function AccountPanel({
  accountSize,
  cashBalance,
  totalOpenPnl,
  monthReturnPct,
  exposurePct,
  openRisk,
  openPositions,
}: Props) {
  const netWorth = (accountSize ?? 0) + (totalOpenPnl ?? 0);
  const animated = useCountUp(netWorth, 1400);

  return (
    <div className="metal-panel p-6 pb-9 w-full holo-edge holo-edge--amber">
      <div className="flex items-start justify-between relative z-[3]">
        <div>
          <div className="text-[13px] font-black tracking-[0.02em]">SWING TERMINAL</div>
          <div className="text-[8.5px] uppercase tracking-[0.3em] text-[var(--muted)] mt-1 mono">
            Trading Account
          </div>
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--up)] pulse-dot mt-1.5" style={{ boxShadow: "0 0 8px var(--up-glow)" }} />
      </div>

      <div className="mt-6 relative z-[3]">
        <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted)] mono">
          שווי כולל
        </div>
        <LiveNumber
          value={netWorth}
          className="mono text-[44px] md:text-[54px] font-black leading-[0.95] mt-1.5 block num text-[var(--warn-2)]"
        >
          {accountSize == null ? "—" : formatCurrency(animated, 0)}
        </LiveNumber>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 mt-7 pt-5 border-t border-[rgba(0,0,0,0.4)] relative z-[3]">
        <Cell label="גודל חשבון">
          {accountSize == null ? "—" : formatCurrency(accountSize, 0)}
        </Cell>
        <Cell label="מזומן פנוי">
          {cashBalance == null ? "—" : formatCurrency(cashBalance, 0)}
        </Cell>
        <Cell label="P&L החודש %">
          <span className={tone(monthReturnPct)}>
            {monthReturnPct == null ? "—" : formatPercent(monthReturnPct, 1)}
          </span>
        </Cell>
        <Cell label="חשיפה %">
          {exposurePct == null ? "—" : `${exposurePct.toFixed(0)}%`}
        </Cell>
      </div>

      <div className="flex flex-wrap gap-2 mt-6 relative z-[3]">
        <span className="det-chip">POS · {openPositions}</span>
        <span
          className={cn(
            "det-chip",
            (totalOpenPnl ?? 0) >= 0 ? "det-chip--up" : "det-chip--down"
          )}
        >
          OPEN P&L ·{" "}
          <LiveNumber value={totalOpenPnl}>
            {totalOpenPnl == null ? "—" : formatCurrency(totalOpenPnl, 0)}
          </LiveNumber>
        </span>
        {(openRisk ?? 0) > 0 && (
          <span className="det-chip det-chip--down">
            RISK · {formatCurrency(-Math.abs(openRisk as number), 0)}
          </span>
        )}
      </div>

      <span className="metal-engrave">ACCOUNT</span>
    </div>
  );
}
