import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import type { SectorEtf, SectorQuote } from '../lib/marketData'
import { tradingViewUrl } from '../lib/tradingView'
import styles from './SectorHeatmap.module.css'

/** כמה סקטורים בקצה העליון/תחתון נחשבים "מוביל/מפגר היום" בדירוג היחסי (מתוך 11) -
 * ראה sector-heatmap-hover-directions.html כיוון 3. */
const RANK_EDGE_COUNT = 3

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
/** דירוג יחסי של סקטור בתוך המערך הממוין (Top-3 = מוביל, Bottom-3 = מפגר, השאר אמצע) -
 * מחושב חי מתוך אותו `sorted` שכבר בונה את הגריד, לא דאטה חדשה. */
function rankOf(index: number, total: number): 'lead' | 'lag' | 'mid' {
  if (index < RANK_EDGE_COUNT) return 'lead'
  if (index >= total - RANK_EDGE_COUNT) return 'lag'
  return 'mid'
}

export function SectorHeatmap({ sectors, loading }: SectorHeatmapProps) {
  const { t } = useLanguage()
  const sorted = [...sectors].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999))
  // הסקטור הפעיל כרגע (hover/focus) - נשאר "תקוע" על האחרון עד hover/focus הבא, בדיוק
  // כמו פאנל-הפרטים הקבוע ב-sector-heatmap-hover-directions.html כיוון 3 (לא ננקה ב-mouseleave).
  const [activeEtf, setActiveEtf] = useState<SectorEtf | null>(null)
  const activeIndex = activeEtf ? sorted.findIndex((s) => s.etf === activeEtf) : -1
  const active = activeIndex >= 0 ? sorted[activeIndex] : null
  const activeRank = activeIndex >= 0 ? rankOf(activeIndex, sorted.length) : null

  const rankLabelKey: Record<'lead' | 'lag' | 'mid', TranslationKey> = {
    lead: 'home.sectorHeatmapRankLead',
    lag: 'home.sectorHeatmapRankLag',
    mid: 'home.sectorHeatmapRankMid',
  }

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
              <div
                key={s.etf}
                className={`${styles.cell} ${heatClass(s.changePercent)} ${activeEtf === s.etf ? styles.cellActive : ''}`}
                title={t(SECTOR_NAME_KEY[s.etf])}
                onMouseEnter={() => setActiveEtf(s.etf)}
                onFocus={() => setActiveEtf(s.etf)}
              >
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
      <div className={`${styles.detailPanel} metal-panel`}>
        {active && activeRank ? (
          <>
            <div className={styles.detailMain}>
              <span className={styles.detailName}>{t(SECTOR_NAME_KEY[active.etf])}</span>
              <span className={styles.detailEtf}>{active.etf}</span>
            </div>
            <span className={`${styles.detailBadge} ${styles[`detailBadge_${activeRank}`]}`}>{t(rankLabelKey[activeRank])}</span>
            <span
              className={`num ${styles.detailPct} ${
                active.changePercent != null ? (active.changePercent >= 0 ? styles.detailPctUp : styles.detailPctDown) : ''
              }`}
            >
              {active.changePercent != null ? `${active.changePercent >= 0 ? '+' : ''}${active.changePercent.toFixed(2)}%` : '—'}
            </span>
          </>
        ) : (
          <span className={styles.detailEmpty}>{t('home.sectorHeatmapDetailHint')}</span>
        )}
      </div>
    </div>
  )
}
