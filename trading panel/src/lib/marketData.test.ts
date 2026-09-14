import { describe, expect, it } from 'vitest'
import { classifyFearGreedValue, mapCoinGeckoResponse, mapFearGreedResponse } from './marketData'

const FULL_RESPONSE = {
  bitcoin: { usd: 65000, usd_24h_change: 2.5 },
  ethereum: { usd: 3200, usd_24h_change: -1.2 },
  solana: { usd: 140, usd_24h_change: 4.1 },
  ripple: { usd: 0.55, usd_24h_change: -0.8 },
  binancecoin: { usd: 580, usd_24h_change: 1.1 },
}

describe('mapCoinGeckoResponse', () => {
  it('ממפה תגובה תקינה עם 5 המטבעות לטיפוס שלנו', () => {
    const result = mapCoinGeckoResponse(FULL_RESPONSE)
    expect(result).toEqual({
      bitcoin: { usd: 65000, usd24hChange: 2.5 },
      ethereum: { usd: 3200, usd24hChange: -1.2 },
      solana: { usd: 140, usd24hChange: 4.1 },
      ripple: { usd: 0.55, usd24hChange: -0.8 },
      binancecoin: { usd: 580, usd24hChange: 1.1 },
    })
  })

  it('ברירת מחדל 0 אם usd_24h_change חסר', () => {
    const result = mapCoinGeckoResponse({
      bitcoin: { usd: 100 },
      ethereum: { usd: 200 },
      solana: { usd: 10 },
      ripple: { usd: 1 },
      binancecoin: { usd: 300 },
    })
    expect(result.bitcoin.usd24hChange).toBe(0)
    expect(result.solana.usd24hChange).toBe(0)
  })

  it('זורק אם bitcoin.usd חסר', () => {
    const { bitcoin, ...rest } = FULL_RESPONSE
    expect(() => mapCoinGeckoResponse(rest)).toThrow()
  })

  it('זורק אם אחד המטבעות החדשים חסר לגמרי', () => {
    const { solana, ...rest } = FULL_RESPONSE
    expect(() => mapCoinGeckoResponse(rest)).toThrow()
  })
})

describe('classifyFearGreedValue', () => {
  it('מסווגת נכון לפי הטווחים', () => {
    expect(classifyFearGreedValue(0)).toBe('extremeFear')
    expect(classifyFearGreedValue(24)).toBe('extremeFear')
    expect(classifyFearGreedValue(25)).toBe('fear')
    expect(classifyFearGreedValue(44)).toBe('fear')
    expect(classifyFearGreedValue(45)).toBe('neutral')
    expect(classifyFearGreedValue(55)).toBe('neutral')
    expect(classifyFearGreedValue(56)).toBe('greed')
    expect(classifyFearGreedValue(75)).toBe('greed')
    expect(classifyFearGreedValue(76)).toBe('extremeGreed')
    expect(classifyFearGreedValue(100)).toBe('extremeGreed')
  })
})

describe('mapFearGreedResponse', () => {
  it('ממפה תגובה תקינה', () => {
    expect(mapFearGreedResponse({ data: [{ value: '37' }] })).toEqual({ value: 37, classification: 'fear' })
  })

  it('מחזירה null כשהתגובה ריקה/חסרה', () => {
    expect(mapFearGreedResponse({ data: [] })).toBeNull()
    expect(mapFearGreedResponse({})).toBeNull()
    expect(mapFearGreedResponse(null)).toBeNull()
    expect(mapFearGreedResponse(undefined)).toBeNull()
  })

  it('מחזירה null כש-value לא מספר תקין', () => {
    expect(mapFearGreedResponse({ data: [{ value: 'abc' }] })).toBeNull()
  })
})
