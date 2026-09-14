/**
 * שעות שוק NYSE - חישוב מקומי בלבד, בלי API חיצוני. שני/חמישי-שישי 9:30-16:00
 * לפי שעון החוף המזרחי בארה"ב (America/New_York), מחושב נכון גם ממכשיר באזור זמן
 * אחר (למשל ישראל) דרך `Intl.DateTimeFormat`.
 *
 * **הערכה בסיסית ל-MVP בלבד** - לא מתחשבת בחגי בורסה (למשל Thanksgiving, יום
 * העצמאות האמריקאי וכו') או בימי מסחר מקוצרים. לדיוק מלא יידרש לוח חגים חיצוני.
 */

const NY_TIME_ZONE = 'America/New_York'
const OPEN_MINUTES_OF_DAY = 9 * 60 + 30 // 09:30
const CLOSE_MINUTES_OF_DAY = 16 * 60 // 16:00
const WEEKDAY_ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface MarketStatus {
  isOpen: boolean
  /** רלוונטי רק כש-isOpen=true: כמה דקות נותרו עד הסגירה היום. */
  minutesUntilClose?: number
  /** רלוונטי רק כש-isOpen=false: יום השבוע (0=ראשון..6=שבת, לפי NY) של הפתיחה הבאה. */
  nextOpenWeekday?: number
  nextOpenHour?: number
  nextOpenMinute?: number
  /**
   * רלוונטי רק כש-isOpen=false: instant אמיתי (UTC) של הפתיחה הבאה - נכון ל-DST,
   * כי מחושב עם offset ה-NY בפועל של אותו יום יעד (לא של `now`). מאפשר לקורא
   * (Home.tsx) לעצב אותו באזור הזמן המקומי של הצופה עם Intl.DateTimeFormat בלי
   * `timeZone` מפורש, בלי להסתמך על מיפוי סימבולי (weekday/hour/minute ב-NY) שלא
   * ניתן להמרה מדויקת לאזור זמן אחר כשה-DST משתנה בתאריכים שונים בין שתי המדינות.
   */
  nextOpenAt?: Date
}

/** ממיר `Date` לחלקי תאריך/שעה בזמן NY, בלי תלות באזור הזמן של המכשיר המריץ. */
function getNyDateParts(date: Date): { year: number; month: number; day: number; weekday: number; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value
  const weekdayPart = get('weekday') ?? 'Sun'
  const year = Number(get('year') ?? '1970')
  const month = Number(get('month') ?? '1')
  const day = Number(get('day') ?? '1')
  const hour = Number(get('hour') ?? '0')
  const minute = Number(get('minute') ?? '0')
  const weekday = WEEKDAY_ORDER.indexOf(weekdayPart)

  return { year, month, day, weekday: weekday === -1 ? 0 : weekday, minutesOfDay: hour * 60 + minute }
}

/**
 * ה-offset (בדקות) של שעון NY מול UTC ברגע `date` - שלילי כי NY מערבית ל-UTC
 * (בד"כ -300 ב-EST, -240 ב-EDT). מחושב על ידי "קריאת" השעון בפועל ב-NY ברגע הזה
 * והשוואה ל-UTC, כדי לתפוס נכון את מעברי שעון קיץ/חורף בלי טבלת תאריכים ידנית.
 */
function getNyOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const asUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return (asUtcMs - date.getTime()) / 60_000
}

/**
 * ממיר שעון-קיר של NY (תאריך יעד + 09:30) ל-instant אמיתי (UTC). `guessFrom` הוא
 * "ניחוש ראשוני" ל-offset (בד"כ `now`) - ואז מתוקן פעם אחת מול ה-offset שבאמת חל
 * ב-instant המחושב, כדי לתפוס נכון מקרה שבו `now` ותאריך היעד נמצאים משני צדדים
 * של מעבר שעון קיץ/חורף (למשל בדיוק בשבוע שבו ארה"ב עוברת ל-DST).
 */
function nyWallTimeToInstant(year: number, month: number, day: number, hour: number, minute: number, guessFrom: Date): Date {
  const nyWallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const guessOffset = getNyOffsetMinutes(guessFrom)
  let instantMs = nyWallAsUtcMs - guessOffset * 60_000

  const refinedOffset = getNyOffsetMinutes(new Date(instantMs))
  if (refinedOffset !== guessOffset) instantMs = nyWallAsUtcMs - refinedOffset * 60_000

  return new Date(instantMs)
}

/**
 * מצב שוק ה-NYSE כרגע. `now` ניתן להזרקה לבדיקות דטרמיניסטיות - אין קריאה ל-`new Date()`
 * בתוך הלוגיקה עצמה, רק כברירת מחדל לפרמטר.
 */
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { year, month, day, weekday, minutesOfDay } = getNyDateParts(now)
  const isWeekday = weekday >= 1 && weekday <= 5
  const isOpen = isWeekday && minutesOfDay >= OPEN_MINUTES_OF_DAY && minutesOfDay < CLOSE_MINUTES_OF_DAY

  if (isOpen) {
    return { isOpen: true, minutesUntilClose: CLOSE_MINUTES_OF_DAY - minutesOfDay }
  }

  const opensLaterToday = isWeekday && minutesOfDay < OPEN_MINUTES_OF_DAY
  let nextOpenWeekday = weekday
  let daysToAdd = 0
  if (!opensLaterToday) {
    do {
      daysToAdd += 1
      nextOpenWeekday = (nextOpenWeekday + 1) % 7
    } while (nextOpenWeekday === 0 || nextOpenWeekday === 6)
  }

  // חשבון תאריך היעד (יום קלנדרי, לא זמן) ב-NY על ידי הוספת ימים לתאריך הקלנדרי -
  // אריתמטיקת UTC "רגילה" בסדר כאן כי מדובר בערכי שנה/חודש/יום בלבד, לא ב-instant.
  const targetCalendarMs = Date.UTC(year, month - 1, day) + daysToAdd * 86_400_000
  const targetDate = new Date(targetCalendarMs)
  const nextOpenAt = nyWallTimeToInstant(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth() + 1,
    targetDate.getUTCDate(),
    9,
    30,
    now,
  )

  return {
    isOpen: false,
    nextOpenWeekday,
    nextOpenHour: 9,
    nextOpenMinute: 30,
    nextOpenAt,
  }
}

/** ממיר דקות (משך, לא שעון) לתצוגת HH:MM - למשל 90 -> "01:30". */
export function formatDurationHHMM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}`
}
