import { useState, useCallback, useRef, useEffect } from "react";
import { MOCK_COMPANIES } from "@/lib/mock-data";

interface PriceTick {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: number;
}

type TickCallback = (ticks: Map<string, PriceTick>) => void;

class PriceSimulator {
  private prices: Map<string, PriceTick> = new Map();
  private interval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<TickCallback> = new Set();

  constructor() {
    MOCK_COMPANIES.forEach((c) => {
      this.prices.set(c.symbol, {
        symbol: c.symbol,
        price: c.price,
        change: c.price * c.change_pct / 100,
        changePct: c.change_pct,
        volume: Math.floor(1000000 + Math.random() * 5000000),
        timestamp: Date.now(),
      });
    });
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      // Update 3-5 random stocks per tick
      const count = 3 + Math.floor(Math.random() * 3);
      const symbols = Array.from(this.prices.keys());
      for (let i = 0; i < count; i++) {
        const sym = symbols[Math.floor(Math.random() * symbols.length)];
        const tick = this.prices.get(sym)!;
        const delta = (Math.random() - 0.48) * tick.price * 0.002;
        const newPrice = +(tick.price + delta).toFixed(2);
        const base = MOCK_COMPANIES.find((c) => c.symbol === sym)!.price;
        const change = +(newPrice - base).toFixed(2);
        this.prices.set(sym, {
          symbol: sym,
          price: newPrice,
          change,
          changePct: +((change / base) * 100).toFixed(2),
          volume: tick.volume + Math.floor(Math.random() * 50000),
          timestamp: Date.now(),
        });
      }
      this.listeners.forEach((cb) => cb(new Map(this.prices)));
    }, 2000);
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
    cb(new Map(this.prices));
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) this.stop();
    };
  }

  getSnapshot() {
    return new Map(this.prices);
  }
}

// Singleton
const simulator = new PriceSimulator();

export function useLivePrices() {
  const [prices, setPrices] = useState<Map<string, PriceTick>>(() => simulator.getSnapshot());

  useEffect(() => {
    return simulator.subscribe(setPrices);
  }, []);

  const getPrice = useCallback((symbol: string) => prices.get(symbol), [prices]);

  return { prices, getPrice };
}

export function LiveMarketIndicator() {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <div className={`h-1.5 w-1.5 rounded-full transition-opacity duration-700 ${pulse ? "bg-chart-green opacity-100" : "bg-chart-green opacity-30"}`} />
      <span className="font-mono">LIVE</span>
    </div>
  );
}
