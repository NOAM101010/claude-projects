import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { getChartImageUrl } from '../lib/chartImagesApi'
import styles from './ChartImageThumbnail.module.css'

interface ChartImageThumbnailProps {
  /** נתיב הקובץ ב-Storage (trade.chartImageUrl) - ה-bucket פרטי, לכן טוענים signed URL. */
  path: string
}

/**
 * Thumbnail קטן של תמונת גרט שמור לטרייד. לחיצה פותחת תצוגה מוגדלת (lightbox).
 * משמש ב-TradeList וב-Dashboard (הטרייד הטוב/הגרוע ביותר).
 */
export function ChartImageThumbnail({ path }: ChartImageThumbnailProps) {
  const { t } = useLanguage()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

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

  return (
    <>
      <button
        type="button"
        className={styles.thumbButton}
        onClick={() => setExpanded(true)}
        disabled={!url}
        aria-label={t('chartImage.viewFull')}
      >
        {url ? <img src={url} alt={t('chartImage.altThumb')} className={styles.thumb} /> : <span className={styles.placeholder} />}
      </button>

      {expanded && url && (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setExpanded(false)}>
          <img src={url} alt={t('chartImage.altFull')} className={styles.full} />
        </div>
      )}
    </>
  )
}
