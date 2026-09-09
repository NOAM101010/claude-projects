import { prisma } from "./prisma";
import { yf } from "./yf";
import { sendPushToAll } from "./push";
import { sendToChannel, FOOTER } from "./discord";
import { getSetting } from "./settings";

const AMBER = 0xe8b341;
const DOWN = 0xf87171;

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

export type StopClosed = {
  id: string;
  ticker: string;
  stopPrice: number;
  currentPrice: number;
  quantity: number;
  buyPrice: number;
  realizedPnl: number;
};

export type StopAlerted = {
  id: string;
  ticker: string;
  stopPrice: number;
  currentPrice: number;
};

/**
 * עובר על כל הפוזיציות הפתוחות שיש להן מחיר סטופ, מושך ציטוטים בבאצ'ים,
 * ולכל פוזיציה שהמחיר הנוכחי נגע בסטופ (או מתחתיו):
 *  - אם ההגדרה auto_close_on_stop מופעלת (ברירת מחדל — כל ערך שאינו "false"):
 *    סוגר את הפוזיציה אטומית במחיר הסטופ (sellPrice = stopPrice), מוסיף ל-closed
 *    ושולח פוש + embed לערוץ updates.
 *  - אם ההגדרה כבויה: מדלג לגמרי — לא סוגר ולא שולח שום התראה (alerted תמיד ריק).
 *    המשתמש בחר לנהל סטופים בעצמו; אזהרת "קרוב לסטופ" בלוח הבקרה מספיקה.
 * משותף בין /api/alerts/check לבין הדוח היומי.
 */
export async function runStopCheck(): Promise<{
  closed: StopClosed[];
  alerted: StopAlerted[];
  stillMonitoring: number;
}> {
  const trades = await prisma.trade.findMany({
    where: { sellDate: null, stopPrice: { not: null } },
  });
  if (trades.length === 0) return { closed: [], alerted: [], stillMonitoring: 0 };

  const autoClose = (await getSetting("auto_close_on_stop")) !== "false";

  // ההגדרה כבויה — המשתמש מנהל סטופים בעצמו. מדלגים בלי תופעות לוואי.
  if (!autoClose) {
    return { closed: [], alerted: [], stillMonitoring: trades.length };
  }

  const symbols = Array.from(
    new Set(trades.map((t) => t.ticker.toUpperCase()))
  );
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

  const closed: StopClosed[] = [];
  const alerted: StopAlerted[] = [];

  for (const t of trades) {
    const stopPrice = t.stopPrice;
    if (stopPrice == null) continue;
    const currentPrice = priceMap.get(t.ticker.toUpperCase());
    if (currentPrice == null || currentPrice > stopPrice) continue;

    const ticker = t.ticker.toUpperCase();

    // סגירה אטומית — updateMany עם sellDate:null מונע סגירה כפולה מקריאה מקבילה
    const now = new Date();
    const { count } = await prisma.trade.updateMany({
      where: { id: t.id, sellDate: null },
      data: {
        sellPrice: stopPrice,
        sellAmount: stopPrice * t.quantity,
        sellDate: now,
      },
    });
    if (count !== 1) continue;

    const realizedPnl = (stopPrice - t.buyPrice) * t.quantity - t.commission;
    closed.push({
      id: t.id,
      ticker,
      stopPrice,
      currentPrice,
      quantity: t.quantity,
      buyPrice: t.buyPrice,
      realizedPnl,
    });
  }

  const fmt = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;

  for (const c of closed) {
    await sendPushToAll({
      title: `🛑 ${c.ticker} נסגרה בסטופ $${c.stopPrice}`,
      body: `P&L ממומש ${fmt(c.realizedPnl)} · ${c.quantity} מניות`,
      url: "/journal",
    }).catch(() => {});
    const gap =
      c.currentPrice < c.stopPrice * 0.98
        ? `\nמחיר שוק בזמן הזיהוי: $${c.currentPrice.toFixed(2)} (גאפ)`
        : "";
    await sendToChannel("updates", [
      {
        title: `🛑 ${c.ticker} נסגרה בסטופ $${c.stopPrice}`,
        description: `P&L ממומש: **${fmt(c.realizedPnl)}**\nכניסה $${c.buyPrice.toFixed(2)} · ${c.quantity} מניות${gap}`,
        color: DOWN,
        footer: FOOTER,
        timestamp: new Date().toISOString(),
      },
    ]).catch(() => {});
  }

  const stillMonitoring = await prisma.trade.count({
    where: { sellDate: null, stopPrice: { not: null } },
  });

  return { closed, alerted, stillMonitoring };
}
