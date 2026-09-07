/**
 * לוח שנה של שוק ה-US (NYSE) — חגים וחצאי-ימים מחושבים לפי חוקים, לא רשימה קשיחה.
 * כל התאריכים נבחנים לפי היום הקלנדרי ב-America/New_York.
 */

const ET = "America/New_York";
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export type MarketHoliday = { name: string; nameHe: string };

// ---------- עזרי תאריך ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** רכיבי היום הקלנדרי (שנה/חודש/יום) של רגע נתון לפי אזור זמן ET. */
function etParts(date: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** שעה+דקה (0-1439) ויום-בשבוע (0=ראשון) של רגע נתון לפי ET. */
function etClock(date: Date): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday")
  );
  return { minutes: hour * 60 + minute, weekday };
}

/** הפרש (ms) בין UTC לאזור זמן ברגע נתון — חיובי ל-ET. */
function tzOffsetMs(date: Date, tz: string): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  return utc.getTime() - local.getTime();
}

/** רגע הפתיחה 09:30 ET של יום קלנדרי נתון, כ-Date אמיתי. */
function etOpenInstant(y: number, m: number, d: number): Date {
  const probe = new Date(Date.UTC(y, m - 1, d, 14, 30, 0));
  const off = tzOffsetMs(probe, ET);
  return new Date(Date.UTC(y, m - 1, d, 9, 30, 0) + off);
}

