import { describe, expect, it } from 'vitest'
import { getBondSymbols, getCommoditySymbols, getStockIndexSymbols } from './homeWidgets'

describe('getStockIndexSymbols', () => {
  it('מציגה תמיד את הסט המלא (5 סימבולים), זהה לכל המשתמשים', () => {
    expect(getStockIndexSymbols()).toEqual(['SPY', 'QQQ', 'DIA', 'IWM'])
  })
})

describe('getCommoditySymbols', () => {
  it('מציגה את 4 ה-ETF proxy (דולר/נפט/זהב/כסף)', () => {
    expect(getCommoditySymbols()).toEqual(['UUP', 'USO', 'GLD', 'SLV'])
  })
})

describe('getBondSymbols', () => {
  it('מציגה את 2 ה-ETF proxy לאג"ח (ארוך+בינוני טווח)', () => {
    expect(getBondSymbols()).toEqual(['TLT', 'IEF'])
  })
})
