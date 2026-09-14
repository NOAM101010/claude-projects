import { ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { formatDurationHHMM, getMarketStatus } from '../lib/marketHours'
import type { CryptoPrices, FearGreedIndex, IndexQuote, StockIndices } from '../lib/marketData'
import {
  getBondSymbols,
  getCommoditySymbols,
  getStockIndexSymbols,
  type BondSymbol,
  type CommoditySymbol,
  type StockIndexSymbol,
} from '../lib/homeWidgets'
import { SectorHeatmap } from './SectorHeatmap'
import type { TranslationKey } from '../i18n/translations'
import { tradingViewUrl } from '../lib/tradingView'
import styles from './Home.module.css'

const MARKET_STATUS_REFRESH_MS = 30_000

/** בוקר/צהריים/ערב/לילה טוב לפי השעה המקומית - לא תרגום מילולי של "Home", ברכה אמיתית. */
function getGreetingKey(hour: number): TranslationKey {
  if (hour >= 5 && hour < 12) return 'home.greetingMorning'
  if (hour >= 12 && hour < 17) return 'home.greetingAfternoon'
  if (hour >= 17 && hour < 21) return 'home.greetingEvening'
  return 'home.greetingNight'
}

export interface HomeProps {
  indices: StockIndices | null
  indicesLoading: boolean
  indicesFailed: boolean
  crypto: CryptoPrices | null
  cryptoLoading: boolean
  cryptoFailed: boolean
  fearGreed: FearGreedIndex | null
}

/**
 * מסך "בית" - טאב ראשון, לפני "טריידים". מאז שלב A בתוכנית ה-redesign מציג תמיד
 * הכל (מניות+מפת חום סקטורים+קריפטו) לכל המשתמשים - אין יותר תלות בסגנון workspace
 * (נמחק לגמרי). אין שימוש ב-Supabase כאן - הכל state מקומי + חישוב טהור/fetch ציבורי.
 * נתוני השוק (indices/crypto/fearGreed) מגיעים כ-props מ-`App.tsx` (שם חי ה-hook
 * `useMarketData`) כדי לשרוד מעברי טאב - Home נכנס/יוצא מה-DOM בכל מעבר טאב, ואם
 * ה-hook היה כאן, המצב היה מתאפס (loading:true) בכל חזרה למסך. ראה useMarketData.ts.
 */
export function Home({
  indices,
  indicesLoading,
  indicesFailed,
  crypto,
  cryptoLoading,
  cryptoFailed,
  fearGreed,
}: HomeProps) {
  const { t, locale } = useLanguage()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), MARKET_STATUS_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(now)
  const greeting = t(getGreetingKey(now.getHours()))

  return (
    <div className={styles.wrapper}>
      <section className={styles.hero}>
        {/* Market status is the single most important thing a trader checks on open -
            it now leads the hero (bigger, first), the greeting is de-emphasized below it
            instead of dominating the top of the page (see progress.md UX pass). */}
        <div className={styles.heroMeta}>
          <MarketStatusChip now={now} locale={locale} />
          <span className={styles.dateLabel}>{dateLabel}</span>
        </div>
        <span className={`eyebrow ${styles.eyebrow}`}>{t('home.overviewEyebrow')}</span>
        <h1 className={`hero-title ${styles.heroTitle}`}>{greeting}</h1>
      </section>

      <StockSection indices={indices} loading={indicesLoading} failed={indicesFailed} />
      <CryptoPricesSection
        prices={crypto}
        fearGreed={fearGreed}
        loading={cryptoLoading}
        failed={cryptoFailed}
      />
    </div>
  )
}

function MarketStatusChip({ now, locale }: { now: Date; locale: string }) {
  const { t } = useLanguage()
  const status = getMarketStatus(now)

  // הצ'יפ מציג את שעת הפתיחה הבאה באזור הזמן המקומי של הצופה (לא NY גולמי) - `nextOpenAt`
  // הוא instant אמיתי מ-marketHours.ts, מעוצב כאן בלי `timeZone` מפורש כדי ש-Intl ישתמש
  // בברירת המחדל של הדפדפן (אזור הזמן של המכשיר), נכון גם סביב מעברי שעון קיץ/חורף.
  // שני פורמטרים נפרדים (במקום לפרק מחרוזת משולבת) כי הפרדת יום/שעה בפיסוק תלויה בשפה.
  const nextOpenDay = status.nextOpenAt ? new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(status.nextOpenAt) : ''
  const nextOpenTime = status.nextOpenAt
    ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(status.nextOpenAt)
    : ''

  return status.isOpen ? (
    <span className={styles.statusGroup}>
      <span className="det-chip det-chip--up">{t('home.marketOpenTitle')}</span>
      <span className={styles.statusText}>{t('home.closesIn', { time: formatDurationHHMM(status.minutesUntilClose ?? 0) })}</span>
    </span>
  ) : (
    <span className={styles.statusGroup}>
      <span className="det-chip det-chip--down">{t('home.marketClosedTitle')}</span>
      <span className={styles.statusText}>
        {t('home.opensOn', { day: nextOpenDay, time: nextOpenTime })}
      </span>
    </span>
  )
}