function utcDow(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** היום-בחודש של המופע ה-n של יום-בשבוע (0=ראשון) בחודש. */
function nthWeekday(y: number, month: number, weekday: number, n: number): number {
  const first = utcDow(y, month, 1);
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** היום-בחודש של המופע האחרון של יום-בשבוע בחודש. */
function lastWeekday(y: number, month: number, weekday: number): number {
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  const lastDow = utcDow(y, month, lastDay);
  return lastDay - ((lastDow - weekday + 7) % 7);
}

/** כלל observed: חג בשבת → יום ו׳ שלפני; חג בראשון → יום ב׳ שאחרי. מחזיר Date ב-UTC חצות. */
function shiftObserved(y: number, month: number, day: number): Date {
  const base = new Date(Date.UTC(y, month - 1, day));
  const dow = base.getUTCDay();
  if (dow === 6) return new Date(base.getTime() - 86_400_000);
  if (dow === 0) return new Date(base.getTime() + 86_400_000);
  return base;
}

/** פסחא גרגוריאני (Computus / Anonymous Gregorian). */
function easter(y: number): { month: number; day: number } {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31);
  const day = ((h + l - 7 * mm + 114) % 31) + 1;
  return { month, day };
}

const keyOf = (dt: Date) =>
  `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

// ---------- חגים ----------

const holidayCache = new Map<number, Map<string, MarketHoliday>>();

function holidaysForYear(y: number): Map<string, MarketHoliday> {
  const cached = holidayCache.get(y);
  if (cached) return cached;

  const map = new Map<string, MarketHoliday>();
  const add = (dt: Date, name: string, nameHe: string) =>
    map.set(keyOf(dt), { name, nameHe });

  add(shiftObserved(y, 1, 1), "New Year's Day", "ראש השנה האזרחי");
  add(
    new Date(Date.UTC(y, 0, nthWeekday(y, 1, 1, 3))),
    "Martin Luther King Jr. Day",
    "יום מרטין לותר קינג"
  );
  add(
    new Date(Date.UTC(y, 1, nthWeekday(y, 2, 1, 3))),
    "Washington's Birthday",
    "יום הנשיאים"
  );
  {
    const es = easter(y);
    const gf = new Date(Date.UTC(y, es.month - 1, es.day) - 2 * 86_400_000);
    add(gf, "Good Friday", "יום שישי הטוב");
  }
  add(
    new Date(Date.UTC(y, 4, lastWeekday(y, 5, 1))),
    "Memorial Day",
    "יום הזיכרון (Memorial Day)"
  );
  if (y >= 2022) {
    add(shiftObserved(y, 6, 19), "Juneteenth", "Juneteenth (יום השחרור)");
  }
  add(shiftObserved(y, 7, 4), "Independence Day", "יום העצמאות (4 ביולי)");
  add(
    new Date(Date.UTC(y, 8, nthWeekday(y, 9, 1, 1))),
    "Labor Day",
    "Labor Day (יום העבודה)"
  );
  add(
    new Date(Date.UTC(y, 10, nthWeekday(y, 11, 4, 4))),
    "Thanksgiving Day",
    "חג ההודיה"
  );
  add(shiftObserved(y, 12, 25), "Christmas Day", "חג המולד");

  holidayCache.set(y, map);
  return map;
}

// ---------- חצאי-ימים ----------

const halfDayCache = new Map<number, Map<string, MarketHoliday>>();

function halfDaysForYear(y: number): Map<string, MarketHoliday> {
  const cached = halfDayCache.get(y);
  if (cached) return cached;

  const map = new Map<string, MarketHoliday>();

  // יום ו׳ שאחרי Thanksgiving
  const thx = nthWeekday(y, 11, 4, 4);
  map.set(keyOf(new Date(Date.UTC(y, 10, thx) + 86_400_000)), {
    name: "Day after Thanksgiving",
    nameHe: "יום שישי שאחרי חג ההודיה",
  });

  // ערב חג המולד — 24/12 אם יום חול
  if (utcDow(y, 12, 24) >= 1 && utcDow(y, 12, 24) <= 5) {
    map.set(`${y}-12-24`, { name: "Christmas Eve", nameHe: "ערב חג המולד" });
  }

  // 3 ביולי אם יום חול (ולפני 4/7 — תמיד)
  if (utcDow(y, 7, 3) >= 1 && utcDow(y, 7, 3) <= 5) {
    map.set(`${y}-07-03`, {
      name: "Day before Independence Day",
      nameHe: "3 ביולי (ערב יום העצמאות)",
    });
  }

  halfDayCache.set(y, map);
  return map;
}

// ---------- API ציבורי ----------

/** אם היום (לפי ET) הוא חג של NYSE — פרטי החג, אחרת null. */
export function getMarketHoliday(date: Date): MarketHoliday | null {
  const { y, m, d } = etParts(date);
  const key = `${y}-${pad(m)}-${pad(d)}`;
  for (const yr of [y - 1, y, y + 1]) {
    const hit = holidaysForYear(yr).get(key);
    if (hit) return hit;
  }
  return null;
}

/** אם היום הוא חצי-יום מסחר (סגירה 13:00 ET) — פרטיו, אחרת null. חג מלא גובר. */
export function isHalfDay(date: Date): MarketHoliday | null {
  if (getMarketHoliday(date)) return null;
  const { y, m, d } = etParts(date);
  return halfDaysForYear(y).get(`${y}-${pad(m)}-${pad(d)}`) ?? null;
}

/** רגע הפתיחה 09:30 ET הבא (מדלג סופ"ש + חגים), כ-Date אמיתי. */
export function nextMarketOpen(from: Date): Date {
  let { y, m, d } = etParts(from);
  for (let i = 0; i < 400; i++) {
    const dow = utcDow(y, m, d);
    if (dow !== 0 && dow !== 6) {
      const midday = new Date(Date.UTC(y, m - 1, d, 16, 0, 0));
      if (!getMarketHoliday(midday)) {
        const open = etOpenInstant(y, m, d);
        if (open.getTime() > from.getTime()) return open;
      }
    }
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }
  throw new Error("nextMarketOpen: no trading day found within 400 days");
}

export type MarketDayStatus = {
  open: boolean;
  reason:
    | "regular"
    | "weekend"
    | "holiday"
    | "halfday-closed"
    | "premarket"
    | "afterhours"
    | "closed-early"
    | "closed";
  holidayName?: string;
};

const PRE_OPEN = 4 * 60;
const OPEN = 9 * 60 + 30;
const REGULAR_CLOSE = 16 * 60;
const HALF_CLOSE = 13 * 60;
const AFTER_END = 20 * 60;

/** מצב יום המסחר הנוכחי לפי ET. */
export function marketDayStatus(now: Date): MarketDayStatus {
  const { minutes, weekday } = etClock(now);

  if (weekday === 0 || weekday === 6) return { open: false, reason: "weekend" };

  const holiday = getMarketHoliday(now);
  if (holiday) {
    return { open: false, reason: "holiday", holidayName: holiday.nameHe };
  }

  const half = isHalfDay(now);
  const close = half ? HALF_CLOSE : REGULAR_CLOSE;

  if (minutes >= OPEN && minutes < close) return { open: true, reason: "regular" };
  if (minutes >= PRE_OPEN && minutes < OPEN)
    return { open: false, reason: "premarket" };
  if (half && minutes >= close && minutes < AFTER_END)
    return { open: false, reason: "halfday-closed" };
  if (minutes >= close && minutes < AFTER_END)
    return { open: false, reason: "afterhours" };
  return { open: false, reason: "closed" };
}

/** תיאור עברי של הפתיחה הבאה, למשל "מחר ב-16:30" (שעון ישראל). */
export function nextOpenTextHe(from: Date = new Date()): string {
  const open = nextMarketOpen(from);
  const il = new Date(open.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const ilNow = new Date(
    from.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
  );
  const diff = Math.round(
    (Date.UTC(il.getFullYear(), il.getMonth(), il.getDate()) -
      Date.UTC(ilNow.getFullYear(), ilNow.getMonth(), ilNow.getDate())) /
      86_400_000
  );
  const when =
    diff <= 0 ? "היום" : diff === 1 ? "מחר" : `ביום ${HE_DAYS[il.getDay()]}`;
  return `${when} ב-${pad(il.getHours())}:${pad(il.getMinutes())}`;
}
