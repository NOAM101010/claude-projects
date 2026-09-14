/**
 * קישור לעמוד הסימבול הכללי ב-TradingView (בלי prefix של בורסה - עובד לרוב הטיקרים/ETF
 * האמריקאיים המוכרים המוצגים באפליקציה). משמש בכל תצוגת טיקר טקסטואלית שאינה שדה טופס
 * לעריכה - ראה Home.tsx/SectorHeatmap.tsx/Tools.tsx/TradeList.tsx.
 */
export function tradingViewUrl(symbol: string): string {
  return `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.toUpperCase())}/`
}
