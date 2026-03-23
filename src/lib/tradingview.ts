// TradingView Scanner API integration for real-time NSE stock data
// Uses Vite dev proxy to bypass CORS: /api/tv -> https://scanner.tradingview.com

const TRADINGVIEW_SCAN_URL = "/api/tv/india/scan";

const FIELDS = [
  "name",                        // Ticker symbol
  "description",                 // Company name
  "industry",                    // Industry
  "sector",                      // Sector
  "market_cap_basic",            // Market Cap (in currency units)
  "currency",                    // Currency
  "earnings_per_share_basic_ttm", // EPS TTM
  "price_earnings_ttm",          // P/E Ratio
  "close",                       // Current Price
  "change",                      // % change 1 day
  "volume",                      // Volume 1 day
  "relative_volume_10d_calc",    // Relative volume
  "average_volume_10d_calc",     // Avg Volume 10d
  "High.All",                    // All-time / 52W high
  "Low.All",                     // All-time / 52W low
  "SMA10",                       // SMA 10
  "SMA20",                       // SMA 20
  "SMA50",                       // SMA 50
];

export interface TVStockData {
  symbol: string;
  name: string;
  industry: string;
  sector: string;
  market_cap: number;    // in crores
  currency: string;
  eps: number;
  pe: number;
  price: number;
  change_pct: number;
  volume: number;
  relative_volume: number;
  avg_volume_10d: number;
  high_52w: number;
  low_52w: number;
  sma10: number;
  sma20: number;
  sma50: number;
}

const SECTOR_MAP: Record<string, string> = {
  "Energy Minerals": "Energy",
  "Technology Services": "IT",
  "Finance": "Banking",
  "Non-Energy Minerals": "Metals",
  "Consumer Non-Durables": "FMCG",
  "Health Technology": "Pharma",
  "Producer Manufacturing": "Capital Goods",
  "Consumer Durables": "Consumer Durables",
  "Process Industries": "Chemicals",
  "Retail Trade": "Retail",
  "Communications": "Telecom",
  "Electronic Technology": "IT",
  "Transportation": "Logistics",
  "Utilities": "Power",
  "Industrial Services": "Services",
  "Distribution Services": "Distribution",
  "Consumer Services": "Services",
  "Health Services": "Pharma",
  "Commercial Services": "Services",
  "Miscellaneous": "Others",
};

function parseRow(entry: { s: string; d: any[] }): TVStockData {
  const d = entry.d;
  const symbol = (entry.s || "").split(":")[1] || entry.s;
  const marketCapCr = (d[4] || 0) / 10000000;

  return {
    symbol,
    name: d[1] || symbol,
    industry: d[2] || "",
    sector: SECTOR_MAP[d[3] || ""] || d[3] || "",
    market_cap: Math.round(marketCapCr),
    currency: d[5] || "INR",
    eps: +(d[6] || 0).toFixed(2),
    pe: +(d[7] || 0).toFixed(2),
    price: +(d[8] || 0).toFixed(2),
    change_pct: +(d[9] || 0).toFixed(2),
    volume: Math.round(d[10] || 0),
    relative_volume: +(d[11] || 0).toFixed(2),
    avg_volume_10d: Math.round(d[12] || 0),
    high_52w: +(d[13] || 0).toFixed(2),
    low_52w: +(d[14] || 0).toFixed(2),
    sma10: +(d[15] || 0).toFixed(2),
    sma20: +(d[16] || 0).toFixed(2),
    sma50: +(d[17] || 0).toFixed(2),
  };
}

async function tvFetch(body: any): Promise<TVStockData[]> {
  const res = await fetch(TRADINGVIEW_SCAN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TradingView API error: ${res.status}`);
  const json = await res.json();
  return (json.data || []).map(parseRow);
}

export async function fetchStocksBySymbols(symbols: string[]): Promise<TVStockData[]> {
  return tvFetch({
    columns: FIELDS,
    symbols: { tickers: symbols.map((s) => `NSE:${s}`) },
    sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    range: [0, symbols.length],
  });
}

export async function fetchTopStocks(count: number = 50): Promise<TVStockData[]> {
  return tvFetch({
    columns: FIELDS,
    filter: [{ left: "exchange", operation: "equal", right: "NSE" }],
    sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    range: [0, count],
    options: { lang: "en" },
  });
}

export async function fetchScreenedStocks(options: {
  filters?: Array<{ left: string; operation: string; right: any }>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  count?: number;
}): Promise<TVStockData[]> {
  const filterArr: any[] = [
    { left: "exchange", operation: "equal", right: "NSE" },
    ...(options.filters || []),
  ];

  return tvFetch({
    columns: FIELDS,
    filter: filterArr,
    sort: { sortBy: options.sortBy || "market_cap_basic", sortOrder: options.sortOrder || "desc" },
    range: [0, options.count || 100],
    options: { lang: "en" },
  });
}

// Cache
let stockCache: { data: TVStockData[]; timestamp: number } | null = null;
const CACHE_TTL = 30_000;

export async function fetchTopStocksCached(count: number = 50): Promise<TVStockData[]> {
  if (stockCache && Date.now() - stockCache.timestamp < CACHE_TTL) {
    return stockCache.data;
  }
  const data = await fetchTopStocks(count);
  stockCache = { data, timestamp: Date.now() };
  return data;
}

export function invalidateStockCache() {
  stockCache = null;
}
