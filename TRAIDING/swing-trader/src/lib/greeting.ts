/**
 * Smart greeting helpers for the home page.
 * Line 1  — time-of-day greeting (Asia/Jerusalem).
 * Line 2  — US market session status (America/New_York), mirrors market-clock.tsx.
 */

import { getMarketHoliday, isHalfDay, nextMarketOpen } from "./market-calendar";

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** Wall-clock fields of `now` in a given IANA timezone. */
function zoned(now: Date, timeZone: string) {
  return new Date(now.toLocaleString("en-US", { timeZone }));
}

export function timeGreeting(now: Date): string {
  const h = zoned(now, "Asia/Jerusalem").getHours();
  if (h >= 5 && h <= 11) return "בוקר טוב";
  if (h >= 12 && h <= 16) return "צהריים טובים";
  if (h >= 17 && h <= 21) return "ערב טוב";
  return "לילה טוב";
}

function fmtDur(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh > 0) return `${hh}ש' ${String(mm).padStart(2, "0")}ד'`;
  return `${mm}ד'`;
}

/** IL clock-time (HH:MM) that corresponds to a given ET minutes-of-day, today. */
function ilTimeForEtMinutes(now: Date, etMinutes: number): string {
  const et = zoned(now, "America/New_York");
  const il = zoned(now, "Asia/Jerusalem");
  const offsetH = Math.round((il.getTime() - et.getTime()) / 3_600_000);
  let t = etMinutes + offsetH * 60;
  t = ((t % 1440) + 1440) % 1440;
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type SessionInfo = {
  state: "pre" | "open" | "after" | "closed";
  text: string;
  /** true = lean green, false = lean red/neutral */
  bullish: boolean;
};

const PRE_OPEN = 4 * 60;
const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const AFTER_END = 20 * 60;

/** HH:MM בשעון ישראל של רגע נתון. */
function ilHm(target: Date): string {
  const il = zoned(target, "Asia/Jerusalem");
  return `${String(il.getHours()).padStart(2, "0")}:${String(il.getMinutes()).padStart(2, "0")}`;
}

/** "היום" / "מחר" / "ביום X" — יחסית להיום בשעון ישראל. */
function ilWhenLabel(now: Date, target: Date): string {
  const a = zoned(now, "Asia/Jerusalem");
  const b = zoned(target, "Asia/Jerusalem");
  const diff = Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000
  );
  return diff <= 0 ? "היום" : diff === 1 ? "מחר" : `ביום ${HE_DAYS[b.getDay()]}`;
}

export function sessionInfo(now: Date): SessionInfo {
  const et = zoned(now, "America/New_York");
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  const isWeekday = day >= 1 && day <= 5;

  // חג של NYSE — השוק סגור, מחשבים את הפתיחה הבאה (מדלג חגים)
  const holiday = getMarketHoliday(now);
  if (holiday) {
    const open = nextMarketOpen(now);
    return {
      state: "closed",
      text: `השוק סגור — ${holiday.nameHe}. נפתח ${ilWhenLabel(now, open)} ב-${ilHm(open)}`,
      bullish: false,
    };
  }

  // חצי-יום מסחר: סגירה 13:00 ET במקום 16:00
  const half = isHalfDay(now);
  const closeM = half ? 13 * 60 : CLOSE;
  const earlyNote = half
    ? ` · סגירה מוקדמת היום ${ilTimeForEtMinutes(now, 13 * 60)}`
    : "";

  if (isWeekday && mins >= OPEN && mins < closeM) {
    const left = closeM - mins;
    const hh = Math.floor(left / 60);
    const mm = left % 60;
    return {
      state: "open",
      text: `השוק פתוח — ${hh}:${String(mm).padStart(2, "0")} לסגירה${earlyNote}`,
      bullish: true,
    };
  }

  if (isWeekday && mins >= PRE_OPEN && mins < OPEN) {
    return {
      state: "pre",
      text: `Pre-Market — פתיחה בעוד ${fmtDur(OPEN - mins)}${earlyNote}`,
      bullish: true,
    };
  }

  if (isWeekday && mins >= closeM && mins < AFTER_END) {
    return { state: "after", text: "After Hours — השוק נסגר", bullish: false };
  }

  // closed — figure out the next open
  const beforePre = isWeekday && mins < PRE_OPEN && !half;

  if (beforePre) {
    return {
      state: "closed",
      text: `השוק נפתח בעוד ${fmtDur(OPEN - mins)}`,
      bullish: false,
    };
  }

  // הפתיחה הבאה — מדלגת סופ"ש וחגים כאחד
  const open = nextMarketOpen(now);
  return {
    state: "closed",
    text: `השוק סגור. נפתח ${ilWhenLabel(now, open)} ב-${ilHm(open)}`,
    bullish: false,
  };
}
