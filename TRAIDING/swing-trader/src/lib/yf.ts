import YahooFinance from "yahoo-finance2";

// Shared singleton instance (v4 API requires instantiation)
const globalForYf = globalThis as unknown as { yf: any };

export const yf =
  globalForYf.yf ??
  new YahooFinance({
    suppressNotices: ["yahooSurvey", "ripHistorical"],
  });

if (process.env.NODE_ENV !== "production") globalForYf.yf = yf;
