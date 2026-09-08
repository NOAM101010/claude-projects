"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radar, Calculator, Star, Settings, BookOpen, Sparkles, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import MarketClock from "./market-clock";

const NAV = [
  { href: "/", label: "ראשי", icon: Home },
  { href: "/scanner", label: "סורק", icon: Radar },
  { href: "/analyze", label: "ניתוח", icon: Sparkles },
  { href: "/calculator", label: "מחשבון", icon: Calculator },
  { href: "/journal", label: "יומן", icon: BookOpen },
  { href: "/reports", label: "דוחות", icon: BarChart3 },
  { href: "/watchlist", label: "מעקב", icon: Star },
];

export default function PillNav() {
  const pathname = usePathname();
  return (
    <header className="fixed top-4 md:top-6 inset-x-0 z-40 px-3 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center gap-2 md:gap-3">
        <Link
          href="/"
          className="btn-metal rounded-[13px] pr-3 pl-2 py-1.5 flex items-center gap-2.5 shrink-0 group"
        >
          <div className="w-8 h-8 rounded-full p-[2px] bg-[conic-gradient(from_140deg,var(--warn-2),#5a4522,var(--warn-2),#3a2e18,var(--warn-2))]">
            <div className="w-full h-full rounded-full bg-[var(--metal-1)] flex items-center justify-center font-black text-xs text-[var(--warn-2)]">
              S
            </div>
          </div>
          <div className="hidden sm:block leading-none">
            <div className="text-sm font-black tracking-tight">Swing</div>
            <div className="text-[9px] uppercase tracking-[0.24em] text-[var(--muted)] mt-0.5 mono">Terminal</div>
          </div>
        </Link>

        <nav className="rounded-[13px] border border-[var(--metal-edge)] bg-[var(--metal-1)]/85 px-1.5 py-1.5 flex-1 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar shadow-[inset_0_1px_0_var(--metal-hi)]">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 px-3 md:px-3.5 py-1.5 rounded-[9px] text-sm font-semibold whitespace-nowrap shrink-0",
                  active
                    ? "btn-metal btn-metal--active"
                    : "btn-metal text-[var(--fg-dim)] hover:text-[var(--fg)]"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <div className="btn-metal rounded-[13px] px-4 py-2.5">
            <MarketClock />
          </div>
        </div>

        <Link
          href="/settings"
          className={cn(
            "btn-metal rounded-[13px] p-2.5 shrink-0",
            pathname.startsWith("/settings") ? "text-[var(--warn-2)]" : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
          )}
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
