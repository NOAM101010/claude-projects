import { prisma } from "./prisma";
import { getSetting } from "./settings";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO
  symbol: string | null;
  category: "position" | "watchlist" | "market";
};

/* ── helpers ─────────────────────────────────────────────── */

function stripCdata(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news";
  }
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function iso(d: Date | number | string): string {
  const date =
    typeof d === "number" ? new Date(d * 1000) : new Date(d);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ── Yahoo RSS ───────────────────────────────────────────── */

export async function fetchYahooRss(symbol: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
        symbol
      )}&region=US&lang=en-US`,
      { headers: { "user-agent": "Mozilla/5.0" } }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items: NewsItem[] = [];
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    for (const block of blocks) {
      const title = stripCdata(
        block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""
      );
      const link = stripCdata(
        block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ""
      );
      if (!title || !link) continue;
      const pub = stripCdata(
        block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? ""
      );
      const srcMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const source = srcMatch ? stripCdata(srcMatch[1]) : hostOf(link);
      items.push({
        id: `yahoo:${link}`,
        title,
        url: link,
        source: source || hostOf(link),
        publishedAt: pub ? iso(pub) : new Date().toISOString(),
        symbol: symbol.toUpperCase(),
        category: "market",
      });
    }
    return items;
  } catch {
    return [];
  }
}

/* ── Finnhub ─────────────────────────────────────────────── */

export async function fetchFinnhubMarket(key: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general`,
      { headers: { "X-Finnhub-Token": key } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any[];
    if (!Array.isArray(json)) return [];
    return json.slice(0, 15).map((n) => ({
      id: `finnhub:${n.id ?? n.url}`,
      title: String(n.headline ?? ""),
      url: String(n.url ?? ""),
      source: String(n.source ?? "Finnhub"),
      publishedAt: iso(Number(n.datetime) || Date.now() / 1000),
      symbol: null,
      category: "market" as const,
    }));
  } catch {
    return [];
  }
}

export async function fetchFinnhubCompany(
  key: string,
  symbol: string,
  fromISO: string,
  toISO: string
): Promise<NewsItem[]> {
  try {
    const from = fromISO.slice(0, 10);
    const to = toISO.slice(0, 10);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
        symbol
      )}&from=${from}&to=${to}`,
      { headers: { "X-Finnhub-Token": key } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any[];
    if (!Array.isArray(json)) return [];
    return json.map((n) => ({
      id: `finnhub:${n.id ?? n.url}`,
      title: String(n.headline ?? ""),
      url: String(n.url ?? ""),
      source: String(n.source ?? "Finnhub"),
      publishedAt: iso(Number(n.datetime) || Date.now() / 1000),
      symbol: symbol.toUpperCase(),
      category: "market" as const,
    }));
  } catch {
    return [];
  }
}

/* ── curated feed ────────────────────────────────────────── */

type CuratedResult = { items: NewsItem[]; generatedAt: string };

let CACHE: { t: number; data: CuratedResult } | null = null;
let PENDING: Promise<CuratedResult> | null = null;
const TTL = 15 * 60 * 1000;

async function batchMap<T, R>(
  arr: T[],
  size: number,
  fn: (x: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < arr.length; i += size) {
    const chunk = arr.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

export function getCuratedNews(): Promise<CuratedResult> {
  if (CACHE && Date.now() - CACHE.t < TTL) return Promise.resolve(CACHE.data);
  if (PENDING) return PENDING;

  const work = buildCuratedNews()
    .then((data) => {
      CACHE = { t: Date.now(), data };
      return data;
    })
    .finally(() => {
      PENDING = null;
    });
  PENDING = work;
  return work;
}

async function buildCuratedNews(): Promise<CuratedResult> {
  const [openTrades, watchRows, finnhubKey] = await Promise.all([
    prisma.trade.findMany({ where: { sellDate: null }, select: { ticker: true } }),
    prisma.watchlist.findMany({ select: { symbol: true } }),
    getSetting("finnhub_api_key"),
  ]);

  const positionSet = new Set(
    openTrades.map((t) => t.ticker.toUpperCase())
  );
  const watchSet = new Set(
    watchRows.map((w) => w.symbol.toUpperCase())
  );
  const allSymbols = Array.from(new Set([...positionSet, ...watchSet])).slice(0, 12);

  const now = new Date();
  const from48 = new Date(now.getTime() - 48 * 3600 * 1000);

  const catFor = (sym: string): NewsItem["category"] =>
    positionSet.has(sym) ? "position" : "watchlist";

  const collected: NewsItem[] = [];

  // Yahoo RSS per symbol
  const yahooLists = await batchMap(allSymbols, 4, (s) => fetchYahooRss(s));
  yahooLists.forEach((list, i) => {
    const sym = allSymbols[i];
    for (const it of list) {
      collected.push({ ...it, symbol: sym, category: catFor(sym) });
    }
  });

  // Finnhub
  if (finnhubKey) {
    const market = await fetchFinnhubMarket(finnhubKey);
    collected.push(...market);

    const positionSymbols = allSymbols.filter((s) => positionSet.has(s));
    const companyLists = await batchMap(positionSymbols, 4, (s) =>
      fetchFinnhubCompany(finnhubKey, s, from48.toISOString(), now.toISOString())
    );
    companyLists.forEach((list, i) => {
      const sym = positionSymbols[i];
      for (const it of list) {
        collected.push({ ...it, symbol: sym, category: "position" });
      }
    });
  }

  // dedupe by url || normalized-title
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of collected) {
    const k = (it.url || normTitle(it.title)).toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    deduped.push(it);
  }

  const items = deduped
    .filter((it) => {
      const t = new Date(it.publishedAt).getTime();
      return Number.isFinite(t) && t >= from48.getTime();
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, 40);

  return { items, generatedAt: now.toISOString() };
}

/* ── earnings calendar ───────────────────────────────────── */

let EARNINGS_CACHE: { t: number; data: Record<string, string> } | null = null;
const EARNINGS_TTL = 6 * 3600 * 1000;

export async function getEarningsCalendar(
  key: string | null,
  symbols: string[]
): Promise<Record<string, string>> {
  if (!key) return {};
  if (EARNINGS_CACHE && Date.now() - EARNINGS_CACHE.t < EARNINGS_TTL) {
    return filterEarnings(EARNINGS_CACHE.data, symbols);
  }
  try {
    const now = new Date();
    const to = new Date(now.getTime() + 30 * 86400000);
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${ymd(now)}&to=${ymd(
        to
      )}`,
      { headers: { "X-Finnhub-Token": key } }
    );
    if (!res.ok) return {};
    const json = (await res.json()) as any;
    const rows: any[] = json?.earningsCalendar ?? [];
    const map: Record<string, string> = {};
    for (const r of rows) {
      const sym = String(r.symbol ?? "").toUpperCase();
      const date = String(r.date ?? "");
      if (!sym || !date) continue;
      if (!map[sym] || date < map[sym]) map[sym] = date;
    }
    EARNINGS_CACHE = { t: Date.now(), data: map };
    return filterEarnings(map, symbols);
  } catch {
    return {};
  }
}

function filterEarnings(
  map: Record<string, string>,
  symbols: string[]
): Record<string, string> {
  if (!symbols.length) return map;
  const want = new Set(symbols.map((s) => s.toUpperCase()));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) if (want.has(k)) out[k] = v;
  return out;
}
