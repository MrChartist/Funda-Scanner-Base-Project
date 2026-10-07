// Loose performance check (spec §E.5): 5,000 companies, 30 columns, under 2.5 s in CI.
// The strict budgets live in src/test/perf (WS8) and run with PERF=1.
import { describe, expect, it } from "vitest";
import { generateDataset } from "@/test/fixtures/metrics/generate";
import { createMetricStore } from "./store";

const COLUMNS = [
  "market_cap", "pe", "pb", "roce", "roe", "roce_avg_5y", "sales_cagr_5y", "net_profit_cagr_5y", "debt_equity",
  "interest_coverage", "current_ratio", "opm", "npm", "sales_growth", "profit_growth", "dividend_yield", "fcf_yield",
  "ev_ebitda", "earnings_yield", "peg", "eps", "bvps", "promoter_holding", "pledged_pct", "q_sales_yoy",
  "ttm_sales_growth", "piotroski_f", "altman_z", "cum_cfo_to_pat_5y", "opm_stdev_5y",
];

describe("performance (loose)", () => {
  it("builds a 5,000-company store and 30 default columns in under 2.5 s", () => {
    expect(COLUMNS).toHaveLength(30);
    const dataset = generateDataset({ count: 5000, seed: 5000 });
    // Simple wall-clock measurement through the performance API (allowed in tests; core code never reads the clock).
    const t0 = performance.now();
    const store = createMetricStore(dataset, { providers: [] });
    for (const id of COLUMNS) store.column(id);
    const ms = performance.now() - t0;
    console.info(`metrics perf: store + 30 columns for 5,000 companies in ${ms.toFixed(0)} ms`);
    expect(store.size).toBe(5000);
    expect(ms).toBeLessThan(2500);
  }, 30_000);
});
