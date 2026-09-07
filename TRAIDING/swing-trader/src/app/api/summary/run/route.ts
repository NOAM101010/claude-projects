import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStats, type TradeRow } from "@/lib/trade-stats";
import { computeMarketRegime } from "@/lib/market-regime";
import { yf } from "@/lib/yf";
import { sendToChannel, FOOTER, type DiscordEmbed } from "@/lib/discord";
import { getMarketHoliday } from "@/lib/market-calendar";
import { getCuratedNews } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const AMBER = 0xe8b341;
const UP = 0x4ade80;
const DOWN = 0xf87171;

const usd = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(0)}`;
const pnlColor = (n: number) => (n > 0 ? UP : n < 0 ? DOWN : AMBER);

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

/** מחזיר את יום השבוע ב-ET: 0=ראשון .. 5=שישי .. 6=שבת */
function etWeekday(d: Date): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

async function openPositionsSummary() {
  const open = await prisma.trade.findMany({ where: { sellDate: null } });
  const tickers = Array.from(new Set(open.map((t) => t.ticker.toUpperCase())));
  const priceMap = new Map<string, number | null>();
  const BATCH = 8;
  for (let i = 0; i < tickers.length; i += BATCH) {
    await Promise.all(
      tickers.slice(i, i + BATCH).map(async (sym) => {
        try {
          const q: any = await yf.quote(sym);
          priceMap.set(sym, (q?.regularMarketPrice as number) ?? null);
        } catch {
          priceMap.set(sym, null);
        }
      })
    );
  }
  let unrealized = 0;
  for (const t of open) {
    const cur = priceMap.get(t.ticker.toUpperCase());
    if (cur != null) unrealized += (cur - t.buyPrice) * t.quantity;
  }
  return { count: open.length, unrealized };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // חג של NYSE — אין P&L חדש, מדלגים על הדוח (וגם על דוח שבוע אם שישי היה חג),
    // אבל שולחים הודעה קצרה לערוץ updates.
    const holiday = getMarketHoliday(now);
    if (holiday) {
      await sendToChannel("updates", [
        {
          title: "📅 השוק היה סגור היום",
          description: `אין דוח יומי — הבורסה בארה"ב הייתה סגורה · ${holiday.nameHe}.`,
          color: AMBER,
          footer: FOOTER,
          timestamp: now.toISOString(),
        },
      ]).catch(() => {});
      return NextResponse.json({ ok: true, skipped: "holiday", holiday: holiday.name });
    }

    const todayKey = now.toISOString().slice(0, 10);
    const startOfToday = new Date(`${todayKey}T00:00:00.000Z`);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const [trades, regime, positions, scanResults] = await Promise.all([
      prisma.trade.findMany({ orderBy: { buyDate: "desc" } }),
      computeMarketRegime().catch(() => null),
      openPositionsSummary().catch(() => ({ count: 0, unrealized: 0 })),
      prisma.scannerResult.findMany({
        where: { runAt: { gte: startOfToday } },
        orderBy: { score: "desc" },
      }),
    ]);

    const rows = trades.map(toRow);
    const stats = computeStats(rows);

    const todayPnl = stats.dailyPnl
      .filter((d) => d.date === todayKey)
      .reduce((s, d) => s + d.pnl, 0);
    const todayTrades = stats.dailyPnl
      .filter((d) => d.date === todayKey)
      .reduce((s, d) => s + d.trades, 0);

    // מניות שהסריקה תפסה היום (ייחודי לפי סימבול) + טופ 3
    const seen = new Set<string>();
    const uniqueScans: typeof scanResults = [];
    for (const r of scanResults) {
      if (seen.has(r.symbol)) continue;
      seen.add(r.symbol);
      uniqueScans.push(r);
    }
    const top3 = uniqueScans.slice(0, 3);

    const regimeLine = regime
      ? `${regime.label} · ${regime.score >= 0 ? "+" : ""}${regime.score}`
      : "לא זמין";

    const dailyEmbed: DiscordEmbed = {
      title: `📊 דוח יום · ${todayKey}`,
      color: pnlColor(todayPnl),
      fields: [
        {
          name: "P&L היום",
          value: `${usd(todayPnl)} · ${todayTrades} עסקאות סגורות`,
          inline: true,
        },
        {
          name: "פוזיציות פתוחות",
          value: `${positions.count} · ${usd(positions.unrealized)} לא ממומש`,
          inline: true,
        },
        {
          name: "מצב שוק",
          value: regimeLine,
          inline: true,
        },
        {
          name: `סריקה היום · ${uniqueScans.length} מניות`,
          value:
            top3.length > 0
              ? top3
                  .map(
                    (r) =>
                      `**${r.symbol}**${r.grade ? ` \`${r.grade}\`` : ""}${
                        r.score != null ? ` · ${Math.round(r.score)}` : ""
                      }`
                  )
                  .join(" · ")
              : "—",
        },
      ],
      footer: FOOTER,
      timestamp: now.toISOString(),
    };

    const embeds: DiscordEmbed[] = [dailyEmbed];

    // דוח שבוע — בימי שישי (ET)
    const isFriday = etWeekday(now) === 5;
    let weekly: Record<string, unknown> | null = null;
    if (isFriday) {
      const weekRows = rows.filter(
        (r) => r.sellDate != null && r.sellDate >= weekAgo
      );
      const weekStats = computeStats(weekRows);
      const best = weekStats.bestTrade;
      const worst = weekStats.worstTrade;

      const weeklyEmbed: DiscordEmbed = {
        title: "🗓️ דוח שבוע",
        color: pnlColor(weekStats.totalNetPnl),
        fields: [
          {
            name: "עסקאות השבוע",
            value: `${weekStats.closedTrades} סגורות · ${weekStats.wins}W / ${weekStats.losses}L`,
            inline: true,
          },
          {
            name: "Win Rate",
            value: `${weekStats.winRate.toFixed(0)}%`,
            inline: true,
          },
          {
            name: "שינוי בעקומת ההון",
            value: usd(weekStats.totalNetPnl),
            inline: true,
          },
          {
            name: "Best trade",
            value: best ? `${best.ticker} ${usd(best.netPnl)}` : "—",
            inline: true,
          },
          {
            name: "Worst trade",
            value: worst ? `${worst.ticker} ${usd(worst.netPnl)}` : "—",
            inline: true,
          },
          {
            name: "מצב שוק בסוף השבוע",
            value: regimeLine,
            inline: true,
          },
        ],
        footer: FOOTER,
        timestamp: now.toISOString(),
      };
      embeds.push(weeklyEmbed);
      weekly = {
        closedTrades: weekStats.closedTrades,
        winRate: weekStats.winRate,
        netPnl: weekStats.totalNetPnl,
        best: best ? { ticker: best.ticker, netPnl: best.netPnl } : null,
        worst: worst ? { ticker: worst.ticker, netPnl: worst.netPnl } : null,
      };
    }

    const send = await sendToChannel("summary", embeds);

    // כותרות רלוונטיות לפוזיציות / לסריקה → ערוץ updates
    try {
      const { items: newsItems } = await getCuratedNews();
      const relevantSymbols = new Set(uniqueScans.map((r) => r.symbol.toUpperCase()));
      const news = newsItems
        .filter(
          (n) =>
            n.category === "position" ||
            (n.symbol != null && relevantSymbols.has(n.symbol.toUpperCase()))
        )
        .slice(0, 5);
      if (news.length > 0) {
        await sendToChannel("updates", [
          {
            title: "📰 כותרות שרלוונטיות לפוזיציות/לסריקה",
            description: news
              .map(
                (n) =>
                  `• [${n.title}](${n.url})${n.symbol ? ` \`${n.symbol}\`` : ""} — ${n.source}`
              )
              .join("\n"),
            color: AMBER,
            footer: FOOTER,
            timestamp: now.toISOString(),
          },
        ]).catch(() => {});
      }
    } catch {
      /* דלג בשקט */
    }

    return NextResponse.json({
      ok: true,
      sent: !send.skipped,
      skipped: !!send.skipped,
      error: send.error ?? null,
      daily: {
        date: todayKey,
        todayPnl,
        todayTrades,
        openPositions: positions.count,
        unrealizedPnl: positions.unrealized,
        scansToday: uniqueScans.length,
        top3: top3.map((r) => r.symbol),
        regime: regimeLine,
      },
      weekly,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
