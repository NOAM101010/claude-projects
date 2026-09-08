import { prisma } from "./prisma";
import { yf } from "./yf";
import { sendPushToAll } from "./push";
import { sendToChannel, FOOTER } from "./discord";

const AMBER = 0xe8b341;

export type TriggeredAlert = {
  symbol: string;
  targetPrice: number;
  direction: string;
  currentPrice: number;
  note: string | null;
};

/**
 * טוען התראות מחיר פעילות, מושך ציטוטים בבאצ'ים, מסמן את מה שנגע ברמה
 * (triggeredAt=now, active=false) ושולח פוש + embed לערוץ updates.
 * משותף בין /api/alerts/check לבין הדוח היומי.
 */
export async function runAlertCheck(): Promise<{
  ok: boolean;
  triggered: TriggeredAlert[];
  activeCount: number;
}> {
  const alerts = await prisma.priceAlert.findMany({
    where: { active: true, triggeredAt: null },
  });
  if (alerts.length === 0) return { ok: true, triggered: [], activeCount: 0 };

  const symbols = Array.from(new Set(alerts.map((a) => a.symbol.toUpperCase())));
  const priceMap = new Map<string, number | null>();
  const BATCH = 8;
  for (let i = 0; i < symbols.length; i += BATCH) {
    await Promise.all(
      symbols.slice(i, i + BATCH).map(async (sym) => {
        try {
          const q: any = await yf.quote(sym);
          priceMap.set(sym, (q?.regularMarketPrice as number) ?? null);
        } catch {
          priceMap.set(sym, null);
        }
      })
    );
  }

  const triggered: TriggeredAlert[] = [];
  for (const a of alerts) {
    const price = priceMap.get(a.symbol.toUpperCase());
    if (price == null) continue;
    const hit =
      (a.direction === "above" && price >= a.targetPrice) ||
      (a.direction === "below" && price <= a.targetPrice);
    if (!hit) continue;

    // updateMany עם תנאי triggeredAt:null — קריאה מקבילה שנייה תקבל count===0 ולא תשלח שוב
    const { count } = await prisma.priceAlert.updateMany({
      where: { id: a.id, triggeredAt: null },
      data: { triggeredAt: new Date(), active: false },
    });
    if (count !== 1) continue;
    triggered.push({
      symbol: a.symbol.toUpperCase(),
      targetPrice: a.targetPrice,
      direction: a.direction,
      currentPrice: price,
      note: a.note,
    });
  }

  for (const t of triggered) {
    const dirHe = t.direction === "above" ? "מעל" : "מתחת ל-";
    await sendPushToAll({
      title: `🔔 ${t.symbol} חצתה $${t.targetPrice}`,
      body: `מחיר נוכחי $${t.currentPrice.toFixed(2)}${t.note ? ` · ${t.note}` : ""}`,
      url: "/watchlist",
    }).catch(() => {});
    await sendToChannel("updates", [
      {
        title: `🔔 ${t.symbol} חצתה ${dirHe}$${t.targetPrice}`,
        description: `מחיר נוכחי: **$${t.currentPrice.toFixed(2)}**${t.note ? `\n${t.note}` : ""}`,
        color: AMBER,
        footer: FOOTER,
        timestamp: new Date().toISOString(),
      },
    ]).catch(() => {});
  }

  const activeCount = await prisma.priceAlert.count({
    where: { active: true, triggeredAt: null },
  });

  return { ok: true, triggered, activeCount };
}
