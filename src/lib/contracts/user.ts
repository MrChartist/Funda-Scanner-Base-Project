// src/lib/contracts/user.ts — browser-local user data (localStorage via lib/user/storage.ts)

/** Every persisted value is wrapped so it can be migrated. */
export interface Envelope<T> {
  v: number;
  data: T;
}

export const STORAGE_KEYS = {
  activeSource: "funda-active-source",     // { v: 1, data: "sample" | "imported" }
  importedLegacy: "funda-imported-data",   // v0 StockRow storage; migrated once, then removed
  screens: "funda-screens",                // v0 FilterCondition[] → v2 SavedScreensFile
  followed: "funda-followed",              // v0 string[] → { v: 2, data: { symbols } }
  portfolio: "funda-portfolio",            // v0 PortfolioHolding[] → { v: 2, data: { holdings } }
  recent: "funda-recent",
  dashboardLayout: "funda-dashboard-layout",
  learnMode: "funda-learn-mode",
} as const;

export interface WatchlistData {
  symbols: string[];
}

export interface PortfolioHolding {
  symbol: string;
  qty: number;
  avgCost: number;         // ₹ per share
  buyDate: string;         // YYYY-MM-DD as entered by the user
}

export interface PortfolioData {
  holdings: PortfolioHolding[];
}
