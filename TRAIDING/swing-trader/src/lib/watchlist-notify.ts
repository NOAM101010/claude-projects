import { after } from "next/server";
import { prisma } from "./prisma";
import { upsertWatchlistMessage } from "./discord";

/**
 * מרענן את ההודעה החיה של רשימת המעקב ב-Discord אחרי שינוי.
 * רץ דרך after() — fire-and-forget לבד נהרג ב-serverless.
 */
export function syncWatchlistMessage(): void {
  after(async () => {
    try {
      const items = await prisma.watchlist.findMany({
        include: { folder: true },
        orderBy: { addedAt: "asc" },
      });
      await upsertWatchlistMessage(
        items.map((i) => ({
          symbol: i.symbol,
          folder: i.folder?.name ?? null,
          addedAt: i.addedAt,
        }))
      );
    } catch {
      /* דלג בשקט */
    }
  });
}
