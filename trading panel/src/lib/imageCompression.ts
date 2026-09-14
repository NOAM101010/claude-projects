/**
 * דחיסת תמונת גרף בצד הלקוח לפני העלאה ל-Storage (trading-journal-plan.md, "תמונת גרף (upload)").
 * מטרה: לצמצם את גודל הקובץ/עלות האחסון - מקטינים את הצד הארוך למקסימום סביר ומייצאים כ-JPEG.
 */

/** הצד הארוך המקסימלי (פיקסלים) שאליו מקטינים לפני העלאה. */
export const MAX_CHART_IMAGE_DIMENSION = 1600

/** איכות דחיסת JPEG (0-1). */
export const CHART_IMAGE_JPEG_QUALITY = 0.8

/**
 * מחשב את מידות היעד לדחיסה: מקטין כך שהצד הארוך לא יעבור `maxDimension`, שומר על
 * יחס הגובה-רוחב המקורי. תמונות שכבר קטנות מהמקסימום לא מוגדלות. פונקציה טהורה,
 * לא תלויה ב-DOM/Canvas - מכוסה ישירות ב-Vitest.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_CHART_IMAGE_DIMENSION,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width, height }
  const longSide = Math.max(width, height)
  if (longSide <= maxDimension) return { width, height }
  const scale = maxDimension / longSide
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * טוען את הקובץ לתוך `HTMLImageElement` דרך object URL. תלוי DOM - לא מכוסה ב-Vitest
 * (jsdom לא מיישם פענוח תמונות אמיתי); ראה `computeResizedDimensions` לחלק הטהור.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('טעינת קובץ התמונה נכשלה'))
    }
    img.src = url
  })
}

/**
 * דוחס File תמונה: מצייר על Canvas בגודל מוקטן (לפי `computeResizedDimensions`) ומייצא
 * כ-JPEG דחוס. תלוי DOM אמיתי (Image/Canvas) - לא מכוסה ב-Vitest, נבדק ידנית בדפדפן.
 */
export async function compressImage(
  file: File,
  options?: { maxDimension?: number; quality?: number },
): Promise<Blob> {
  const maxDimension = options?.maxDimension ?? MAX_CHART_IMAGE_DIMENSION
  const quality = options?.quality ?? CHART_IMAGE_JPEG_QUALITY

  const img = await loadImage(file)
  const { width, height } = computeResizedDimensions(img.naturalWidth, img.naturalHeight, maxDimension)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image compression failed: this browser does not support canvas')
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('דחיסת תמונה נכשלה'))),
      'image/jpeg',
      quality,
    )
  })
}
