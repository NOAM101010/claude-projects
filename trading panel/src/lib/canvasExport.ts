/**
 * עזרי שיתוף/הורדה גנריים לקנבסים מיוצאים (Trade of the Month, Monthly Calendar).
 * לא תלות חדשה - Canvas API + Web Share API (עם fallback) בלבד, כמו שסוכם.
 */

/** קורא ערך משתנה CSS מה-root החי (לא הארדקוד כפול לצבעי העיצוב בתוך ה-canvas). */
export function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * ממיר canvas ל-PNG ומשתף/מוריד אותו. מנסה קודם `navigator.share` עם קובץ (אם נתמך
 * בדפדפן/במכשיר) - אם המשתמש ביטל את גיליון השיתוף (`AbortError`) לא נופל בחזרה
 * להורדה (זו הייתה בחירה מכוונת שלו). אם השיתוף לא נתמך בכלל - מוריד PNG ישירות.
 */
export async function shareOrDownloadCanvas(canvas: HTMLCanvasElement, filename: string, shareTitle: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return

  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: shareTitle })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // שגיאה אחרת (למשל דפדפן שמדווח תמיכה אך נכשל בפועל) - ממשיכים להורדה כ-fallback.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
