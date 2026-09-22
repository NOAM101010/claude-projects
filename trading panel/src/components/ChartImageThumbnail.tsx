import { Camera, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../i18n/LanguageContext'
import { getChartImageUrl } from '../lib/chartImagesApi'
import { useModalEscape } from '../hooks/useModalEscape'
import styles from './ChartImageThumbnail.module.css'

interface ChartImageThumbnailProps {
  /** נתיב הקובץ ב-Storage (trade.chartImageUrl) - ה-bucket פרטי, לכן טוענים signed URL. */
  path: string
  /**
   * 'thumb' (ברירת מחדל): תצוגה מקדימה מלאה בגודל 64x44 - משמש בכרטיסי מובייל.
   * 'icon': כפתור אייקון מצלמה קטן בלבד - משמש בטבלת דסקטופ הצפופה יותר, ליד שם הטיקר.
   * שני המצבים פותחים את אותו lightbox בלחיצה.
   */
  variant?: 'thumb' | 'icon'
}

/**
 * Thumbnail קטן של תמונת גרט שמור לטרייד. לחיצה פותחת תצוגה מוגדלת (lightbox).
 * משמש ב-TradeList וב-Dashboard (הטרייד הטוב/הגרוע ביותר).
 */
export function ChartImageThumbnail({ path, variant = 'thumb' }: ChartImageThumbnailProps) {
  const { t } = useLanguage()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const closeLightbox = () => setExpanded(false)
  const dialogRef = useModalEscape<HTMLDivElement>(expanded, closeLightbox)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    getChartImageUrl(path)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (failed) return null

  const overlay = expanded && url
    ? createPortal(
        <div ref={dialogRef} className={styles.overlay} role="dialog" aria-modal="true" onClick={closeLightbox}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={(e) => {
              e.stopPropagation()
              closeLightbox()
            }}
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
          <img src={url} alt={t('chartImage.altFull')} className={styles.full} />
        </div>,
        document.body,
      )
    : null

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setExpanded(true)}
          disabled={!url}
          aria-label={t('chartImage.viewFull')}
          title={t('chartImage.viewFull')}
        >
          <Camera size={13} />
        </button>

        {overlay}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.thumbButton} det-frame`}
        onClick={() => setExpanded(true)}
        disabled={!url}
        aria-label={t('chartImage.viewFull')}
      >
        {url ? <img src={url} alt={t('chartImage.altThumb')} className={styles.thumb} /> : <span className={styles.placeholder} />}
      </button>

      {overlay}
    </>
  )
}