/** תא מחיר יחיד - כרטיס glass נפרד עם label, אייקון מגמה (אופציונלי, VIX בלי), מחיר גדול, אחוז שינוי צבעוני. */
function PriceTile({
  label,
  symbol,
  price,
  changePercent,
  showTrend,
  priceFormatter,
}: {
  label: string
  /** טיקר ETF/מדד אמיתי לקישור TradingView - כשמסופק, `label` הופך ללינק חיצוני (ראה tradingView.ts). */
  symbol?: string
  price: number | null
  changePercent: number | null
  showTrend: boolean
  priceFormatter: (value: number) => string
}) {
  const { t } = useLanguage()
  const up = (changePercent ?? 0) >= 0

  return (
    <div className={`${styles.tile} glass glass-hover`}>
      <div className={styles.tileHeader}>
        {symbol ? (
          <a href={tradingViewUrl(symbol)} target="_blank" rel="noopener noreferrer" className={styles.tileLabelLink}>
            {label}
            <ExternalLink size={10} className={styles.externalIcon} />
          </a>
        ) : (
          <span className={styles.tileLabel}>{label}</span>
        )}
        {showTrend && price != null && (up ? <TrendingUp size={14} className={styles.up} /> : <TrendingDown size={14} className={styles.down} />)}
      </div>
      {price == null ? (
        <span className={styles.note}>{t('home.indexUnavailable')}</span>
      ) : (
        <>
          <div className={`${styles.tilePrice} num`}>{priceFormatter(price)}</div>
          <div className={`${styles.tileChange} num ${up ? styles.up : styles.down}`}>
            {t('home.change24h', { value: `${up ? '+' : ''}${(changePercent ?? 0).toFixed(2)}%` })}
          </div>
        </>
      )}
    </div>
  )
}

/** צבע לפי טווח הסנטימנט - ירוק לחמדנות, אדום לפחד, ענבר לניטרלי (עקבי עם ה-accent הקיים). */
const FEAR_GREED_COLOR_CLASS: Record<FearGreedIndex['classification'], string> = {
  extremeFear: styles.down,
  fear: styles.down,
  neutral: styles.neutral,
  greed: styles.up,
  extremeGreed: styles.up,
}

const FEAR_GREED_LABEL_KEY: Record<FearGreedIndex['classification'], TranslationKey> = {
  extremeFear: 'home.fearGreedExtremeFear',
  fear: 'home.fearGreedFear',
  neutral: 'home.fearGreedNeutral',
  greed: 'home.fearGreedGreed',
  extremeGreed: 'home.fearGreedExtremeGreed',
}

function FearGreedCard({ index, loading }: { index: FearGreedIndex | null; loading: boolean }) {
  const { t } = useLanguage()

  return (
    <div className={`${styles.tile} ${styles.fearGreedTile} glass glass-hover`}>
      <div className={styles.tileHeader}>
        <span className={styles.tileLabel}>{t('home.fearGreedCardTitle')}</span>
      </div>
      {loading ? (
        <span className={styles.note}>{t('home.fearGreedLoading')}</span>
      ) : !index ? (
        <span className={styles.note}>{t('home.fearGreedUnavailable')}</span>
      ) : (
        <>
          <div className={`${styles.tilePrice} num ${FEAR_GREED_COLOR_CLASS[index.classification]}`}>{index.value}</div>
          <div className={`${styles.tileChange} ${FEAR_GREED_COLOR_CLASS[index.classification]}`}>{t(FEAR_GREED_LABEL_KEY[index.classification])}</div>
        </>
      )}
      <p className={styles.note}>{t('home.fearGreedNote')}</p>
    </div>
  )
}

function CryptoPricesSection({
  prices,
  fearGreed,
  loading,
  failed,
}: {
  prices: CryptoPrices | null
  fearGreed: FearGreedIndex | null
  loading: boolean
  failed: boolean
}) {
  const { t, locale } = useLanguage()

  const formatUsd = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value)

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{t('home.cryptoCardTitle')}</h3>
      {loading ? (
        <p className={styles.note}>{t('home.cryptoLoading')}</p>
      ) : failed || !prices ? (
        <p className={styles.note}>{t('home.cryptoUnavailable')}</p>
      ) : (
        <div className={styles.grid}>
          <PriceTile label="BTC" price={prices.bitcoin.usd} changePercent={prices.bitcoin.usd24hChange} showTrend priceFormatter={formatUsd} />
          <PriceTile label="ETH" price={prices.ethereum.usd} changePercent={prices.ethereum.usd24hChange} showTrend priceFormatter={formatUsd} />
          <PriceTile label="SOL" price={prices.solana.usd} changePercent={prices.solana.usd24hChange} showTrend priceFormatter={formatUsd} />
          <PriceTile label="XRP" price={prices.ripple.usd} changePercent={prices.ripple.usd24hChange} showTrend priceFormatter={formatUsd} />
          <PriceTile label="BNB" price={prices.binancecoin.usd} changePercent={prices.binancecoin.usd24hChange} showTrend priceFormatter={formatUsd} />
          <FearGreedCard index={fearGreed} loading={loading} />
        </div>
      )}
    </section>
  )
}

