import { useLanguage } from '../i18n/LanguageContext'
import styles from './UndoToast.module.css'

export interface UndoToastItem {
  id: string
  symbol: string
}

interface UndoToastProps {
  items: UndoToastItem[]
  onUndo: (id: string) => void
}

/**
 * באנר "בוטל?" צף בתחתית המסך - כרגע משמש רק למחיקת טרייד (`App.tsx`'s `handleDelete`),
 * שנדחית בפועל עד שחלון הביטול (`UNDO_WINDOW_MS`) פג. כל פריט עצמאי - כמה מחיקות
 * ברצף מקבלות כל אחת חלון משלה, לא דורסות זו את זו.
 */
export function UndoToast({ items, onUndo }: UndoToastProps) {
  const { t } = useLanguage()
  if (items.length === 0) return null

  return (
    <div className={styles.stack}>
      {items.map((item) => (
        <div key={item.id} className={`${styles.toast} glass-blur count-in`}>
          <span className={styles.message}>{t('tradeList.deleteUndoMessage', { symbol: item.symbol })}</span>
          <button type="button" className={styles.undoButton} onClick={() => onUndo(item.id)}>
            {t('tradeList.undoButton')}
          </button>
        </div>
      ))}
    </div>
  )
}
