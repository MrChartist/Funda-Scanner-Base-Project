// src/lib/contracts/legacy.ts
// v0 snapshot row: one row per company. Used by the original Screener, the legacy
// CSV/JSON import and third-party providers that implement only getUniverse().
// Missing numbers are NaN (legacy convention). New code creates StockRow values only
// in the legacy adapter (data/providers/legacy-adapter.ts) and metrics/legacy-row.ts.

export interface StockRow {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  /** Market cap in ₹ crore */
  market_cap: number;
  /** Last close in ₹ (a reference input for valuation, not a live quote) */
  price: number;
  pe: number;
  eps: number;
  price_book: number;
  roe: number;
  roce: number;
  debt_equity: number;
  debt_ebitda: number;
  dividend_yield: number;
  sales_growth: number;
  profit_growth: number;
  fcf_yield: number;
}

export type LegacyNumericKey = Exclude<keyof StockRow, "symbol" | "name" | "sector" | "industry">;

/**
 * Legacy StockRow key → v1 metric id. "price" maps to MarketInputs.price;
 * "market_cap" maps to MarketInputs.market_cap_supplied; every other key lands in
 * CompanyRecord.snapshot under the metric id on the right.
 */
export const LEGACY_KEY_TO_METRIC: Readonly<Record<LegacyNumericKey, string>> = {
  market_cap: "market_cap",
  price: "price",
  pe: "pe",
  eps: "eps",
  price_book: "pb",
  roe: "roe",
  roce: "roce",
  debt_equity: "debt_equity",
  debt_ebitda: "debt_ebitda",
  dividend_yield: "dividend_yield",
  sales_growth: "sales_growth",
  profit_growth: "profit_growth",
  fcf_yield: "fcf_yield",
};
