import { prisma } from "./prisma";
import { syncWatchlistMessage } from "./watchlist-notify";

/**
 * מוסיף סימבול לרשימת המעקב (idempotent — אם כבר קיים באותה תיקייה, לא יוצר כפילות).
 */
export async function addToWatchlist(
  symbol: string,
  folderId?: string | null,
  notes?: string | null
): Promise<{ id: string; created: boolean }> {
  const s = String(symbol ?? "").trim().toUpperCase();
  if (!s) throw new Error("no symbol");

  const existing = await prisma.watchlist.findFirst({
    where: { symbol: s, folderId: folderId ?? null },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }

  const item = await prisma.watchlist.create({
    data: { symbol: s, folderId: folderId ?? null, notes: notes ?? null },
  });
  syncWatchlistMessage();
  return { id: item.id, created: true };
}

/**
 * מסיר מרשימת המעקב — לפי id ספציפי, או לפי symbol (מוחק את כל ההתאמות).
 */
export async function removeFromWatchlist(opts: {
  id?: string;
  symbol?: string;
}): Promise<void> {
  if (opts.id) {
    await prisma.watchlist.delete({ where: { id: opts.id } });
  } else if (opts.symbol) {
    await prisma.watchlist.deleteMany({
      where: { symbol: String(opts.symbol).toUpperCase() },
    });
  }
  syncWatchlistMessage();
}
