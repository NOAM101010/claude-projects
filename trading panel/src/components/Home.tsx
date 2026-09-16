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
      <MarketTicker indices={indices} crypto={crypto} />

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          {/* Market status is the single most important thing a trader checks on open -
              it now leads the hero (bigger, first), the greeting is de-emphasized below it
              instead of dominating the top of the page (see progress.md UX pass). This
              panel also carries the new "kinetic data" clock treatment (see progress.md's
              Visual redesign exploration / direction-merged-v1.html). */}
          <div className={`${styles.clockPanel} metal-panel holo-edge holo-edge--amber`}>
            <span className={`eyebrow ${styles.eyebrow} ${styles.eyebrowLive}`}>{t('home.overviewEyebrow')}</span>
            <LiveClock />
            <div className={styles.heroMeta}>
              <MarketStatusChip now={now} locale={locale} />
            </div>
            <h1 className={`hero-title ${styles.heroTitle}`}>{greeting}</h1>
            <span className={styles.dateLabel}>{dateLabel}</span>
          </div>

          {/* Layered "depth stack" of the 3 headline real quotes (SPY/QQQ/BTC) - the
              mockup's per-tile sparkline was decorative/randomized, and the app has no
              real historical intraday series to draw one from (only a single current
              price + 24h % change per IndexQuote/CryptoPrice - see marketData.ts). Kept
              the glow/pulse/depth energy, deliberately dropped the sparkline rather than
              fabricate a shape for real money-adjacent data. */}
          <div className={styles.stack}>
            <StackCard
              cls={styles.c1}
              label={t('home.stackSpyLabel')}
              price={indices?.spy?.price ?? null}
              changePercent={indices?.spy?.changePercent ?? null}
              loading={indicesLoading}
              failed={indicesFailed}
              priceFormatter={(v) => v.toFixed(2)}
            />
            <StackCard
              cls={styles.c2}
              label={t('home.stackQqqLabel')}
              price={indices?.qqq?.price ?? null}
              changePercent={indices?.qqq?.changePercent ?? null}
              loading={indicesLoading}
              failed={indicesFailed}
              priceFormatter={(v) => v.toFixed(2)}
            />
            <StackCard
              cls={styles.c3}
              label={t('home.stackBtcLabel')}
              price={crypto?.bitcoin.usd ?? null}
              changePercent={crypto?.bitcoin.usd24hChange ?? null}
              loading={cryptoLoading}
              failed={cryptoFailed}
              priceFormatter={(v) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(v)}
            />
          </div>
        </div>
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

/** שעון חי - שעון-קיר של המכשיר עצמו (לא שעון הבורסה - זה תפקידה של MarketStatusChip
 * למעלה), מתקתק כל שנייה. state נפרד ומבודד ברכיב משלו כדי שרק השעון עצמו יתעדכן כל
 * שנייה, לא כל עץ ה-Home. */
function LiveClock() {
  const [time, setTime] = useState(() => new Date())
  const { t } = useLanguage()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <div className={`${styles.clockBig} num`}>{time.toTimeString().slice(0, 8)}</div>
      <span className={styles.clockSubLabel}>{t('home.yourTimeLabel')}</span>
    </>
  )
}

/** רצועת טיקר גוללת - מדדים+קריפטו אמיתיים (אותו דאטה כמו למטה, מוצג שוב כתקציר קינטי).
 * דקורטיבי בלבד (aria-hidden) - כל המספרים כבר נגישים בתגיות/רשתות שמתחת. שני עותקים
 * זהים זה לצד זה + translateX(-50%) לולאה חלקה בלי קפיצה. */
function MarketTicker({ indices, crypto }: { indices: StockIndices | null; crypto: CryptoPrices | null }) {
  const items: { symbol: string; changePercent: number }[] = []
  const pushIndex = (symbol: string, quote: IndexQuote | null) => {
    if (quote) items.push({ symbol, changePercent: quote.changePercent })
  }
  if (indices) {
    pushIndex('SPY', indices.spy)
    pushIndex('QQQ', indices.qqq)
    pushIndex('DIA', indices.dia)
    pushIndex('IWM', indices.iwm)
  }
  if (crypto) {
    items.push({ symbol: 'BTC', changePercent: crypto.bitcoin.usd24hChange })
    items.push({ symbol: 'ETH', changePercent: crypto.ethereum.usd24hChange })
    items.push({ symbol: 'SOL', changePercent: crypto.solana.usd24hChange })
    items.push({ symbol: 'XRP', changePercent: crypto.ripple.usd24hChange })
    items.push({ symbol: 'BNB', changePercent: crypto.binancecoin.usd24hChange })
  }

  if (items.length === 0) return null

  const row = (dup: number) => (
    <div className={styles.tickerRow} key={dup}>
      {items.map((it, i) => {
        const up = it.changePercent >= 0
        return (
          <span className={styles.tickerItem} key={`${dup}-${i}`}>
            <span className={styles.tickerSym}>{it.symbol}</span>
            <span className={`num ${up ? styles.up : styles.down}`}>
              {up ? '+' : ''}
              {it.changePercent.toFixed(2)}%
            </span>
          </span>
        )
      })}
    </div>
  )

  return (
    <div className={styles.tickerWrap} dir="ltr" aria-hidden="true">
      <div className={styles.tickerTrack}>
        {row(0)}
        {row(1)}
      </div>
    </div>
  )
}

/** כרטיס בודד ב"מחסנית עומק" (stack) - אותו דאטה אמיתי כמו PriceTile, בלי גרף sparkline
 * (אין דאטה היסטורי אמיתי לצייר ממנו - ראה ההערה למעלה ב-Home). `cls` קובע את מיקום
 * השכבה (c1/c2/c3, ראה Home.module.css). */
function StackCard({
  cls,
  label,
  price,
  changePercent,
  loading,
  failed,
  priceFormatter,
}: {
  cls: string
  label: string
  price: number | null
  changePercent: number | null
  loading: boolean
  failed: boolean
  priceFormatter: (value: number) => string
}) {
  const { t } = useLanguage()
  const up = (changePercent ?? 0) >= 0
  const unavailable = failed || (!loading && price == null)

  return (
    <div className={`${styles.stackCard} ${cls}`}>
      <div className={styles.stackLabel}>{label}</div>
      {loading ? (
        <div className={`${styles.stackValue} shimmer`} style={{ height: 28, borderRadius: 6 }} />
      ) : unavailable ? (
        <span className={styles.note}>{t('home.indexUnavailable')}</span>
      ) : (
        <>
          <div className={`${styles.stackValue} num`}>{priceFormatter(price as number)}</div>
          <div className={`${styles.stackChange} num ${up ? styles.up : styles.down}`}>
            {up ? '▲' : '▼'} {up ? '+' : ''}
            {(changePercent ?? 0).toFixed(2)}%
          </div>
        </>
      )}
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
  const flashClass = price == null ? '' : up ? styles.tileUp : styles.tileDown

  return (
    <div className={`${styles.tile} ${flashClass} glass glass-hover`}>
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
