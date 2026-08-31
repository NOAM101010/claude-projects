import type { JournalStats, TradeRow } from "@/lib/trade-stats";
import type { BenchmarkResult } from "@/lib/benchmark";

export type Tip = {
  severity: "critical" | "warning" | "info" | "positive";
  title: string;
  body: string;
};

const MIN_SAMPLE = 5;

export function computeTips(
  rows: TradeRow[],
  stats: JournalStats,
  benchmark: BenchmarkResult
): Tip[] {
  const tips: Tip[] = [];

  if (stats.closedTrades < 5) {
    return tips; // not enough data for meaningful advice yet
  }

  // 1. Profit factor
  if (stats.profitFactor != null && stats.profitFactor < 1) {
    tips.push({
      severity: "critical",
      title: "האסטרטגיה מפסידה כסף נטו",
      body: `Profit Factor של ${stats.profitFactor.toFixed(2)} אומר שעל כל דולר שאתה מרוויח אתה מפסיד ${(1 / stats.profitFactor).toFixed(2)}$. תשקול לצמצם את מספר הטריידים ולהיות בררן יותר — עדיף פחות טריידים באיכות גבוהה.`,
    });
  } else if (stats.profitFactor != null && stats.profitFactor >= 1.5) {
    tips.push({
      severity: "positive",
      title: "Profit Factor חזק",
      body: `${stats.profitFactor.toFixed(2)} — האסטרטגיה שלך רווחית באופן עקבי. המשך עם אותה משמעת.`,
    });
  }

  // 2. Commission drag
  if (stats.commissionAsPctOfPnl != null && Math.abs(stats.commissionAsPctOfPnl) >= 25) {
    tips.push({
      severity: "critical",
      title: "עמלות אוכלות חלק גדול מהרווח",
      body: `${stats.commissionAsPctOfPnl.toFixed(0)}% מהרווח/הפסד הגולמי הולך לעמלות ($${stats.totalCommission.toFixed(2)}). זה סימן שהפוזיציות קטנות מדי ביחס לעמלה הקבועה. שקול להגדיל את גודל הפוזיציה או לצמצם תדירות מסחר.`,
    });
  }

  // 3. Hold time discipline
  if (stats.wins >= MIN_SAMPLE && stats.losses >= MIN_SAMPLE) {
    if (stats.avgHoldDaysLosers > stats.avgHoldDaysWinners * 1.3) {
      tips.push({
        severity: "critical",
        title: "אתה מחזיק הפסדים יותר זמן מרווחים",
        body: `מפסידים מוחזקים בממוצע ${stats.avgHoldDaysLosers.toFixed(0)} ימים, לעומת ${stats.avgHoldDaysWinners.toFixed(0)} ימים למנצחים. זה ההפך ממה שרוצים — קצר הפסדים מהר, תן לרווחים לרוץ. שקול סטופ-לוס נוקשה יותר.`,
      });
    } else if (stats.avgHoldDaysWinners > stats.avgHoldDaysLosers * 1.3) {
      tips.push({
        severity: "positive",
        title: "משמעת טובה בניהול זמן",
        body: `אתה קוצר הפסדים מהר (${stats.avgHoldDaysLosers.toFixed(0)} ימים) ונותן לרווחים לרוץ (${stats.avgHoldDaysWinners.toFixed(0)} ימים). זו התנהגות נכונה — המשך כך.`,
      });
    }
  }

  // 4. Win/Loss size asymmetry
  if (stats.wins >= MIN_SAMPLE && stats.losses >= MIN_SAMPLE) {
    const avgWinAbs = Math.abs(stats.avgWinUsd);
    const avgLossAbs = Math.abs(stats.avgLossUsd);
    if (avgLossAbs > avgWinAbs * 1.5) {
      tips.push({
        severity: "warning",
        title: "ההפסדים גדולים מהרווחים בממוצע",
        body: `הפסד ממוצע ($${avgLossAbs.toFixed(2)}) גדול משמעותית מרווח ממוצע ($${avgWinAbs.toFixed(2)}). גם אם אחוז ההצלחה גבוה, זה שוחק את התיק. שקול סטופ-לוס הדוק יותר או יעדי רווח ריאליים יותר.`,
      });
    }
  }

  // 5. Losing streak
  if (stats.longestLossStreak >= 5) {
    tips.push({
      severity: "warning",
      title: `רצף הפסדים של ${stats.longestLossStreak} טריידים`,
      body: `כדאי לקבוע כלל אישי: אחרי 3 הפסדים ברצף — להקטין גודל פוזיציה ב-50% או לקחת הפסקה של יום-יומיים עד שהתנאים משתפרים.`,
    });
  }

  // 6. Alpha vs SPY
  if (benchmark.totalTrades >= MIN_SAMPLE) {
    if (benchmark.avgAlphaPct < -1) {
      tips.push({
        severity: "critical",
        title: "אתה מפסיד למדד S&P 500",
        body: `אלפא ממוצעת של ${benchmark.avgAlphaPct.toFixed(1)}% אומרת שבממוצע היית מרוויח יותר אם פשוט היית מחזיק SPY במקום לבצע את הטרייד. רק ${benchmark.beatMarketRate.toFixed(0)}% מהטריידים ניצחו את המדד. שקול לסנן רק setups חזקים במיוחד.`,
      });
    } else if (benchmark.avgAlphaPct > 1) {
      tips.push({
        severity: "positive",
        title: "אתה מנצח את המדד",
        body: `אלפא ממוצעת של +${benchmark.avgAlphaPct.toFixed(1)}% — הבחירות שלך טובות יותר מפשוט להחזיק SPY. ${benchmark.beatMarketRate.toFixed(0)}% מהטריידים ניצחו את המדד.`,
      });
    }
  }

  // 7. Best/worst day of week (needs decent sample per day)
  const goodDays = stats.bestDayOfWeek.filter((d) => d.trades >= MIN_SAMPLE && d.avgPct > 0.5);
  const badDays = stats.bestDayOfWeek.filter((d) => d.trades >= MIN_SAMPLE && d.avgPct < -1.5);
  if (badDays.length > 0) {
    tips.push({
      severity: "info",
      title: `כניסות ב${badDays.map((d) => d.day).join(", ")} חלשות`,
      body: `הטריידים שנכנסו ב${badDays.map((d) => d.day).join(" ו-")} הניבו תשואה ממוצעת שלילית (${badDays.map((d) => fmt(d.avgPct)).join(", ")}). זה יכול להיות מקרי, אבל כדאי לעקוב אם זה נמשך.`,
    });
  }
  if (goodDays.length > 0) {
    tips.push({
      severity: "info",
      title: `כניסות ב${goodDays.map((d) => d.day).join(", ")} חזקות`,
      body: `הטריידים שנכנסו ב${goodDays.map((d) => d.day).join(" ו-")} הניבו תשואה ממוצעת חיובית (${goodDays.map((d) => "+" + d.avgPct.toFixed(1) + "%").join(", ")}).`,
    });
  }

  // 8. Setup performance concentration (only meaningful once tagged)
  const taggedSetups = stats.bySetup.filter((s) => s.setup !== "לא מוגדר" && s.trades >= 3);
  if (taggedSetups.length >= 2) {
    const best = taggedSetups.reduce((a, b) => (b.avgPct > a.avgPct ? b : a));
    const worst = taggedSetups.reduce((a, b) => (b.avgPct < a.avgPct ? b : a));
    if (best.avgPct > 0 && worst.avgPct < 0 && best.setup !== worst.setup) {
      tips.push({
        severity: "info",
        title: `"${best.setup}" עובד לך הכי טוב`,
        body: `תשואה ממוצעת של ${fmt(best.avgPct)} מול ${fmt(worst.avgPct)} ב-"${worst.setup}". שקול להקצות יותר הון לסטאפים מסוג ${best.setup} ופחות ל-${worst.setup}.`,
      });
    }
  } else if (stats.bySetup.length === 1 && stats.bySetup[0].setup === "לא מוגדר" && stats.closedTrades >= 10) {
    tips.push({
      severity: "info",
      title: "אין עדיין תיוג סטאפים",
      body: `לחץ על "זהה סטאפים אוטומטית" כדי לגלות איזה סוג setup (ATH / Gap / Cup & Handle) הכי מרוויח לך בפועל.`,
    });
  }

  // 9. Ticker concentration risk
  const totalLoss = Math.abs(stats.byTicker.filter((t) => t.netPnl < 0).reduce((s, t) => s + t.netPnl, 0));
  if (totalLoss > 0) {
    const worstTicker = stats.byTicker.reduce((a, b) => (b.netPnl < a.netPnl ? b : a));
    const share = Math.abs(worstTicker.netPnl) / totalLoss;
    if (share >= 0.3 && worstTicker.netPnl < 0) {
      tips.push({
        severity: "warning",
        title: `${worstTicker.ticker} אחראית ל-${(share * 100).toFixed(0)}% מכל ההפסדים`,
        body: `מניה בודדת גורמת לנזק לא פרופורציונלי לתיק ($${Math.abs(worstTicker.netPnl).toFixed(2)}). בדוק אם היה שם משהו ספציפי שהשתבש (חדשות, gap נגדך) לפני שממשיכים לסחור בה.`,
      });
    }
  }

  // 10. Fat left tail
  const bigLossBucket = stats.distribution.find((d) => d.bucket === "< -15%");
  if (bigLossBucket && stats.closedTrades > 0 && bigLossBucket.count / stats.closedTrades >= 0.1) {
    tips.push({
      severity: "warning",
      title: "יש לך יותר מדי הפסדים גדולים (מעל 15%)",
      body: `${bigLossBucket.count} מתוך ${stats.closedTrades} טריידים (${((bigLossBucket.count / stats.closedTrades) * 100).toFixed(0)}%) הפסידו מעל 15%. סימן שהסטופ-לוס לא נאכף בזמן, או שהוא רחוק מדי מנקודת הכניסה.`,
    });
  }

  // 11. R-multiple
  if (stats.tradesWithStop >= MIN_SAMPLE && stats.avgRMultiple != null) {
    if (stats.avgRMultiple < 0) {
      tips.push({
        severity: "warning",
        title: "R-Multiple ממוצע שלילי",
        body: `${stats.avgRMultiple.toFixed(2)}R בממוצע — אתה מפסיד יותר ביחס לסיכון שהגדרת מאשר אתה מרוויח. בדוק אם אתה יוצא מהעסקה לפני שהיא מגיעה ליעד, או נכנס עם יחס סיכוי/סיכון גרוע מראש.`,
      });
    } else if (stats.avgRMultiple >= 1) {
      tips.push({
        severity: "positive",
        title: "R-Multiple ממוצע מצוין",
        body: `+${stats.avgRMultiple.toFixed(2)}R בממוצע — אתה מרוויח יותר ממה שאתה מסכן. זה הבסיס לאסטרטגיה רווחית לטווח ארוך.`,
      });
    }
  } else if (stats.tradesWithStop === 0 && stats.closedTrades >= 10) {
    tips.push({
      severity: "info",
      title: "אין נתוני סטופ-לוס",
      body: `לא הזנת מחיר סטופ באף טרייד. הוספת שדה "מחיר סטופ" תאפשר לך לראות R-Multiple — מדד חשוב יותר מ-% רגיל כי הוא מנרמל לפי הסיכון שלקחת.`,
    });
  }

  // 12. Rolling trend
  if (stats.rollingWinRate.length >= 20) {
    const firstHalf = stats.rollingWinRate.slice(0, Math.floor(stats.rollingWinRate.length / 2));
    const secondHalf = stats.rollingWinRate.slice(Math.floor(stats.rollingWinRate.length / 2));
    const firstAvg = firstHalf.reduce((s, p) => s + p.winRate, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, p) => s + p.winRate, 0) / secondHalf.length;
    if (secondAvg - firstAvg >= 10) {
      tips.push({
        severity: "positive",
        title: "אתה משתפר עם הזמן",
        body: `Win Rate עלה מ-${firstAvg.toFixed(0)}% בתחילת התקופה ל-${secondAvg.toFixed(0)}% לאחרונה. מה שהשתנה — תמשיך בזה.`,
      });
    } else if (firstAvg - secondAvg >= 10) {
      tips.push({
        severity: "warning",
        title: "ירידה ב-Win Rate לאחרונה",
        body: `Win Rate ירד מ-${firstAvg.toFixed(0)}% ל-${secondAvg.toFixed(0)}% בטריידים האחרונים. כדאי לבדוק אם משהו השתנה בתנאי השוק או במשמעת הכניסה.`,
      });
    }
  }

  // 13. Stale open positions
  const now = Date.now();
  const staleOpen = rows.filter(
    (t) => t.sellPrice == null && now - t.buyDate.getTime() > 30 * 86400000
  );
  if (staleOpen.length > 0) {
    tips.push({
      severity: "info",
      title: `${staleOpen.length} פוזיציות פתוחות מעל חודש`,
      body: `${staleOpen.map((t) => t.ticker).join(", ")} — כדאי לעדכן סטטוס (נמכר? עדיין מוחזק בכוונה?) כדי שהסטטיסטיקה תישאר מדויקת.`,
    });
  }

  // 14. Max drawdown
  if (stats.riskOfRuin.maxDrawdownUsd > 0 && stats.totalNetPnl !== 0) {
    const ddVsTotal = stats.riskOfRuin.maxDrawdownUsd / Math.max(Math.abs(stats.totalNetPnl), 1);
    if (ddVsTotal >= 1.5) {
      tips.push({
        severity: "warning",
        title: "Drawdown גדול ביחס לרווח הכולל",
        body: `הירידה המקסימלית מהשיא ($${stats.riskOfRuin.maxDrawdownUsd.toFixed(2)}) גדולה משמעותית מהתוצאה הסופית. זה מעיד על תנודתיות גבוהה בתיק — שקול גודל פוזיציה קטן יותר.`,
      });
    }
  }

  const order = { critical: 0, warning: 1, info: 2, positive: 3 };
  return tips.sort((a, b) => order[a.severity] - order[b.severity]);
}

function fmt(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
