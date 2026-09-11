/**
 * מימוש הפקודות של בוט ה-Discord (HTTP Interactions).
 * כל פונקציה מחזירה DiscordEmbed מוכן לשליחה.
 */
import { prisma } from "@/lib/prisma";
import { yf } from "@/lib/yf";
import { computeStats, type TradeRow } from "@/lib/trade-stats";
import { FOOTER, type DiscordEmbed, stockAnalysisEmbed } from "@/lib/discord";
import { analyzeStock } from "@/lib/stock-analyzer";
import { addToWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { fetchYahooRss, getCuratedNews } from "@/lib/news";

const AMBER = 0xe8b341;
const UP = 0x4ade80;
const DOWN = 0xf87171;

const pnlColor = (n: number) => (n > 0 ? UP : n < 0 ? DOWN : AMBER);
const usd = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(0)}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function errorEmbed(message: string): DiscordEmbed {
  return {
    title: "⚠️ שגיאה",
    description: message,
    color: DOWN,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

function toRow(t: any): TradeRow {
  return {
    id: t.id,
    ticker: t.ticker,
    quantity: t.quantity,
    buyPrice: t.buyPrice,
    buyAmount: t.buyAmount,
    buyDate: t.buyDate,
    sellPrice: t.sellPrice,
    sellAmount: t.sellAmount,
    sellDate: t.sellDate,
    commission: t.commission,
    usdIlsRate: t.usdIlsRate,
    stopPrice: t.stopPrice,
    setup: t.setup,
    notes: t.notes,
  };
}

async function batchedPrices(symbols: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const BATCH = 8;
  for (let i = 0; i < symbols.length; i += BATCH) {
    await Promise.all(
      symbols.slice(i, i + BATCH).map(async (sym) => {
        try {
          const q: any = await yf.quote(sym);
          out.set(sym, (q?.regularMarketPrice as number) ?? null);
        } catch {
          out.set(sym, null);
        }
      })
    );
  }
  return out;
}

// ==================== מחיר ====================

export async function priceEmbed(rawSymbol: string): Promise<DiscordEmbed> {
  const symbol = rawSymbol.toUpperCase().trim();
  if (!symbol) return errorEmbed("לא הוזן סימבול.");

  let q: any;
  try {
    q = await yf.quote(symbol);
  } catch {
    return errorEmbed(`לא נמצאה מניה בשם "${symbol}". בדוק את הסימבול.`);
  }
  if (!q || q.regularMarketPrice == null) {
    return errorEmbed(`לא נמצאה מניה בשם "${symbol}". בדוק את הסימבול.`);
  }

  const price = q.regularMarketPrice as number;
  const changePercent = (q.regularMarketChangePercent as number) ?? null;
  const high52w = (q.fiftyTwoWeekHigh as number) ?? null;
  const low52w = (q.fiftyTwoWeekLow as number) ?? null;
  const name = (q.shortName as string) ?? (q.longName as string) ?? null;
  const distFromHigh =
    high52w && high52w !== 0 ? ((price - high52w) / high52w) * 100 : null;

  const fields: DiscordEmbed["fields"] = [
    { name: "מחיר", value: `$${price.toFixed(2)}`, inline: true },
    {
      name: "שינוי יומי",
      value: changePercent != null ? pct(changePercent) : "—",
      inline: true,
    },
    {
      name: "מרחק משיא 52ש'",
      value:
        distFromHigh != null
          ? `${pct(distFromHigh)}${high52w ? ` (שיא $${high52w.toFixed(2)})` : ""}`
          : "—",
      inline: true,
    },
  ];
  if (low52w != null)
    fields.push({ name: "שפל 52ש'", value: `$${low52w.toFixed(2)}`, inline: true });

  return {
    title: `${symbol}${name ? ` · ${name}` : ""}`,
    color: changePercent != null ? pnlColor(changePercent) : AMBER,
    fields,
    url: `https://www.tradingview.com/chart/?symbol=${symbol}`,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

// ==================== פוזיציות ====================

export async function positionsEmbed(): Promise<DiscordEmbed> {
  const open = await prisma.trade.findMany({
    where: { sellDate: null },
    orderBy: { buyDate: "desc" },
  });

  if (open.length === 0) {
    return {
      title: "📁 פוזיציות פתוחות",
      description: "אין פוזיציות פתוחות כרגע.",
      color: AMBER,
      footer: FOOTER,
      timestamp: new Date().toISOString(),
    };
  }

  const tickers = Array.from(new Set(open.map((t) => t.ticker.toUpperCase())));
  const priceMap = await batchedPrices(tickers);

  let totalPnl = 0;
  const fields: DiscordEmbed["fields"] = open.map((t) => {
    const now = priceMap.get(t.ticker.toUpperCase()) ?? null;
    if (now != null) totalPnl += (now - t.buyPrice) * t.quantity;
    const pnlPct =
      now != null && t.buyPrice !== 0 ? ((now - t.buyPrice) / t.buyPrice) * 100 : null;
    const pnlUsd = now != null ? (now - t.buyPrice) * t.quantity : null;
    return {
      name: t.ticker.toUpperCase(),
      value:
        now != null
          ? `$${t.buyPrice.toFixed(2)}→$${now.toFixed(2)} · ${pnlPct != null ? pct(pnlPct) : "—"} (${pnlUsd != null ? usd(pnlUsd) : "—"})`
          : `$${t.buyPrice.toFixed(2)} · מחיר חי לא זמין`,
      inline: false,
    };
  });

  return {
    title: `📁 ${open.length} פוזיציות פתוחות`,
    description: `P&L כולל לא ממומש: **${usd(totalPnl)}**`,
    color: pnlColor(totalPnl),
    fields,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

// ==================== סריקה ====================

export async function scanEmbed(): Promise<DiscordEmbed> {
  const run = await prisma.scannerRun.findFirst({
    where: { status: "success" },
    orderBy: { startedAt: "desc" },
  });

  if (!run) {
    return {
      title: "🔍 סריקה אחרונה",
      description: "לא נמצאה סריקה מוצלחת.",
      color: AMBER,
      footer: FOOTER,
      timestamp: new Date().toISOString(),
    };
  }

  const results = await prisma.scannerResult.findMany({
    where: { runId: run.id },
    orderBy: { score: "desc" },
    take: 10,
  });

  const description = results.length
    ? results
        .map((r, i) => {
          const chg =
            r.changePercent != null
              ? `${r.changePercent >= 0 ? "▲" : "▼"} ${r.changePercent.toFixed(1)}%`
              : "";
          const grade = r.grade ? `\`${r.grade}\`` : "";
          let setups = "";
          try {
            const arr = r.matchedSetups ? JSON.parse(r.matchedSetups) : [];
            if (Array.isArray(arr)) setups = arr.slice(0, 2).join(" · ");
          } catch {
            /* התעלם */
          }
          return `**${i + 1}. [${r.symbol}](https://www.tradingview.com/chart/?symbol=${r.symbol})** ${grade} ${chg}${setups ? `\n${setups}` : ""}`;
        })
        .join("\n")
    : "אין תוצאות בסריקה האחרונה.";

  return {
    title: `🔍 סריקה אחרונה · ${run.scanType}`,
    description,
    color: AMBER,
    footer: {
      text: `Swing Terminal · סרוקות ${run.totalScanned} · תואמות ${run.totalMatches} · ${run.startedAt.toISOString().slice(0, 16).replace("T", " ")}`,
    },
    timestamp: new Date().toISOString(),
  };
}

// ==================== ביצועים ====================

export async function performanceEmbed(): Promise<DiscordEmbed> {
  const trades = await prisma.trade.findMany({ orderBy: { buyDate: "desc" } });
  const stats = computeStats(trades.map(toRow));

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = stats.byMonth.find((m) => m.month === monthKey);

  return {
    title: `📈 ביצועים · ${monthKey}`,
    color: pnlColor(month?.netPnl ?? 0),
    fields: [
      {
        name: "P&L החודש",
        value: month ? usd(month.netPnl) : "$0",
        inline: true,
      },
      {
        name: "עסקאות החודש",
        value: month ? `${month.trades} סגורות` : "0",
        inline: true,
      },
      {
        name: "Win Rate החודש",
        value: month ? `${month.winRate.toFixed(0)}%` : "—",
        inline: true,
      },
      {
        name: "כללי",
        value: `${stats.closedTrades} עסקאות · ${stats.winRate.toFixed(0)}% הצלחה · P&L ${usd(stats.totalNetPnl)}`,
        inline: false,
      },
    ],
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

// ==================== התראה ====================

export async function createAlertEmbed(
  rawSymbol: string,
  rawPrice: number,
  rawDirection: string
): Promise<DiscordEmbed> {
  const symbol = (rawSymbol ?? "").toUpperCase().trim();
  const price = Number(rawPrice);
  if (!symbol) return errorEmbed("לא הוזן סימבול.");
  if (!Number.isFinite(price) || price <= 0)
    return errorEmbed("מחיר היעד חייב להיות מספר גדול מ-0.");

  if (rawDirection !== "מעל" && rawDirection !== "מתחת")
    return errorEmbed('כיוון לא תקין. השתמש ב-"מעל" או "מתחת".');
  const direction = rawDirection === "מעל" ? "above" : "below";

  await prisma.priceAlert.create({
    data: { symbol, targetPrice: price, direction },
  });

  return {
    title: "🔔 התראת מחיר נוצרה",
    description: `אתריע כש-**${symbol}** ${direction === "above" ? "יעלה מעל" : "ירד מתחת ל-"} **$${price}**.`,
    color: UP,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

// ==================== נתח ====================

export async function analyzeEmbed(rawSymbol: string): Promise<DiscordEmbed> {
  const symbol = rawSymbol.toUpperCase().trim();
  if (!symbol) return errorEmbed("לא הוזן סימבול.");

  const result = await analyzeStock(symbol);
  if ("error" in result) return errorEmbed(result.error);

  return stockAnalysisEmbed({
    symbol: result.symbol,
    name: result.name,
    price: result.price,
    changePercent: result.changePercent,
    grade: result.grade,
    score: result.score,
    verdict: result.verdict,
    signals: result.signals,
    suggestedStop: result.keyLevels.suggestedStop,
    setupLabel: result.setupLabel,
    patternValid: result.patternValid,
  });
}

// ==================== מעקב ====================

export async function watchlistCommandEmbed(
  action: string,
  rawSymbol: string
): Promise<DiscordEmbed> {
  const symbol = rawSymbol.toUpperCase().trim();
  if (!symbol) return errorEmbed("לא הוזן סימבול.");

  if (action === "add") {
    const { created } = await addToWatchlist(symbol);
    return {
      title: created ? "✅ נוסף למעקב" : "ℹ️ כבר ברשימה",
      description: created
        ? `**${symbol}** נוסף לרשימת המעקב.`
        : `**${symbol}** כבר נמצא ברשימת המעקב.`,
      color: UP,
      footer: FOOTER,
      timestamp: new Date().toISOString(),
    };
  }

  if (action === "remove") {
    await removeFromWatchlist({ symbol });
    return {
      title: "🗑️ הוסר ממעקב",
      description: `**${symbol}** הוסר מרשימת המעקב.`,
      color: AMBER,
      footer: FOOTER,
      timestamp: new Date().toISOString(),
    };
  }

  return errorEmbed('פעולה לא מוכרת. השתמש ב-"add" או "remove".');
}

// ==================== חדשות ====================

export async function newsEmbed(rawSymbol?: string): Promise<DiscordEmbed> {
  const symbol = rawSymbol?.toUpperCase().trim();

  const items = symbol
    ? (await fetchYahooRss(symbol)).slice(0, 5)
    : (await getCuratedNews()).items.slice(0, 5);

  if (items.length === 0) {
    return {
      title: symbol ? `📰 חדשות · ${symbol}` : "📰 חדשות",
      description: "לא נמצאו כותרות חדשות.",
      color: AMBER,
      footer: FOOTER,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    title: symbol ? `📰 חדשות · ${symbol}` : "📰 כותרות עדכניות",
    description: items
      .map(
        (n) =>
          `• [${n.title}](${n.url})${n.symbol ? ` \`${n.symbol}\`` : ""} — ${n.source}`
      )
      .join("\n"),
    color: AMBER,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}

// ==================== עזרה ====================

export function helpEmbed(): DiscordEmbed {
  return {
    title: "🤖 Swing Terminal — פקודות",
    description: [
      "`/מחיר symbol` — מחיר, שינוי יומי, מרחק משיא.",
      "`/פוזיציות` — הפוזיציות הפתוחות שלך + P&L חי.",
      "`/סריקה` — תוצאות הסריקה האחרונה.",
      "`/ביצועים` — P&L והצלחה החודש.",
      "`/התראה symbol מחיר כיוון` — צור התראת מחיר.",
      "`/נתח symbol` — ניתוח מניה מלא.",
      "`/מעקב פעולה symbol` — הוסף/הסר ממעקב.",
      "`/חדשות [symbol]` — כותרות חדשות.",
      "`/עזרה` — ההודעה הזו.",
    ].join("\n"),
    color: AMBER,
    footer: FOOTER,
    timestamp: new Date().toISOString(),
  };
}
