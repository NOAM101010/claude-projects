export type TradeRow = {
  id: string;
  ticker: string;
  quantity: number;
  buyPrice: number;
  buyAmount: number;
  buyDate: Date;
  sellPrice: number | null;
  sellAmount: number | null;
  sellDate: Date | null;
  commission: number;
  usdIlsRate: number | null;
  stopPrice: number | null;
  setup: string | null;
  notes: string | null;
};

export type ClosedTrade = Omit<TradeRow, "sellPrice" | "sellAmount" | "sellDate"> & {
  sellPrice: number;
  sellAmount: number;
  sellDate: Date;
  grossPnl: number;
  pnlPercent: number;
  netPnl: number;
  holdDays: number;
  rMultiple: number | null;
};

export function isClosed(t: TradeRow): t is TradeRow & {
  sellPrice: number;
  sellAmount: number;
  sellDate: Date;
} {
  return t.sellPrice != null && t.sellDate != null;
}

export function toClosedTrade(t: TradeRow): ClosedTrade | null {
  if (!isClosed(t)) return null;
  const grossPnl = (t.sellPrice - t.buyPrice) * t.quantity;
  const netPnl = grossPnl - t.commission;
  const pnlPercent = (grossPnl / t.buyAmount) * 100;
  const holdDays = Math.max(
    1,
    Math.round((t.sellDate.getTime() - t.buyDate.getTime()) / 86400000)
  );
  const riskPerShare = t.stopPrice != null ? t.buyPrice - t.stopPrice : null;
  const rMultiple =
    riskPerShare != null && riskPerShare !== 0
      ? (t.sellPrice - t.buyPrice) / riskPerShare
      : null;
  return { ...t, grossPnl, pnlPercent, netPnl, holdDays, rMultiple };
}

export type JournalStats = {
  totalTrades: number;
  openPositions: number;
  closedTrades: number;

  winRate: number;
  wins: number;
  losses: number;
  breakeven: number;

  totalNetPnl: number;
  avgWinPct: number;
  avgLossPct: number;
  avgWinUsd: number;
  avgLossUsd: number;
  profitFactor: number | null;
  expectancy: number;

  bestTrade: ClosedTrade | null;
  worstTrade: ClosedTrade | null;

  avgHoldDaysWinners: number;
  avgHoldDaysLosers: number;

  currentStreak: { type: "win" | "loss" | "none"; count: number };
  longestWinStreak: number;
  longestLossStreak: number;

  byTicker: {
    ticker: string;
    trades: number;
    winRate: number;
    netPnl: number;
    avgPct: number;
  }[];

  bySetup: {
    setup: string;
    trades: number;
    winRate: number;
    netPnl: number;
    avgPct: number;
  }[];

  byMonth: {
    month: string;
    trades: number;
    netPnl: number;
    winRate: number;
  }[];

  equityCurve: { date: string; cumulative: number; tradePnl: number; ticker: string }[];

  bestDayOfWeek: { day: string; avgPct: number; trades: number }[];

  riskOfRuin: {
    maxDrawdownUsd: number;
    maxDrawdownPct: number;
    recoveryTrades: number | null;
  };

  totalCommission: number;
  commissionAsPctOfPnl: number | null;

  avgRMultiple: number | null;
  tradesWithStop: number;

  rollingWinRate: { index: number; winRate: number; date: string }[];

  distribution: { bucket: string; count: number }[];

  dailyPnl: { date: string; pnl: number; trades: number }[];
};

