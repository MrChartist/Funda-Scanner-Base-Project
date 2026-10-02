// Data-provider contract for fundamentals. The UI only talks to this module, so any
// source (your own API, a CSV/JSON import, a database) can be plugged in by
// implementing `DataProvider` and calling `setDataProvider()` at start-up.
//
// Fundamentals only: no live prices, no price-action fields.

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

export type MetricKey = keyof Pick<
  StockRow,
  | "market_cap" | "price" | "pe" | "eps" | "price_book" | "roe" | "roce"
  | "debt_equity" | "debt_ebitda" | "dividend_yield" | "sales_growth" | "profit_growth" | "fcf_yield"
>;

export type MetricCategory = "Valuation" | "Profitability" | "Leverage" | "Growth";

export interface MetricDef {
  key: MetricKey;
  label: string;
  category: MetricCategory;
  /** Unit hint shown in the filter input */
  unit: string;
}

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

export type Operator = "gt" | "lt" | "between" | "eq";

export interface FilterCondition {
  metric: MetricKey;
  operator: Operator;
  value: number;
  /** Upper bound for "between" */
  value2?: number;
}

export type SortKey = keyof StockRow;

export interface ScreenQuery {
  filters: FilterCondition[];
  sortKey?: SortKey;
  sortDir?: "asc" | "desc";
  limit?: number;
}

export interface DataProvider {
  id: string;
  name: string;
  /** True when the data is synthetic, so the UI can say so. */
  isDemo: boolean;
  /** Return the full universe of companies with their fundamentals. */
  getUniverse(): Promise<StockRow[]>;
}

/** Pure, provider-independent screening: AND of all conditions, then sort, then limit. */
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

// ─── Active provider ───────────────────────────────────────────────
import { demoProvider } from "./demo-provider";

let activeProvider: DataProvider = demoProvider;
const listeners = new Set<() => void>();

export function getDataProvider(): DataProvider {
  return activeProvider;
}

export function setDataProvider(provider: DataProvider) {
  activeProvider = provider;
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore: re-render when the provider changes. */
export function subscribeDataProvider(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Provider backed by a fixed list of rows (e.g. a user's imported file). */
export function createStaticProvider(id: string, name: string, rows: StockRow[]): DataProvider {
  return { id, name, isDemo: false, async getUniverse() { return rows; } };
}

// ─── Persisting an imported dataset (browser only) ─────────────────
const STORAGE_KEY = "funda-imported-data";

// JSON cannot hold NaN, so missing numbers are stored as null.
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

export function clearImportedData() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  setDataProvider(demoProvider);
}
