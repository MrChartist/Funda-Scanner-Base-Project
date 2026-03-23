import { useState, useCallback, useRef, useEffect } from "react";
import { fetchStocksBySymbols, fetchTopStocksCached, type TVStockData } from "@/lib/tradingview";

// Symbols we track — these are the ones in our app
const TRACKED_SYMBOLS = [
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "BHARTIARTL", "HINDUNILVR", "ITC", "SBIN", "BAJFINANCE",
  "LT", "KOTAKBANK", "MARUTI", "TITAN", "ASIANPAINT",
  "WIPRO", "SUNPHARMA", "TATAMOTORS", "HCLTECH", "ULTRACEMCO",
];

export interface PriceTick {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
  // Extra TradingView fields
  pe?: number;
  eps?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  sma50?: number;
  name?: string;
  sector?: string;
}

type TickCallback = (ticks: Map<string, PriceTick>) => void;

function tvToTick(tv: TVStockData): PriceTick {
  return {
    symbol: tv.symbol,
    price: tv.price,
    change: +(tv.price * tv.change_pct / 100).toFixed(2),
    changePct: tv.change_pct,
    volume: tv.volume,
    timestamp: Date.now(),
    pe: tv.pe,
    eps: tv.eps,
    marketCap: tv.market_cap,
    high52w: tv.high_52w,
    low52w: tv.low_52w,
    sma50: tv.sma50,
    name: tv.name,
    sector: tv.sector,
  };
}

class LivePriceService {
  private prices: Map<string, PriceTick> = new Map();
  private interval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<TickCallback> = new Set();
  private isLive = false;
  private fetchFailed = false;

  constructor() {
    // Initialize with empty map — will be populated on first fetch
  }

  private async fetchPrices() {
    try {
      const stocks = await fetchStocksBySymbols(TRACKED_SYMBOLS);
      stocks.forEach((tv) => {
        this.prices.set(tv.symbol, tvToTick(tv));
      });
      this.isLive = true;
      this.fetchFailed = false;
      this.listeners.forEach((cb) => cb(new Map(this.prices)));
    } catch (err) {
      console.warn("TradingView fetch failed, using cached data:", err);
      this.fetchFailed = true;
      // If we have no data at all, generate fallback
      if (this.prices.size === 0) {
        this.initFallback();
      }
    }
  }

  private initFallback() {
    // Fallback prices if API fails entirely
    const fallbackData: Record<string, [number, number]> = {
      RELIANCE: [1407.80, -0.47], TCS: [2383.80, -0.28], HDFCBANK: [744.15, -4.65],
      INFY: [1256.80, 0.07], ICICIBANK: [1222.70, -1.82], BHARTIARTL: [1720.80, 2.15],
      HINDUNILVR: [2640.90, -0.34], ITC: [465.20, 0.78], SBIN: [808.15, -0.92],
      BAJFINANCE: [8420.75, 1.67], LT: [3580.40, 0.23], KOTAKBANK: [2120.65, -0.45],
      MARUTI: [13450.30, 1.89], TITAN: [3610.20, -1.45], ASIANPAINT: [2920.50, 0.12],
      WIPRO: [520.80, -0.67], SUNPHARMA: [1650.40, 0.56], TATAMOTORS: [950.60, 2.34],
      HCLTECH: [1680.90, -0.23], ULTRACEMCO: [10750.25, 0.45],
    };
    Object.entries(fallbackData).forEach(([sym, [price, changePct]]) => {
      this.prices.set(sym, {
        symbol: sym, price, change: +(price * changePct / 100).toFixed(2),
        changePct, volume: Math.floor(1000000 + Math.random() * 5000000),
        timestamp: Date.now(),
      });
    });
    this.listeners.forEach((cb) => cb(new Map(this.prices)));
  }

  start() {
    if (this.interval) return;
    // Initial fetch
    this.fetchPrices();
    // Poll every 30 seconds (TradingView rate-friendly)
    this.interval = setInterval(() => this.fetchPrices(), 30_000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  subscribe(cb: TickCallback) {
    this.listeners.add(cb);
    if (this.listeners.size === 1) this.start();
    if (this.prices.size > 0) cb(new Map(this.prices));
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) this.stop();
    };
  }

  getSnapshot() {
    return new Map(this.prices);
  }

  getIsLive() {
    return this.isLive;
  }
}

// Singleton
const service = new LivePriceService();

export function useLivePrices() {
  const [prices, setPrices] = useState<Map<string, PriceTick>>(() => service.getSnapshot());

  useEffect(() => {
    return service.subscribe(setPrices);
  }, []);

  const getPrice = useCallback((symbol: string) => prices.get(symbol), [prices]);

  return { prices, getPrice, isLive: service.getIsLive() };
}

export function LiveMarketIndicator() {
  const [pulse, setPulse] = useState(true);
  const { isLive } = useLivePrices();

  useEffect(() => {
    const timer = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <div className={`h-1.5 w-1.5 rounded-full transition-opacity duration-700 ${
        pulse ? "bg-chart-green opacity-100" : "bg-chart-green opacity-30"
      }`} />
      <span className="font-mono">{isLive ? "LIVE" : "DELAYED"}</span>
    </div>
  );
}