/** מיפוי סימבול -> שדה בתשובת fetchStockIndices + האם להציג אייקון מגמה (VIX בלי - הוא כשלעצמו מדד תנודתיות, לא "עולה/יורד" במובן הרגיל). */
const STOCK_SYMBOL_META: Record<StockIndexSymbol, { quote: (i: StockIndices) => IndexQuote | null; showTrend: boolean }> = {
  SPY: { quote: (i) => i.spy, showTrend: true },
  QQQ: { quote: (i) => i.qqq, showTrend: true },
  DIA: { quote: (i) => i.dia, showTrend: true },
  IWM: { quote: (i) => i.iwm, showTrend: true },
}

/**
 * סחורות/דולר ואג"ח הם ETF proxy (לא המחיר/מדד "האמיתי") - התווית תמיד כוללת את קוד
 * ה-ETF בסוגריים (ראה מפתחות home.label* ב-translations.ts) כדי לא ליצור רושם מטעה
 * של דיוק/סמכות שאין לו, עקבי עם המדיניות "בלי ייעוץ השקעות" של המוצר.
 */
const COMMODITY_SYMBOL_META: Record<CommoditySymbol, { quote: (i: StockIndices) => IndexQuote | null; labelKey: TranslationKey }> = {
  UUP: { quote: (i) => i.dxy, labelKey: 'home.labelDxy' },
  USO: { quote: (i) => i.oil, labelKey: 'home.labelOil' },
  GLD: { quote: (i) => i.gold, labelKey: 'home.labelGold' },
  SLV: { quote: (i) => i.silver, labelKey: 'home.labelSilver' },
}

const BOND_SYMBOL_META: Record<BondSymbol, { quote: (i: StockIndices) => IndexQuote | null; labelKey: TranslationKey }> = {
  TLT: { quote: (i) => i.bondLong, labelKey: 'home.labelBondLong' },
  IEF: { quote: (i) => i.bondMid, labelKey: 'home.labelBondMid' },
}

/**
 * מדדים+סחורות/דולר+אג"ח + מפת חום סקטורים - כולם נטענים יחד מ-fetchStockIndices (קריאה
 * אחת ל-Edge Function) ומוצגים בקבוצות נפרדות עם כותרות משנה, כדי שכמות התאים המוכפלת
 * (5 מדדים + 4 סחורות/דולר + 2 אג"ח) לא תיראה כרשת שטוחה אחת ארוכה. מוצג לכולם.
 */
function StockSection({
  indices,
  loading,
  failed,
}: {
  indices: StockIndices | null
  loading: boolean
  failed: boolean
}) {
  const { t } = useLanguage()

  const formatIndexPrice = (value: number) => value.toFixed(2)
  const indexSymbols = getStockIndexSymbols()
  const commoditySymbols = getCommoditySymbols()
  const bondSymbols = getBondSymbols()

  return (
    <>
      <SectorHeatmap sectors={indices?.sectors ?? []} loading={loading} />

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('home.indicesGroupTitle')}</h3>
        {loading ? (
          <p className={styles.note}>{t('home.indicesLoading')}</p>
        ) : failed || !indices ? (
          <p className={styles.note}>{t('home.indicesUnavailable')}</p>
        ) : (
          <div className={styles.grid}>
            {indexSymbols.map((symbol) => {
              const meta = STOCK_SYMBOL_META[symbol]
              return (
                <PriceTile
                  key={symbol}
                  label={symbol}
                  symbol={symbol}
                  price={meta.quote(indices)?.price ?? null}
                  changePercent={meta.quote(indices)?.changePercent ?? null}
                  showTrend={meta.showTrend}
                  priceFormatter={formatIndexPrice}
                />
              )
            })}
          </div>
        )}
      </section>

      {!loading && !failed && indices && (
        <>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('home.commoditiesGroupTitle')}</h3>
            <div className={styles.grid}>
              {commoditySymbols.map((symbol) => {
                const meta = COMMODITY_SYMBOL_META[symbol]
                return (
                  <PriceTile
                    key={symbol}
                    label={t(meta.labelKey)}
                    symbol={symbol}
                    price={meta.quote(indices)?.price ?? null}
                    changePercent={meta.quote(indices)?.changePercent ?? null}
                    showTrend
                    priceFormatter={formatIndexPrice}
                  />
                )
              })}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('home.bondsGroupTitle')}</h3>
            <div className={styles.grid}>
              {bondSymbols.map((symbol) => {
                const meta = BOND_SYMBOL_META[symbol]
                return (
                  <PriceTile
                    key={symbol}
                    label={t(meta.labelKey)}
                    symbol={symbol}
                    price={meta.quote(indices)?.price ?? null}
                    changePercent={meta.quote(indices)?.changePercent ?? null}
                    showTrend
                    priceFormatter={formatIndexPrice}
                  />
                )
              })}
            </div>
            <p className={styles.note}>{t('home.etfProxyNote')}</p>
          </section>
        </>
      )}
    </>
  )
}
