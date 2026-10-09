// src/test/perf/budgets.test.ts — performance budgets (spec §G.5), 5,000 synthetic companies.
//
// Always runs with ceilings five times the target, so a real regression fails CI on any machine
// while a slow shared runner does not. `PERF=1 npm run test:perf` applies the strict targets
// (use a quiet local machine). Timings are always logged. Wall-clock reads are allowed in tests;
// core code never reads the clock.
import { beforeAll, describe, expect, it } from "vitest";
import type { FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { evaluateChecks, insightColumnProviders, summariseRedFlags } from "@/lib/insights";
import { explainAltman, explainPiotroski, createMetricStore } from "@/lib/metrics";
import { generateSampleDataset } from "@/lib/sample";
import { runScreen } from "@/lib/screen";
import { annualPeriods, quarterlyView, ratioView, shareholdingView, statementView } from "@/lib/views/company-view";

const STRICT = process.env.PERF === "1";
const FACTOR = STRICT ? 1 : 5;

/** Targets in milliseconds (spec §G.5). */
const TARGET = { build: 400, cold: 300, warm: 30, selectors: 50 } as const;

const COLUMNS_30 = [
  "market_cap", "pe", "pb", "roce", "roe", "roce_avg_5y", "sales_cagr_5y", "net_profit_cagr_5y", "debt_equity",
  "interest_coverage", "current_ratio", "opm", "npm", "sales_growth", "profit_growth", "dividend_yield", "fcf_yield",
  "ev_ebitda", "earnings_yield", "peg", "eps", "bvps", "promoter_holding", "pledged_pct", "q_sales_yoy",
  "ttm_sales_growth", "piotroski_f", "altman_z", "cum_cfo_to_pat_5y", "opm_stdev_5y",
];

/** Six clauses: windows, a streak count, a previous-period comparison, a peer function and plain ratios. */
const QUERY = [
  "every(roce > 12, 5y)",
  "count(sales_growth > 0, 5y) >= 4",
  "debt_equity < 1",
  "cum_cfo_to_pat_5y > 0.5",
  "opm >= opm_avg_5y - 3",
  "pe < industry_median(pe)",
].join("\n");

const timings: Record<string, number> = {};
let dataset: FundamentalsDataset;

function freshStore(): MetricStore {
  return createMetricStore(dataset, { providers: insightColumnProviders });
}

function ms(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

beforeAll(() => {
  const t0 = performance.now();
  dataset = generateSampleDataset({ count: 5000 });
  console.info(`perf: generated 5,000 synthetic companies in ${(performance.now() - t0).toFixed(0)} ms (not budgeted)`);
}, 120_000);

describe(`performance budgets (${STRICT ? "STRICT, PERF=1" : "loose, 5x targets"})`, () => {
  it("the stress set has 5,000 companies", () => {
    expect(dataset.companies).toHaveLength(5000);
    expect(dataset.companies[0].symbol).toBe("SYN0001");
    expect(COLUMNS_30).toHaveLength(30);
  });

  it(`store build plus 30 default columns < ${TARGET.build * FACTOR} ms`, () => {
    let store: MetricStore | undefined;
    const t = ms(() => {
      store = freshStore();
      for (const id of COLUMNS_30) store.column(id);
    });
    timings.build = t;
    console.info(`perf: store build + 30 columns, 5,000 companies: ${t.toFixed(0)} ms (target < ${TARGET.build})`);
    expect(store?.size).toBe(5000);
    expect(t).toBeLessThan(TARGET.build * FACTOR);
  }, 60_000);

  it(`cold 6-clause windowed query < ${TARGET.cold * FACTOR} ms, warm re-run < ${TARGET.warm * FACTOR} ms`, () => {
    const store = freshStore(); // nothing computed yet: every column the query needs is built inside the timing
    const input = { query: QUERY, columns: null, sort: null, universe: { kind: "all" as const } };
    const ctx = { watchlist: [], portfolio: [] };
    let first: ReturnType<typeof runScreen> | undefined;
    const cold = ms(() => {
      first = runScreen(store, input, ctx);
    });
    expect(first?.ok).toBe(true);
    expect(first?.compiled.clauses).toHaveLength(6);
    expect(first?.matchCount).toBeGreaterThan(0);
    const warmRuns = Array.from({ length: 7 }, () => ms(() => runScreen(store, input, ctx)));
    const warm = median(warmRuns);
    timings.cold = cold;
    timings.warm = warm;
    console.info(
      `perf: cold 6-clause windowed query: ${cold.toFixed(0)} ms (target < ${TARGET.cold}); warm re-run (median of 7): ${warm.toFixed(1)} ms (target < ${TARGET.warm}); ${first?.matchCount} matches`,
    );
    expect(cold).toBeLessThan(TARGET.cold * FACTOR);
    expect(warm).toBeLessThan(TARGET.warm * FACTOR);
  }, 60_000);

  it(`company page selectors, warm < ${TARGET.selectors * FACTOR} ms`, () => {
    const store = freshStore();
    const i = store.indexOf("SYN0001");
    const page = () => {
      evaluateChecks(store, i);
      summariseRedFlags(store, i);
      explainPiotroski(store, i);
      explainAltman(store, i);
      for (const s of ["pnl", "balance_sheet", "cash_flow"] as const) statementView(store, i, s);
      ratioView(store, i);
      quarterlyView(store, i);
      shareholdingView(store, i);
      annualPeriods(store, i);
      store.peers(i, "industry", 10);
      for (const id of ["roce", "pe", "debt_equity", "sales_cagr_5y", "opm"]) store.peerStat(id, i, "industry");
    };
    const first = ms(page); // warms the columns this one company needs
    const warm = median(Array.from({ length: 7 }, () => ms(page)));
    timings.selectors = warm;
    console.info(`perf: company selectors, first (cold) ${first.toFixed(0)} ms; warm (median of 7): ${warm.toFixed(1)} ms (target < ${TARGET.selectors})`);
    expect(warm).toBeLessThan(TARGET.selectors * FACTOR);
  }, 60_000);

  it("prints a summary", () => {
    console.info(`perf summary (${STRICT ? "strict" : "loose"}): ${JSON.stringify(Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v * 10) / 10])))}`);
    expect(Object.keys(timings).length).toBe(4);
  });
});
