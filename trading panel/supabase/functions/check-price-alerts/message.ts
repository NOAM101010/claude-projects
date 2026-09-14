// לוגיקה טהורה של בניית טקסט ההתראה - מופרדת מ-index.ts כדי שאפשר לבדוק אותה ב-Vitest
// בלי להריץ Deno.serve (אותו טעם בדיוק כמו market-indices/mapping.ts). המחרוזת הזו
// משמשת גם את גוף ה-push (_shared/push.ts) וגם את שדה ה-message בטבלת notifications -
// מחושבת פעם אחת כדי ששני המנגנונים תמיד יגידו בדיוק אותו דבר.
export function buildAlertMessage(
  symbol: string,
  direction: 'above' | 'below',
  targetPrice: number,
  currentPrice: number,
): string {
  const directionLabel = direction === 'above' ? 'above' : 'below'
  return `${symbol} is now $${currentPrice.toFixed(2)} (${directionLabel} your target of $${targetPrice.toFixed(2)})`
}
