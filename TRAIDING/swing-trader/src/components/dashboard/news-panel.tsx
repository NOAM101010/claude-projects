"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLiveData } from "./use-live-data";

type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  symbol: string | null;
  category: "position" | "watchlist" | "market";
};

type NewsData = { ok: boolean; items: NewsItem[]; generatedAt: string };

const FILTERS: { key: "all" | NewsItem["category"]; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "position", label: "פוזיציות" },
  { key: "watchlist", label: "מעקב" },
  { key: "market", label: "שוק" },
];

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: he });
  } catch {
    return "";
  }
}

export default function NewsPanel() {
  // 10 minute refresh
  const q = useLiveData<NewsData>("/api/news", { intervalMs: 600_000 });
  const [filter, setFilter] = useState<"all" | NewsItem["category"]>("all");

  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    if (filter === "all") return all;
    return all.filter((it) => it.category === filter);
  }, [q.data, filter]);

  return (
    <Card className="p-6 holo-edge">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="display-serif panel-title">כותרות רלוונטיות</h3>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "det-chip transition-[opacity,color,background-color,border-color]",
                filter === f.key
                  ? "det-chip--on"
                  : "opacity-55 hover:opacity-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {q.loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="shimmer rounded-lg h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--fg-dim)] py-10 text-center">
          אין חדשות מהשעות האחרונות
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id}>
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2.5 rounded-lg row-hover border-t border-[var(--border)] first:border-t-0"
              >
                <div className="text-sm font-semibold leading-snug flex items-start gap-1.5">
                  <span className="flex-1">{it.title}</span>
                  <ExternalLink className="w-3 h-3 mt-1 shrink-0 text-[var(--muted-2)]" />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--fg-dim)]">
                  <span>{it.source}</span>
                  <span className="text-[var(--muted-2)]">·</span>
                  <span>{relTime(it.publishedAt)}</span>
                  {it.symbol && (
                    <span className="ticker text-[10px] px-1.5 rounded bg-white/[0.05]">
                      {it.symbol}
                    </span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-[var(--muted-2)] mt-4 leading-relaxed">
        כותרות ממקורות ציבוריים (Yahoo / Finnhub) — לא נבדקו ידנית.
      </p>
    </Card>
  );
}
