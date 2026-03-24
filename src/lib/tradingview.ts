// TradingView Scanner API integration for real-time NSE stock data
// Uses Vite dev proxy to bypass CORS: /api/tv -> https://scanner.tradingview.com

const TRADINGVIEW_SCAN_URL = "/api/tv/india/scan";

const FIELDS = [
  "name",                        // 0  Ticker symbol
  "description",                 // 1  Company name
  "industry",                    // 2  Industry
  "sector",                      // 3  Sector
  "market_cap_basic",            // 4  Market Cap (in currency units)
  "currency",                    // 5  Currency
  "earnings_per_share_basic_ttm", // 6  EPS TTM
  "price_earnings_ttm",          // 7  P/E Ratio
  "close",                       // 8  Current Price
  "change",                      // 9  % change 1 day
  "volume",                      // 10 Volume 1 day
  "relative_volume_10d_calc",    // 11 Relative volume
  "average_volume_10d_calc",     // 12 Avg Volume 10d
  "High.All",                    // 13 52W high
  "Low.All",                     // 14 52W low
  "SMA10",                       // 15 SMA 10
  "SMA20",                       // 16 SMA 20
  "SMA50",                       // 17 SMA 50
  "return_on_equity",            // 18 ROE
  "return_on_invested_capital",  // 19 ROCE (ROIC)
  "debt_to_equity",              // 20 D/E
  "dividend_yield_recent",       // 21 Dividend Yield
  "revenue_growth_quarterly",    // 22 Sales Growth (QoQ)
  "earnings_growth_quarterly",   // 23 Profit Growth (QoQ)
  "price_book_fq",               // 24 P/B (Book Value proxy)
  "total_debt_to_ebitda",        // 25 Interest Coverage proxy
  "free_cash_flow_yield_ttm",    // 26 FCF Yield
];

export interface TVStockData {
  symbol: string;
  name: string;
  industry: string;
  sector: string;
  market_cap: number;
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
  roe: number;
  roce: number;
  debt_equity: number;
  dividend_yield: number;
  sales_growth: number;
  profit_growth: number;
  price_book: number;
  interest_coverage: number;
  fcf_yield: number;
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
    roe: +(d[18] || 0).toFixed(2),
    roce: +(d[19] || 0).toFixed(2),
    debt_equity: +(d[20] || 0).toFixed(2),
    dividend_yield: +(d[21] || 0).toFixed(2),
    sales_growth: +(d[22] || 0).toFixed(2),
    profit_growth: +(d[23] || 0).toFixed(2),
    price_book: +(d[24] || 0).toFixed(2),
    interest_coverage: +(d[25] || 0).toFixed(2),
    fcf_yield: +(d[26] || 0).toFixed(2),
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
