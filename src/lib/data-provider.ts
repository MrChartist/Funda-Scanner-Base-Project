// Legacy compatibility module (WS1, §B.12). New code imports from "@/lib/data" and "@/lib/contracts".
//
// What stays here: the v0 types (StockRow, DataProvider), the deprecated METRICS list and
// runScreen() used by the original Screener page, and thin wrappers over the data registry.
// Fundamentals only: no live prices, no price-action fields.

import type { StockRow } from "./contracts/legacy";
import type { DataProvider } from "./contracts/provider";
import { datasetFromStockRows } from "./data/providers/legacy-adapter";
import { clearImportedData as clearImportedDataset } from "./data";

export type { StockRow } from "./contracts/legacy";
export type { DataProvider } from "./contracts/provider";

/** @deprecated Use metric ids from the catalogue (`@/lib/metrics`). */
export type MetricKey = keyof Pick<
  StockRow,
  | "market_cap" | "price" | "pe" | "eps" | "price_book" | "roe" | "roce"
  | "debt_equity" | "debt_ebitda" | "dividend_yield" | "sales_growth" | "profit_growth" | "fcf_yield"
>;

/** @deprecated */
export type MetricCategory = "Valuation" | "Profitability" | "Leverage" | "Growth";

/** @deprecated Use MetricDef from `@/lib/contracts`. */
export interface MetricDef {
  key: MetricKey;
  label: string;
  category: MetricCategory;
  /** Unit hint shown in the filter input */
  unit: string;
}

/** @deprecated The 13 legacy snapshot metrics; the catalogue in `@/lib/metrics` replaces them. */
export const METRICS: MetricDef[] = [
  { key: "market_cap", label: "Market Cap", category: "Valuation", unit: "₹ Cr" },
  { key: "price", label: "Price", category: "Valuation", unit: "₹" },
  { key: "pe", label: "P/E Ratio", category: "Valuation", unit: "x" },
  { key: "eps", label: "EPS", category: "Valuation", unit: "₹" },
  { key: "price_book", label: "Price/Book", category: "Valuation", unit: "x" },
  { key: "fcf_yield", label: "FCF Yield", category: "Valuation", unit: "%" },
  { key: "dividend_yield", label: "Dividend Yield", category: "Valuation", unit: "%" },
  { key: "roce", label: "ROCE", category: "Profitability", unit: "%" },
  { key: "roe", label: "ROE", category: "Profitability", unit: "%" },
  { key: "debt_equity", label: "Debt/Equity", category: "Leverage", unit: "x" },
  { key: "debt_ebitda", label: "Debt/EBITDA", category: "Leverage", unit: "x" },
  { key: "sales_growth", label: "Sales Growth", category: "Growth", unit: "%" },
  { key: "profit_growth", label: "Profit Growth", category: "Growth", unit: "%" },
];

/** @deprecated */
export type Operator = "gt" | "lt" | "between" | "eq";

/** @deprecated Saved screens are FSQL text now (`@/lib/screen`). */
export interface FilterCondition {
  metric: MetricKey;
  operator: Operator;
  value: number;
  /** Upper bound for "between" */
  value2?: number;
}

/** @deprecated */
export type SortKey = keyof StockRow;

/** @deprecated */
export interface ScreenQuery {
  filters: FilterCondition[];
  sortKey?: SortKey;
  sortDir?: "asc" | "desc";
  limit?: number;
}

/**
 * Pure, provider-independent screening: AND of all conditions, then sort, then limit.
 * @deprecated Use runScreen from `@/lib/screen` (FSQL over the metric store).
 */
export function runScreen(rows: StockRow[], query: ScreenQuery): StockRow[] {
  const { filters, sortKey = "market_cap", sortDir = "desc", limit } = query;

  const matches = (row: StockRow) =>
    filters.every((f) => {
      const v = row[f.metric];
      if (typeof v !== "number" || !Number.isFinite(v)) return false;
      switch (f.operator) {
        case "gt": return v > f.value;
        case "lt": return v < f.value;
        case "eq": return v === f.value;
        case "between": {
          if (f.value2 === undefined) return false;
          const lo = Math.min(f.value, f.value2);
          const hi = Math.max(f.value, f.value2);
          return v >= lo && v <= hi;
        }
      }
    });

  const dir = sortDir === "asc" ? 1 : -1;
  const sorted = rows.filter(matches).sort((a, b) => {
    const x = a[sortKey];
    const y = b[sortKey];
    if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * dir;
    const xn = typeof x === "number" && Number.isFinite(x);
    const yn = typeof y === "number" && Number.isFinite(y);
    if (!xn || !yn) return xn === yn ? 0 : xn ? -1 : 1; // missing values always last
    return ((x as number) - (y as number)) * dir;
  });

  return limit ? sorted.slice(0, limit) : sorted;
}

// ─── Active provider (re-exported from the data registry) ───────────
export { getDataProvider, setDataProvider, subscribeDataProvider } from "./data/registry";

/**
 * Provider backed by a fixed list of legacy rows. It is a v2 provider (getDataset, through the
 * legacy adapter) that also keeps getUniverse() for v0 callers.
 */
export function createStaticProvider(id: string, name: string, rows: StockRow[]): DataProvider {
  return {
    id,
    name,
    isDemo: false,
    revision: 0,
    async getDataset() {
      return datasetFromStockRows(rows, { name, isSynthetic: false, source: "custom_provider" });
    },
    async getUniverse() {
      return rows;
    },
  };
}

// ─── Persisting an imported dataset (v0 key only) ──────────────────
const STORAGE_KEY = "funda-imported-data";

/**
 * Writes legacy rows to the v0 key. JSON cannot hold NaN, so missing numbers are stored as null.
 * @deprecated Use importFiles() and activateImportedDataset() from `@/lib/data`.
 */
export function saveImportedData(name: string, rows: StockRow[]): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name, rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" && !Number.isFinite(v) ? null : v]))) }),
    );
    return true;
  } catch {
    return false; // storage full or unavailable; data stays in memory for this session
  }
}

/**
 * Reads the v0 key as a provider, or null.
 * @deprecated restoreActiveProvider() in `@/lib/data` migrates this key once at start-up.
 */
export function loadImportedData(): DataProvider | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { name: string; rows: Record<string, unknown>[] };
    const rows = saved.rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? NaN : v])),
    ) as unknown as StockRow[];
    return rows.length ? createStaticProvider("imported", saved.name || "Imported data", rows) : null;
  } catch {
    return null;
  }
}

/** Forgets every imported dataset (all stored copies and the v0 key) and returns to the sample data. */
export function clearImportedData(): Promise<void> {
  return clearImportedDataset();
}
