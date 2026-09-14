import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { ensureSession, redeemCode } from '../lib/session'
import type { Session } from '../lib/session'

export interface RedeemResult {
  session: Session
  tier: string
  /** true אם הקוד הזה כבר היה משויך לחשבון אחר - המשתמש עבר לדאטה של חשבון שונה,
   * לא לזה שהיה לו רגע קודם. חייב תמיד להיות מוצג בבירור, לא שקט (ר' session.ts). */
  switchedAccount: boolean
}

/**
 * לוגיקת מימוש קוד גישה משותפת ל-`AccessCodeGate` (השער החובה לפני האפליקציה) ול-
 * `AccessCodeModal` (שדרוג Basic/Pro אחרי השער). `ensureSession` אידמפוטנטי - קורא
 * ל-`demo-start` רק אם עוד אין session מקומי, כך שהשער יכול להיות המקום הראשון
 * שנוצר בו חשבון, בלי שינוי לוגיקת ה-backend.
 */
export function useRedeemCode() {
  const { t } = useLanguage()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async (onSuccess: (result: RedeemResult) => void | Promise<void>) => {
    if (!code.trim()) {
      setError(t('accessCode.required'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await ensureSession()
      const result = await redeemCode(code.trim())
      setSuccess(true)
      await onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('accessCode.invalidCode'))
    } finally {
      setSubmitting(false)
    }
  }

  return { code, setCode, submitting, error, success, submit }
}
