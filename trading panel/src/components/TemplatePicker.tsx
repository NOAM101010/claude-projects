import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { setWorkspaceTemplate } from '../lib/workspacesApi'
import type { WorkspaceTemplate } from '../lib/workspacesApi'
import styles from './TemplatePicker.module.css'

const TEMPLATE_META: Record<WorkspaceTemplate, { nameKey: TranslationKey; descKey: TranslationKey }> = {
  day: { nameKey: 'templatePicker.day.name', descKey: 'templatePicker.day.desc' },
  swing: { nameKey: 'templatePicker.swing.name', descKey: 'templatePicker.swing.desc' },
  longterm: { nameKey: 'templatePicker.longterm.name', descKey: 'templatePicker.longterm.desc' },
  crypto: { nameKey: 'templatePicker.crypto.name', descKey: 'templatePicker.crypto.desc' },
}

const TEMPLATES: WorkspaceTemplate[] = ['day', 'swing', 'longterm', 'crypto']

interface TemplatePickerProps {
  workspaceId: string
  /** נקרא רק אחרי שהתבנית נשמרה בהצלחה ב-DB (כולל fieldSettings התואמים - ראה setWorkspaceTemplate). */
  onSelected: (template: WorkspaceTemplate) => void
}

/**
 * כרטיס לכל אחת מ-4 תבניות סגנון המסחר, עם תיאור קצר וכפתור בחירה. קוראת ל-`setWorkspaceTemplate`
 * בעצמה בלחיצה (לא רק מודיעה להורה) - ראה robust-munching-puffin.md סבב A. משותפת לכל נקודות
 * הכניסה העתידיות (Tools' "בחר סגנון", ואולי WorkspaceSettings בסבב B) - לא תלויה בהיכן מוצגת.
 */
export function TemplatePicker({ workspaceId, onSelected }: TemplatePickerProps) {
  const { t } = useLanguage()
  const [selecting, setSelecting] = useState<WorkspaceTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (template: WorkspaceTemplate) => {
    setSelecting(template)
    setError(null)
    try {
      await setWorkspaceTemplate(workspaceId, template)
      onSelected(template)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templatePicker.selectFailed'))
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.cardGrid}>
        {TEMPLATES.map((template) => {
          const meta = TEMPLATE_META[template]
          return (
            <div key={template} className={`${styles.card} glass`}>
              <h4 className={styles.cardTitle}>{t(meta.nameKey)}</h4>
              <p className={styles.cardDesc}>{t(meta.descKey)}</p>
              <button
                type="button"
                className={`${styles.selectButton} btn-metal`}
                disabled={selecting !== null}
                onClick={() => handleSelect(template)}
              >
                {selecting === template ? t('templatePicker.selecting') : t('templatePicker.selectButton')}
              </button>
            </div>
          )
        })}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
