import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

// בדיקת רינדור מלאה (React Testing Library + jsdom) לא קיימת עדיין בפרויקט - בדיקה קלה
// של ה-static method עצמו מספיקה כדי לוודא שחריגת render מתורגמת נכון למצב hasError.
describe('ErrorBoundary.getDerivedStateFromError', () => {
  it('מחזיר { hasError: true } עבור כל שגיאה', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true })
  })
})
