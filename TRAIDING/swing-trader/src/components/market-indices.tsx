"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

type Quote = {
  symbol: string;
  label: string;
  price: number | null;
  changePercent: number | null;
};

const DISPLAY_SYMBOLS = ["SPY", "QQQ", "^VIX", "BTC-USD", "ETH-USD"];

function formatPrice(symbol: string, price: number | null): string {
  if (price == null) return "—";
  if (symbol === "BTC-USD" || symbol === "ETH-USD") {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `$${price.toFixed(2)}`;
}

export default function MarketIndices() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/quotes/ticker", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.ok) {
          const filtered = json.quotes.filter((q: Quote) =>
            DISPLAY_SYMBOLS.includes(q.symbol)
          );
          const sorted = DISPLAY_SYMBOLS
            .map((s) => filtered.find((q: Quote) => q.symbol === s))
            .filter(Boolean) as Quote[];
          setQuotes(sorted);
          setLoading(false);
        }
      } catch {}
    }
    load();
    const t = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
      {quotes.map((q) => {
        const up = (q.changePercent ?? 0) >= 0;
        const isVix = q.symbol === "^VIX";
        const isCrypto = q.symbol === "BTC-USD" || q.symbol === "ETH-USD";
        return (
          <a
            key={q.symbol}
            href={`https://www.tradingview.com/chart/?symbol=${q.symbol.replace("^", "").replace("-", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-2xl p-4 glass-hover group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                {q.label}
              </span>
              {!isVix && (up ? (
                <TrendingUp className="w-3.5 h-3.5 text-[var(--up)]" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-[var(--down)]" />
              ))}
            </div>
            <div className={cn("mono font-black", isCrypto ? "text-base" : "text-xl")}>
              {formatPrice(q.symbol, q.price)}
            </div>
            <div className={cn(
              "mono text-sm font-bold mt-1",
              isVix ? "text-[var(--warn)]" : isCrypto ? "text-[#f7931a]" : up ? "text-[var(--up)]" : "text-[var(--down)]"
            )}>
              {q.changePercent != null
                ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`
                : "—"}
            </div>
          </a>
        );
      })}
    </div>
  );
}
