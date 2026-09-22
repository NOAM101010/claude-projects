import { ExternalLink } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import type { SectorEtf, SectorQuote } from '../lib/marketData'
import { tradingViewUrl } from '../lib/tradingView'
import styles from './SectorHeatmap.module.css'

interface SectorHeatmapProps {
  sectors: SectorQuote[]
  loading: boolean
}

/** שם תרגום לכל ETF סקטוריאלי - מוצג ב-title (tooltip) של התא, ראה sector.* ב-translations.ts. */
const SECTOR_NAME_KEY: Record<SectorEtf, TranslationKey> = {
  XLK: 'sector.technology',
  XLF: 'sector.financials',
  XLE: 'sector.energy',
  XLV: 'sector.healthcare',
  XLY: 'sector.consumerDiscretionary',
  XLP: 'sector.consumerStaples',
  XLI: 'sector.industrials',
  XLB: 'sector.materials',
  XLU: 'sector.utilities',
  XLRE: 'sector.realEstate',
  XLC: 'sector.communication',
}

/** טווח ניטרלי מצומצם ל-±0.05% (היה ±0.3%) - תנועה קטנה יותר מ-0.05% כבר מקבלת את
 * צבע העוצמה הראשונה (`heat-pos1`/`heat-neg1`); רמות 1%/2% נשארות ללא שינוי. */
export function heatClass(pct: number | null): string {
  if (pct == null) return 'heat-neu'
  if (pct >= 2) return 'heat-pos3'
  if (pct >= 1) return 'heat-pos2'
  if (pct > 0.05) return 'heat-pos1'
  if (pct >= -0.05) return 'heat-neu'
  if (pct >= -1) return 'heat-neg1'
  if (pct >= -2) return 'heat-neg2'
  return 'heat-neg3'
}

/**
 * מפת חום 11 סקטורי SPDR (XLK/XLF/וכו') - מוצגת ב-Home.tsx רק לסגנונות מניות
 * (Day Trading/Swing/Long-term), לא ל-Crypto. הדאטה מגיעה מ-fetchStockIndices (Home.tsx
 * טוען פעם אחת ומזין גם את כרטיסי המדדים וגם כאן, כדי לא לכפול קריאות ל-Edge Function).
 */
export function SectorHeatmap({ sectors, loading }: SectorHeatmapProps) {
  const { t } = useLanguage()
  const sorted = [...sectors].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999))

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('home.sectorHeatmapTitle')}</h3>
        <span className={styles.hint}>{t('home.sectorHeatmapHint')}</span>
      </div>
      <div className={styles.grid}>
        {loading || sorted.length === 0
          ? Array.from({ length: 11 }).map((_, i) => <div key={i} className={`${styles.cell} shimmer`} />)
          : sorted.map((s) => (
              <div key={s.etf} className={`${styles.cell} ${heatClass(s.changePercent)}`} title={t(SECTOR_NAME_KEY[s.etf])}>
                <a href={tradingViewUrl(s.etf)} target="_blank" rel="noopener noreferrer" className={styles.etf}>
                  {s.etf}
                  <ExternalLink size={8} className={styles.externalIcon} />
                </a>
                <span className={`${styles.pct} num`}>
                  {s.changePercent != null ? `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%` : '—'}
                </span>
              </div>
            ))}
      </div>
    </div>
  )
}
