/**
 * שולף+מרענן תקופתית מדדי מניות (כולל ETF-proxy/סקטורים) וקריפטו+Fear&Greed - חולץ
 * מ-`Home.tsx` (שלב G בתוכנית ה-redesign) כדי ש-`Home.tsx` וגם `MarketRail.tsx` (הרצועה
 * הצדדית בדסקטופ) ישתמשו באותו מנגנון fetch/polling במקום שני `setInterval` נפרדים
 * שקוראים לאותן Edge Function/CoinGecko - שני polling loops זהים זה בזבוז מיותר של
 * מכסת הקריאות ל-Finnhub/CoinGecko. בפועל Home ו-MarketRail אף פעם לא מוצגים יחד
 * (הרצועה מוסתרת במסך הבית עצמו), כך שבפועל תמיד רק צריכן אחד פעיל - אבל השיתוף
 * עדיין מונע שכפול קוד ומבטיח שהתנהגות הרענון זהה בשני המקומות.
 */
import { useEffect, useState } from 'react'
import { fetchCryptoPrices, fetchFearGreedIndex, fetchStockIndices } from '../lib/marketData'
import type { CryptoPrices, FearGreedIndex, StockIndices } from '../lib/marketData'

const CRYPTO_REFRESH_MS = 60_000
const INDICES_REFRESH_MS = 60_000

export interface MarketDataState {
  indices: StockIndices | null
  indicesLoading: boolean
  indicesFailed: boolean
  crypto: CryptoPrices | null
  cryptoLoading: boolean
  cryptoFailed: boolean
  fearGreed: FearGreedIndex | null
}

/** true אם כל שדה חזר null - כשל מלא (רשת/Edge Function), לא רק כמה סימבולים לא זמינים בתוכנית החינמית. */
function isIndicesFullyFailed(indices: StockIndices): boolean {
  return (
    !indices.spy &&
    !indices.qqq &&
    !indices.vix &&
    !indices.dia &&
    !indices.iwm &&
    !indices.dxy &&
    !indices.oil &&
    !indices.gold &&
    !indices.silver &&
    !indices.bondLong &&
    !indices.bondMid
  )
}

export function useMarketData(): MarketDataState {
  const [indices, setIndices] = useState<StockIndices | null>(null)
  const [indicesLoading, setIndicesLoading] = useState(true)
  const [indicesFailed, setIndicesFailed] = useState(false)

  const [crypto, setCrypto] = useState<CryptoPrices | null>(null)
  const [cryptoLoading, setCryptoLoading] = useState(true)
  const [cryptoFailed, setCryptoFailed] = useState(false)
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const result = await fetchStockIndices()
        if (!cancelled) {
          setIndices(result)
          setIndicesFailed(isIndicesFullyFailed(result))
        }
      } catch {
        if (!cancelled) setIndicesFailed(true)
      } finally {
        if (!cancelled) setIndicesLoading(false)
      }
    }
    load()
    const id = setInterval(load, INDICES_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [result, fearGreedResult] = await Promise.all([fetchCryptoPrices(), fetchFearGreedIndex()])
        if (!cancelled) {
          setCrypto(result)
          setFearGreed(fearGreedResult)
          setCryptoFailed(false)
        }
      } catch {
        if (!cancelled) setCryptoFailed(true)
      } finally {
        if (!cancelled) setCryptoLoading(false)
      }
    }
    load()
    const id = setInterval(load, CRYPTO_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { indices, indicesLoading, indicesFailed, crypto, cryptoLoading, cryptoFailed, fearGreed }
}
