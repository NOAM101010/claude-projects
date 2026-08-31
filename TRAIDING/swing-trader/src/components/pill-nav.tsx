"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radar, Calculator, Star, Settings, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import MarketClock from "./market-clock";

const NAV = [
  { href: "/", label: "ראשי", icon: Home },
  { href: "/scanner", label: "סורק", icon: Radar },
  { href: "/analyze", label: "ניתוח", icon: Sparkles },
  { href: "/calculator", label: "מחשבון", icon: Calculator },
  { href: "/journal", label: "יומן", icon: BookOpen },
  { href: "/watchlist", label: "מעקב", icon: Star },
];

export default function PillNav() {
  const pathname = usePathname();
  return (
    <header className="fixed top-4 md:top-6 inset-x-0 z-40 px-3 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center gap-2 md:gap-3">
        <Link
          href="/"
          className="glass rounded-full pr-3 pl-2 py-1.5 flex items-center gap-2 shrink-0 group"
        >
          <div className="w-8 h-8 rounded-full p-[2px] bg-[conic-gradient(from_90deg,var(--up),var(--fg),var(--down),var(--up))]">
            <div className="w-full h-full rounded-full bg-[var(--bg)] flex items-center justify-center font-black text-xs">
              S
            </div>
          </div>
          <div className="hidden sm:block leading-none">
            <div className="text-sm font-black tracking-tight">Swing</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)] mt-0.5">Terminal</div>
          </div>
        </Link>

        <nav className="glass rounded-full px-1.5 py-1.5 flex-1 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap shrink-0",
                  active
                    ? "bg-[rgba(16,185,129,0.15)] text-[var(--up)] border border-[rgba(16,185,129,0.3)] shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                    : "text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-white/5 border border-transparent"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <div className="glass rounded-full px-4 py-2">
            <MarketClock />
          </div>
        </div>

        <Link
          href="/settings"
          className={cn(
            "glass rounded-full p-2.5 shrink-0 transition-colors",
            pathname.startsWith("/settings") ? "text-[var(--up)]" : "text-[var(--fg-dim)] hover:text-[var(--fg)]"
          )}
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