const DOW_HEBREW = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function computeStats(rawTrades: TradeRow[]): JournalStats {
  const closed = rawTrades
    .map(toClosedTrade)
    .filter((t): t is ClosedTrade => t !== null)
    .sort((a, b) => a.sellDate.getTime() - b.sellDate.getTime());

  const openPositions = rawTrades.length - closed.length;

  const wins = closed.filter((t) => t.netPnl > 0);
  const losses = closed.filter((t) => t.netPnl < 0);
  const breakeven = closed.filter((t) => t.netPnl === 0);

  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;

  const totalNetPnl = closed.reduce((s, t) => s + t.netPnl, 0);

  const avgWinPct = wins.length
    ? wins.reduce((s, t) => s + t.pnlPercent, 0) / wins.length
    : 0;
  const avgLossPct = losses.length
    ? losses.reduce((s, t) => s + t.pnlPercent, 0) / losses.length
    : 0;
  const avgWinUsd = wins.length
    ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length
    : 0;
  const avgLossUsd = losses.length
    ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length
    : 0;

  const grossWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;

  const expectancy =
    closed.length > 0
      ? (winRate / 100) * avgWinUsd + (1 - winRate / 100) * avgLossUsd
      : 0;

  const bestTrade = closed.length
    ? closed.reduce((a, b) => (b.netPnl > a.netPnl ? b : a))
    : null;
  const worstTrade = closed.length
    ? closed.reduce((a, b) => (b.netPnl < a.netPnl ? b : a))
    : null;

  const avgHoldDaysWinners = wins.length
    ? wins.reduce((s, t) => s + t.holdDays, 0) / wins.length
    : 0;
  const avgHoldDaysLosers = losses.length
    ? losses.reduce((s, t) => s + t.holdDays, 0) / losses.length
    : 0;

  // Streaks
  let currentStreakType: "win" | "loss" | "none" = "none";
  let currentStreakCount = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runningWin = 0;
  let runningLoss = 0;

  for (const t of closed) {
    if (t.netPnl > 0) {
      runningWin += 1;
      runningLoss = 0;
      longestWinStreak = Math.max(longestWinStreak, runningWin);
    } else if (t.netPnl < 0) {
      runningLoss += 1;
      runningWin = 0;
      longestLossStreak = Math.max(longestLossStreak, runningLoss);
    } else {
      runningWin = 0;
      runningLoss = 0;
    }
  }
  if (closed.length > 0) {
    const last = closed[closed.length - 1];
    if (last.netPnl > 0) {
      currentStreakType = "win";
      currentStreakCount = runningWin;
    } else if (last.netPnl < 0) {
      currentStreakType = "loss";
      currentStreakCount = runningLoss;
    }
  }

  // By ticker
  const tickerMap = new Map<string, ClosedTrade[]>();
  for (const t of closed) {
    const arr = tickerMap.get(t.ticker) ?? [];
    arr.push(t);
    tickerMap.set(t.ticker, arr);
  }
  const byTicker = Array.from(tickerMap.entries())
    .map(([ticker, trades]) => {
      const w = trades.filter((t) => t.netPnl > 0).length;
      return {
        ticker,
        trades: trades.length,
        winRate: (w / trades.length) * 100,
        netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
        avgPct: trades.reduce((s, t) => s + t.pnlPercent, 0) / trades.length,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  // By setup
  const setupMap = new Map<string, ClosedTrade[]>();
  for (const t of closed) {
    const key = t.setup || "לא מוגדר";
    const arr = setupMap.get(key) ?? [];
    arr.push(t);
    setupMap.set(key, arr);
  }
  const bySetup = Array.from(setupMap.entries())
    .map(([setup, trades]) => {
      const w = trades.filter((t) => t.netPnl > 0).length;
      return {
        setup,
        trades: trades.length,
        winRate: (w / trades.length) * 100,
        netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
        avgPct: trades.reduce((s, t) => s + t.pnlPercent, 0) / trades.length,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);

  // By month
  const monthMap = new Map<string, ClosedTrade[]>();
  for (const t of closed) {
    const key = `${t.sellDate.getFullYear()}-${String(t.sellDate.getMonth() + 1).padStart(2, "0")}`;
    const arr = monthMap.get(key) ?? [];
    arr.push(t);
    monthMap.set(key, arr);
  }
  const byMonth = Array.from(monthMap.entries())
    .map(([month, trades]) => {
      const w = trades.filter((t) => t.netPnl > 0).length;
      return {
        month,
        trades: trades.length,
        netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
        winRate: (w / trades.length) * 100,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // Equity curve
  let cumulative = 0;
  const equityCurve = closed.map((t) => {
    cumulative += t.netPnl;
    return {
      date: t.sellDate.toISOString().slice(0, 10),
      cumulative,
      tradePnl: t.netPnl,
      ticker: t.ticker,
    };
  });

  // Day of week performance
  const dowMap = new Map<number, ClosedTrade[]>();
  for (const t of closed) {
    const dow = t.buyDate.getDay();
    const arr = dowMap.get(dow) ?? [];
    arr.push(t);
    dowMap.set(dow, arr);
  }
  const bestDayOfWeek = Array.from({ length: 7 }, (_, dow) => {
    const trades = dowMap.get(dow) ?? [];
    return {
      day: DOW_HEBREW[dow],
      avgPct: trades.length
        ? trades.reduce((s, t) => s + t.pnlPercent, 0) / trades.length
        : 0,
      trades: trades.length,
    };
  }).filter((d) => d.trades > 0);

  // Drawdown
  let peak = 0;
  let maxDrawdownUsd = 0;
  let maxDrawdownPct = 0;
  let runningEquity = 0;
  for (const t of closed) {
    runningEquity += t.netPnl;
    if (runningEquity > peak) peak = runningEquity;
    const dd = peak - runningEquity;
    if (dd > maxDrawdownUsd) {
      maxDrawdownUsd = dd;
      maxDrawdownPct = peak !== 0 ? (dd / Math.abs(peak)) * 100 : 0;
    }
  }

  // Commission impact
  const totalCommission = closed.reduce((s, t) => s + t.commission, 0);
  const grossBeforeCommission = closed.reduce((s, t) => s + t.grossPnl, 0);
  const commissionAsPctOfPnl =
    grossBeforeCommission !== 0 ? (totalCommission / Math.abs(grossBeforeCommission)) * 100 : null;

  // R-Multiple
  const withR = closed.filter((t) => t.rMultiple != null);
  const avgRMultiple = withR.length
    ? withR.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / withR.length
    : null;

  // Rolling win rate (trailing 10 trades)
  const WINDOW = 10;
  const rollingWinRate: { index: number; winRate: number; date: string }[] = [];
  for (let i = 0; i < closed.length; i++) {
    const windowStart = Math.max(0, i - WINDOW + 1);
    const windowTrades = closed.slice(windowStart, i + 1);
    const w = windowTrades.filter((t) => t.netPnl > 0).length;
    rollingWinRate.push({
      index: i + 1,
      winRate: (w / windowTrades.length) * 100,
      date: closed[i].sellDate.toISOString().slice(0, 10),
    });
  }

  // Return distribution
  const buckets = [
    { label: "< -15%", min: -Infinity, max: -15 },
    { label: "-15% .. -5%", min: -15, max: -5 },
    { label: "-5% .. 0%", min: -5, max: 0 },
    { label: "0% .. 5%", min: 0, max: 5 },
    { label: "5% .. 15%", min: 5, max: 15 },
    { label: "> 15%", min: 15, max: Infinity },
  ];
  const distribution = buckets.map((b) => ({
    bucket: b.label,
    count: closed.filter((t) => t.pnlPercent >= b.min && t.pnlPercent < b.max).length,
  }));

  // Daily P&L (for calendar heatmap) — grouped by sell date
  const dailyMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of closed) {
    const key = t.sellDate.toISOString().slice(0, 10);
    const entry = dailyMap.get(key) ?? { pnl: 0, trades: 0 };
    entry.pnl += t.netPnl;
    entry.trades += 1;
    dailyMap.set(key, entry);
  }
  const dailyPnl = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, pnl: v.pnl, trades: v.trades }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalTrades: rawTrades.length,
    openPositions,
    closedTrades: closed.length,
    winRate,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    totalNetPnl,
    avgWinPct,
    avgLossPct,
    avgWinUsd,
    avgLossUsd,
    profitFactor,
    expectancy,
    bestTrade,
    worstTrade,
    avgHoldDaysWinners,
    avgHoldDaysLosers,
    currentStreak: { type: currentStreakType, count: currentStreakCount },
    longestWinStreak,
    longestLossStreak,
    byTicker,
    bySetup,
    byMonth,
    equityCurve,
    bestDayOfWeek,
    riskOfRuin: {
      maxDrawdownUsd,
      maxDrawdownPct,
      recoveryTrades: null,
    },
    totalCommission,
    commissionAsPctOfPnl,
    avgRMultiple,
    tradesWithStop: withR.length,
    rollingWinRate,
    distribution,
    dailyPnl,
  };
}
