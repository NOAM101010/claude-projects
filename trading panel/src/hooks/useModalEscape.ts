import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Hook משותף לכל דיאלוג/מודל/דרופדאון באפליקציה (audit Stage 1 מצא: אף אחד לא נסגר
 * ב-Escape, ואין focus trap/focus-on-open - החמור מכל: ה-lightbox של תמונת גרף לא
 * ניתן לסגירה בכלל למשתמש מקלדת-בלבד). ה-caller מצמיד את ה-ref שמוחזר לאלמנט
 * ה-container של הדיאלוג (ה-div/form עם role="dialog", או פאנל הדרופדאון).
 *
 * בפתיחה (isOpen עובר ל-true): שומר את האלמנט שהיה ממוקד קודם, וממקד את האלמנט
 * הראשון הניתן-למיקוד בתוך ה-container (או את ה-container עצמו עם tabIndex=-1
 * אם אין כזה - למשל lightbox עם img בלבד, בלי כפתור). Escape קורא ל-onClose.
 * בסגירה/unmount: מסיר את ה-listener ומחזיר focus לאלמנט שהיה ממוקד לפני הפתיחה.
 *
 * `onClose` נשמר ב-ref פנימי כדי שהאפקט הראשי ירוץ רק כש-`isOpen` משתנה, לא בכל
 * render - אחרת קלט מקלדת בתוך מודל (למשל AccessCodeModal) שגורם ל-re-render עם
 * `onClose` חדש היה ממקד מחדש את השדה בכל הקשה ומפריע לסמן/לכתיבה.
 */
export function useModalEscape<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const container = containerRef.current
    if (container) {
      const focusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable) {
        focusable.focus()
      } else {
        if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
        container.focus()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const previous = previouslyFocusedRef.current
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [isOpen])

  return containerRef
}
