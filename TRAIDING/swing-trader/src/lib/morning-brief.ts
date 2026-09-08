/**
 * Rule-based spoken morning brief (Hebrew). No AI — deterministic text
 * assembled from account + market state, meant to be read aloud by
 * SpeechSynthesis with lang "he-IL".
 */

import { timeGreeting } from "./greeting";
import type { MarketRegime } from "./market-regime";

export type MorningBriefData = {
  now: Date;
  regime: MarketRegime | null;
  openPositions: number;
  nearStop: { ticker: string } | null;
  openPnl: number | null;
  scanCount: number | null;
};

/* feminine counts (פוזיציות, מניות) */
const FEM = [
  "אפס", "אחת", "שתיים", "שלוש", "ארבע", "חמש",
  "שש", "שבע", "שמונה", "תשע", "עשר",
];
function femCount(n: number): string {
  return n >= 0 && n <= 10 ? FEM[n] : String(n);
}

/* masculine number-to-words for money (דולר) */
const M_ONES = [
  "", "אחד", "שניים", "שלושה", "ארבעה", "חמישה",
  "שישה", "שבעה", "שמונה", "תשעה",
];
const M_TEENS = [
  "עשרה", "אחד עשר", "שנים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר",
  "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר",
];
const TENS = [
  "", "עשר", "עשרים", "שלושים", "ארבעים", "חמישים",
  "שישים", "שבעים", "שמונים", "תשעים",
];
const HUNDREDS = [
  "", "מאה", "מאתיים", "שלוש מאות", "ארבע מאות", "חמש מאות",
  "שש מאות", "שבע מאות", "שמונה מאות", "תשע מאות",
];

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r < 10 && r > 0) parts.push(M_ONES[r]);
  else if (r >= 10 && r < 20) parts.push(M_TEENS[r - 10]);
  else if (r >= 20) {
    const t = Math.floor(r / 10);
    const u = r % 10;
    parts.push(u ? `${TENS[t]} ו${M_ONES[u]}` : TENS[t]);
  }
  if (parts.length === 2) return `${parts[0]} ו${parts[1]}`;
  return parts.join(" ");
}

function moneyWords(n: number): string {
  if (n === 0) return "אפס";
  if (n >= 1_000_000) return String(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const chunks: string[] = [];
  if (thousands === 1) chunks.push("אלף");
  else if (thousands === 2) chunks.push("אלפיים");
  else if (thousands > 2) chunks.push(`${under1000(thousands)} אלף`);
  if (rest) chunks.push(under1000(rest));
  return chunks.join(" ");
}

function moneyPhrase(n: number): string {
  const rounded = Math.round(Math.abs(n));
  return `${n >= 0 ? "פלוס" : "מינוס"} ${moneyWords(rounded)} דולר`;
}

function marketSentence(regime: MarketRegime): string {
  const s = regime.score;
  if (s >= 55) return "השוק במגמת עליה חזקה.";
  if (s >= 20) return "השוק במגמת עליה קלה.";
  if (s > -20) return "השוק ניטרלי, כדאי להיזהר.";
  if (s > -55) return "השוק במגמת ירידה.";
  return "השוק במגמת ירידה חזקה.";
}

export function buildSpokenBrief(data: MorningBriefData): string {
  const parts: string[] = [];

  parts.push(`${timeGreeting(data.now)}.`);

  if (data.regime) parts.push(marketSentence(data.regime));

  if (data.openPositions === 0) {
    parts.push("אין לך פוזיציות פתוחות כרגע.");
  } else {
    let s =
      data.openPositions === 1
        ? "יש לך פוזיציה פתוחה אחת"
        : `יש לך ${femCount(data.openPositions)} פוזיציות פתוחות`;
    if (data.nearStop) s += `, אחת — ${data.nearStop.ticker} — קרובה לסטופ`;
    parts.push(`${s}.`);

    if (data.openPnl != null) {
      const label =
        data.openPnl >= 0 ? "הרווח הלא-ממומש" : "ההפסד הלא-ממומש";
      parts.push(`${label} שלך ${moneyPhrase(data.openPnl)}.`);
    }
  }

  if (data.scanCount != null) {
    if (data.scanCount === 0) {
      parts.push("הסורק לא תפס מניות בסריקה האחרונה.");
    } else if (data.scanCount === 1) {
      parts.push("הסורק תפס מניה אחת בסריקה האחרונה.");
    } else {
      parts.push(
        `הסורק תפס ${femCount(data.scanCount)} מניות בסריקה האחרונה.`
      );
    }
  }

  return parts.join(" ");
}
