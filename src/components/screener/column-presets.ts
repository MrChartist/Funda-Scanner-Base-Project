// src/components/screener/column-presets.ts — quick column sets. A preset is just a list of metric
// columns, so it travels in the URL (?cols=) exactly like columns picked one by one.
import type { ColumnSpec, MetricStore } from "@/lib/contracts";

export interface ColumnPreset {
  id: string;
  label: string;
  hint: string;
  metrics: readonly string[];
}

export const COLUMN_PRESETS: readonly ColumnPreset[] = [
  { id: "overview", label: "Overview", hint: "Size, price, returns and debt only", metrics: [] },
  { id: "valuation", label: "Valuation", hint: "How the price compares with earnings, assets and cash", metrics: ["pb", "ev_ebitda", "earnings_yield", "fcf_yield", "price_to_sales", "peg"] },
  { id: "quality", label: "Quality", hint: "Returns, margins and the Piotroski score", metrics: ["roce_avg_5y", "roic", "opm", "npm", "piotroski_f", "interest_coverage"] },
  { id: "growth", label: "Growth", hint: "Sales and profit growth over several horizons", metrics: ["sales_cagr_5y", "net_profit_cagr_5y", "sales_growth", "profit_growth", "q_sales_yoy", "q_profit_yoy"] },
  { id: "balance", label: "Balance sheet", hint: "Debt, liquidity and cover", metrics: ["net_debt_equity", "net_debt_ebitda", "current_ratio", "interest_coverage", "total_debt", "net_worth"] },
  { id: "cashflow", label: "Cash flow", hint: "Cash from operations, free cash flow and conversion", metrics: ["cfo", "fcf", "cfo_to_pat", "cum_cfo_to_pat_5y", "capex_to_sales", "fcf_yield"] },
];

/** The preset as column specs, skipping any metric the loaded data does not define. */
export function presetColumns(preset: ColumnPreset, store: MetricStore): ColumnSpec[] | null {
  const out = preset.metrics.filter((id) => store.def(id)).map((id): ColumnSpec => ({ kind: "metric", id }));
  return out.length === 0 ? null : out;
}

/** Which preset the current columns equal, or null. Null columns count as Overview. */
export function activePreset(columns: readonly ColumnSpec[] | null, store: MetricStore): string | null {
  const ids = (columns ?? []).map((c) => (c.kind === "metric" ? c.id : `expr:${c.expr}`));
  for (const p of COLUMN_PRESETS) {
    const want = (presetColumns(p, store) ?? []).map((c) => (c.kind === "metric" ? c.id : ""));
    if (want.length === ids.length && want.every((id, i) => id === ids[i])) return p.id;
  }
  return null;
}
