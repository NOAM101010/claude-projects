import { yf } from "@/lib/yf";

export type MarketRegime = {
  score: number; // -100 .. +100
  label: string;
  tone: "up" | "down" | "neutral";
  spy: number | null;
  ma50: number | null;
  ma200: number | null;
  ma50Slope: number | null; // % change of MA50 over last 10 sessions
  vix: number | null;
  notes: string[];
};

function sma(values: number[], period: number, offsetFromEnd = 0): number | null {
  const end = values.length - offsetFromEnd;
  const start = end - period;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i < end; i++) sum += values[i];
  return sum / period;
}

const clamp = (n: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, n));

export async function computeMarketRegime(): Promise<MarketRegime> {
  let closes: number[] = [];
  let vix: number | null = null;

  try {
    const chart = await yf.chart("SPY", {
      period1: new Date(Date.now() - 320 * 86400000).toISOString().split("T")[0],
      interval: "1d",
    });
    closes = ((chart as any).quotes ?? [])
      .map((q: any) => q.close as number)
      .filter((v: number) => Number.isFinite(v));
  } catch {
    /* leave empty */
  }

  try {
    const q: any = await yf.quote("^VIX");
    vix = (q?.regularMarketPrice as number) ?? null;
  } catch {
    /* ignore */
  }

  const spy = closes.length ? closes[closes.length - 1] : null;
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const ma50Prev = sma(closes, 50, 10);
  const ma50Slope =
    ma50 != null && ma50Prev != null && ma50Prev !== 0
      ? ((ma50 - ma50Prev) / ma50Prev) * 100
      : null;

  const notes: string[] = [];
  let score = 0;

  if (spy != null && ma50 != null) {
    const above = spy > ma50;
    score += above ? 22 : -22;
    notes.push(
      above
        ? `S&P 500 מעל ממוצע 50 (${ma50.toFixed(0)}) — מגמה קצרת-טווח חיובית`
        : `S&P 500 מתחת לממוצע 50 (${ma50.toFixed(0)}) — לחץ קצר-טווח`
    );
  }
  if (spy != null && ma200 != null) {
    const above = spy > ma200;
    score += above ? 28 : -28;
    notes.push(
      above
        ? `מעל ממוצע 200 (${ma200.toFixed(0)}) — שוק שורי מבני`
        : `מתחת לממוצע 200 (${ma200.toFixed(0)}) — שוק דובי מבני`
    );
  }
  if (ma50Slope != null) {
    const s = clamp(ma50Slope * 12, -25, 25);
    score += s;
    notes.push(
      `שיפוע ממוצע 50: ${ma50Slope >= 0 ? "+" : ""}${ma50Slope.toFixed(2)}% ב-10 מסחרים`
    );
  }
  if (vix != null) {
    let v: number;
    if (vix < 14) v = 25;
    else if (vix < 18) v = 12;
    else if (vix < 22) v = 0;
    else if (vix < 28) v = -18;
    else if (vix < 35) v = -30;
    else v = -42;
    score += v;
    notes.push(
      `VIX ${vix.toFixed(1)} — ${
        vix < 18 ? "תנודתיות נמוכה" : vix < 25 ? "תנודתיות בינונית" : "תנודתיות גבוהה / פחד"
      }`
    );
  }

  score = clamp(Math.round(score));

  let label: string;
  let tone: MarketRegime["tone"];
  if (score >= 55) {
    label = "Risk-On חזק";
    tone = "up";
  } else if (score >= 20) {
    label = "Risk-On";
    tone = "up";
  } else if (score > -20) {
    label = "ניטרלי / זהירות";
    tone = "neutral";
  } else if (score > -55) {
    label = "Risk-Off";
    tone = "down";
  } else {
    label = "Risk-Off חזק";
    tone = "down";
  }

  if (!closes.length) {
    notes.push("לא הצלחתי למשוך נתוני SPY — הציון חלקי");
  }

  return { score, label, tone, spy, ma50, ma200, ma50Slope, vix, notes };
}
