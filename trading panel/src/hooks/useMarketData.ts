/**
 * שולף+מרענן תקופתית מדדי מניות (כולל ETF-proxy/סקטורים) וקריפטו+Fear&Greed.
 * נקרא מ-`App.tsx` ברמה העליונה (לא מתוך `Home.tsx`) כדי שה-state ישרוד מעברי טאב -
 * `Home` מתפרק/נבנה מחדש בכל מעבר טאב (רינדור מותנה ב-App), ואם ה-hook היה שם
 * המצב היה מתאפס (loading:true, indices:null) בכל חזרה למסך הבית. `Home.tsx` מקבל
 * את הפלט של ה-hook הזה כ-props.
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

export function useMarketData(ready: boolean): MarketDataState {
  const [indices, setIndices] = useState<StockIndices | null>(null)
  const [indicesLoading, setIndicesLoading] = useState(true)
  const [indicesFailed, setIndicesFailed] = useState(false)

  const [crypto, setCrypto] = useState<CryptoPrices | null>(null)
  const [cryptoLoading, setCryptoLoading] = useState(true)
  const [cryptoFailed, setCryptoFailed] = useState(false)
  const [fearGreed, setFearGreed] = useState<FearGreedIndex | null>(null)

  useEffect(() => {
    if (!ready) return
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
  }, [ready])

  useEffect(() => {
    if (!ready) return
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
  }, [ready])

  return { indices, indicesLoading, indicesFailed, crypto, cryptoLoading, cryptoFailed, fearGreed }
}
