import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PageContainer, Eyebrow, Display, Card, Button, Input, EmptyState } from "@/components/ui";
import WatchlistClient from "@/components/watchlist-client";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const [folders, items] = await Promise.all([
    prisma.watchlistFolder.findMany({
      orderBy: { name: "asc" },
      include: { items: { orderBy: { addedAt: "desc" } } },
    }),
    prisma.watchlist.findMany({
      where: { folderId: null },
      orderBy: { addedAt: "desc" },
    }),
  ]);

  const data = {
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      items: f.items.map((i) => ({ id: i.id, symbol: i.symbol })),
    })),
    unfiled: items.map((i) => ({ id: i.id, symbol: i.symbol })),
  };

  const totalCount = data.unfiled.length + data.folders.reduce((s, f) => s + f.items.length, 0);

  return (
    <PageContainer className="space-y-10">
      <section>
        <Eyebrow>Watchlist · {totalCount} מניות</Eyebrow>
        <Display className="mt-3">
          המניות<br /><span className="trend-up-glow">שלך.</span>
        </Display>
        <p className="text-sm text-[var(--fg-dim)] mt-4 max-w-lg">
          ארגן מניות בתיקיות, העתק סימבולים ל-TradingView, או לחץ על מניה לפתוח את הגרף.
        </p>
      </section>

      <WatchlistClient data={data} />
    </PageContainer>
  );
}
