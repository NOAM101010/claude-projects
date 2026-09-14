/** לוגיקה טהורה לזיהוי הפלטפורמה, מכוסה ב-Vitest בלי תלות ב-DOM אמיתי. */

/** true אם ה-user agent הוא Safari על iOS/iPadOS (לא Chrome-on-iOS וכו', שגם הם WebKit אבל לא תומכים ב-add-to-home-screen prompt משלהם). */
export function isIosSafari(userAgent: string): boolean {
  const isIos = /iphone|ipad|ipod/i.test(userAgent)
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios|opios/i.test(userAgent)
  return isIos && isSafari
}

/** true אם האתר כבר רץ כ-PWA מותקן (standalone), בין דרך display-mode media query ובין navigator.standalone של iOS. */
export function isStandaloneDisplay(matchesStandaloneMedia: boolean, iosNavigatorStandalone: boolean | undefined): boolean {
  return matchesStandaloneMedia || iosNavigatorStandalone === true
}
