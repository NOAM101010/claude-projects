/**
 * Smart greeting helpers for the home page.
 * Line 1  — time-of-day greeting (Asia/Jerusalem).
 * Line 2  — US market session status (America/New_York), mirrors market-clock.tsx.
 */

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

export function sessionInfo(now: Date): SessionInfo {
  const et = zoned(now, "America/New_York");
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  const isWeekday = day >= 1 && day <= 5;

  if (isWeekday && mins >= OPEN && mins < CLOSE) {
    const left = CLOSE - mins;
    const hh = Math.floor(left / 60);
    const mm = left % 60;
    return {
      state: "open",
      text: `השוק פתוח — ${hh}:${String(mm).padStart(2, "0")} לסגירה`,
      bullish: true,
    };
  }

  if (isWeekday && mins >= PRE_OPEN && mins < OPEN) {
    return {
      state: "pre",
      text: `Pre-Market — פתיחה בעוד ${fmtDur(OPEN - mins)}`,
      bullish: true,
    };
  }

  if (isWeekday && mins >= CLOSE && mins < AFTER_END) {
    return { state: "after", text: "After Hours — השוק נסגר", bullish: false };
  }

  // closed — figure out the next open
  const beforePre = isWeekday && mins < PRE_OPEN;
  const ilOpen = ilTimeForEtMinutes(now, OPEN);

  if (beforePre) {
    return {
      state: "closed",
      text: `השוק נפתח בעוד ${fmtDur(OPEN - mins)}`,
      bullish: false,
    };
  }

  // Find the next US market open and describe it from the Israeli user's
  // point of view — the ET calendar day can lag a day behind the IL one.
  const ilNow = zoned(now, "Asia/Jerusalem");
  const offsetH = Math.round((ilNow.getTime() - et.getTime()) / 3_600_000);
  const ilStartOfDay = new Date(
    ilNow.getFullYear(), ilNow.getMonth(), ilNow.getDate()
  ).getTime();

  let when = "מחר";
  for (let off = 0; off <= 8; off++) {
    const etDay = new Date(et);
    etDay.setDate(etDay.getDate() + off);
    const wd = etDay.getDay();
    if (wd === 0 || wd === 6) continue;
    if (off === 0 && mins >= OPEN) continue; // today's open already passed
    const ilOpenMoment = new Date(etDay);
    ilOpenMoment.setHours(Math.floor(OPEN / 60) + offsetH, OPEN % 60, 0, 0);
    const ilOpenDay = new Date(
      ilOpenMoment.getFullYear(), ilOpenMoment.getMonth(), ilOpenMoment.getDate()
    ).getTime();
    const dayDiff = Math.round((ilOpenDay - ilStartOfDay) / 86_400_000);
    when = dayDiff <= 0 ? "היום" : dayDiff === 1 ? "מחר" : `ביום ${HE_DAYS[ilOpenMoment.getDay()]}`;
    break;
  }

  return {
    state: "closed",
    text: `השוק סגור. נפתח ${when} ב-${ilOpen}`,
    bullish: false,
  };
}
