// לוגיקה טהורה של בניית טקסט ההתראה - מופרדת מ-index.ts כדי שאפשר לבדוק אותה ב-Vitest
// בלי להריץ Deno.serve (אותו טעם בדיוק כמו market-indices/mapping.ts). המחרוזת הזו
// משמשת גם את גוף ה-push (_shared/push.ts) וגם את שדה ה-message בטבלת notifications -
// מחושבת פעם אחת כדי ששני המנגנונים תמיד יגידו בדיוק אותו דבר.
//
// `language` מגיע מ-accounts.language (021_account_language.sql, נטען ב-index.ts יחד
// עם שאר שורת החשבון) - עד למיגרציה הזו ההודעה הייתה תמיד באנגלית קשיחה, בניגוד לניב
// המכוון של מונחים טכניים שנשארים באנגלית (Kelly Criterion/Stop Loss וכו') - זה משפט
// שלם שאמור להיות מתורגם. הניסוח תואם את `tools.watchlist.historyCrossedAbove/Below`
// ב-src/i18n/translations.ts (אותו "מעל/מתחת" בעברית, "por encima/debajo de" בספרדית,
// "au-dessus/en dessous de" בצרפתית) כדי שהטרמינולוגיה תישאר עקבית עם שאר האפליקציה.
type AlertLanguage = 'en' | 'he' | 'es' | 'fr'

const DIRECTION_LABEL: Record<AlertLanguage, Record<'above' | 'below', string>> = {
  en: { above: 'above', below: 'below' },
  he: { above: 'מעל', below: 'מתחת' },
  es: { above: 'por encima de', below: 'por debajo de' },
  fr: { above: 'au-dessus de', below: 'en dessous de' },
}

const MESSAGE_TEMPLATE: Record<
  AlertLanguage,
  (symbol: string, directionLabel: string, currentPrice: string, targetPrice: string) => string
> = {
  en: (symbol, dir, current, target) => `${symbol} is now $${current} (${dir} your target of $${target})`,
  he: (symbol, dir, current, target) => `${symbol} נמצא כעת ב-$${current} (${dir} היעד שלך של $${target})`,
  es: (symbol, dir, current, target) => `${symbol} está ahora en $${current} (${dir} tu objetivo de $${target})`,
  fr: (symbol, dir, current, target) => `${symbol} est maintenant à $${current} (${dir} votre objectif de $${target})`,
}

/** ברירת מחדל אנגלית ל-language לא-מוכר (למשל שורת חשבון ישנה/פגומה) - לא אמור לקרות
 * בפועל בזכות ה-CHECK constraint ב-DB, אבל שומר על הפונקציה טהורה וללא throw. */
function resolveLanguage(language: string): AlertLanguage {
  return language === 'he' || language === 'es' || language === 'fr' ? language : 'en'
}

export function buildAlertMessage(
  symbol: string,
  direction: 'above' | 'below',
  targetPrice: number,
  currentPrice: number,
  language: string = 'en',
): string {
  const lang = resolveLanguage(language)
  const directionLabel = DIRECTION_LABEL[lang][direction]
  return MESSAGE_TEMPLATE[lang](symbol, directionLabel, currentPrice.toFixed(2), targetPrice.toFixed(2))
}
