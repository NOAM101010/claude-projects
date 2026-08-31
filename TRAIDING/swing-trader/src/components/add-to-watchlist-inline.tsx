"use client";

import { useState } from "react";
import { Star, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  symbol: string;
  folders: { id: string; name: string }[];
};

export default function AddToWatchlistInline({ symbol, folders }: Props) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function add(folderId?: string) {
    setLoading(true);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, folderId: folderId ?? null }),
      });
      setAdded(true);
      setOpen(false);
    } catch {} finally {
      setLoading(false);
    }
  }

  if (added) {
    return (
      <span className="text-[var(--up)] flex items-center gap-1 text-xs">
        <Check className="w-3.5 h-3.5" />
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => folders.length > 0 ? setOpen(!open) : add()}
        disabled={loading}
        className="text-[var(--muted)] hover:text-[var(--warn)] transition-colors p-1"
        title="הוסף למעקב"
      >
        <Star className="w-4 h-4" />
      </button>

      {open && folders.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 glass rounded-xl border border-[var(--border-hi)] py-1 min-w-[140px] shadow-xl">
          <button
            onClick={() => add()}
            className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
          >
            ללא תיקייה
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => add(f.id)}
              className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
