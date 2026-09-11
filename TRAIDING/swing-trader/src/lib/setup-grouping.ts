/**
 * קיבוץ תוצאות סריקה לפי סטאפ, כדי שהודעות Discord (ה-cron של 13:00 וה-01:00)
 * יציגו את הטובות ביותר מכל סטאפ במקום top-N שטוח שיכול להיות מוטה לסטאפ אחד.
 */

import { isSetupId, SETUP_IDS, type SetupId } from "./setups";

export type GroupableMatch = {
  symbol: string;
  /** מגיע כמערך מהסורק החי, או כמחרוזת JSON כשנשמר ב-ScannerResult ב-DB. */
  matchedSetups: SetupId[] | string | null;
  grade?: string | null;
  score?: number | null;
};

function parseMatchedSetups(v: SetupId[] | string | null | undefined): SetupId[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(isSetupId);
    } catch {
      /* ignore */
    }
  }
  return [];
}

const GRADE_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export type SetupGroup<T> = { setupId: SetupId; items: T[] };

/**
 * מקבץ לפי הסטאפ הראשי (matchedSetups[0] — תמיד ממוין לפי confidence יורד
 * במקור, ראה scanner.ts), בוחר top `perSetup` מכל קבוצה לפי grade ואז score,
 * ומחזיר קבוצות בסדר SETUP_IDS. מדלג על סטאפים בלי תוצאות.
 */
export function groupTopBySetup<T extends GroupableMatch>(
  matches: T[],
  perSetup = 2
): SetupGroup<T>[] {
  const groups = new Map<SetupId, T[]>();
  for (const m of matches) {
    const setups = parseMatchedSetups(m.matchedSetups);
    const primary = setups[0];
    if (!primary) continue;
    if (!groups.has(primary)) groups.set(primary, []);
    groups.get(primary)!.push(m);
  }

  const result: SetupGroup<T>[] = [];
  for (const id of SETUP_IDS) {
    const items = groups.get(id);
    if (!items || items.length === 0) continue;
    const sorted = [...items].sort((a, b) => {
      const gr = (GRADE_RANK[b.grade ?? ""] ?? -1) - (GRADE_RANK[a.grade ?? ""] ?? -1);
      if (gr !== 0) return gr;
      return (b.score ?? -Infinity) - (a.score ?? -Infinity);
    });
    result.push({ setupId: id, items: sorted.slice(0, perSetup) });
  }
  return result;
}

/** משטח קיבוץ לרשימה אחת (סדר: הכי טוב מכל סטאפ, סטאפ אחרי סטאפ), עם cap כולל. */
export function flattenGrouped<T>(groups: SetupGroup<T>[], cap = 14): T[] {
  const flat: T[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (flat.length >= cap) return flat;
      flat.push(item);
    }
  }
  return flat;
}
