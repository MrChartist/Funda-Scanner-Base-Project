// src/test/integration/templates-sample.test.ts — §G.4 #1 and §D.13: every template compiles on the
// real engine and returns 3–25 matches on the 150-company sample.
// Until the insights module registers its red_flag_count provider, the "value" template's
// red_flag_count clause is fed by the test-only provider in fixtures/sample/red-flags.ts, which
// evaluates the §C.9 red-flag rules verbatim through FSQL.
import { describe, expect, it } from "vitest";
import type { MetricStore } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { insightColumnProviders } from "@/lib/insights";
import { createMetricStore } from "@/lib/metrics";
import { compileQuery } from "@/lib/query";
import { generateSampleDataset, samplePlans } from "@/lib/sample";
import { TEMPLATES, runScreen } from "@/lib/screen";
import { testRedFlagCountProvider } from "@/test/fixtures/sample/red-flags";

const DS = generateSampleDataset();
const PLANS = samplePlans();
const hasRealRedFlags = insightColumnProviders.some((p) => p.ids.includes("red_flag_count"));
const STORE: MetricStore = hasRealRedFlags ? createStore(DS) : createMetricStore(DS, { providers: [testRedFlagCountProvider] });
const CTX = { watchlist: [], portfolio: [] };

function run(query: string) {
  return runScreen(STORE, { query, columns: null, sort: null, universe: { kind: "all" } }, CTX);
}
const archetypeOf = (i: number) => PLANS[i].entry.archetype;

describe("templates on the sample (§G.4 #1)", () => {
  for (const t of TEMPLATES) {
    it(`${t.id} compiles without errors and returns 3–25 matches`, () => {
      const compiled = compileQuery(t.query, STORE);
      expect(compiled.issues.filter((x) => x.level === "error")).toEqual([]);
      const r = run(t.query);
      expect(r.ok).toBe(true);
      expect(r.matched.length, `${t.id}: ${r.matched.length} matches`).toBeGreaterThanOrEqual(3);
      expect(r.matched.length, `${t.id}: ${r.matched.length} matches`).toBeLessThanOrEqual(25);
    });
  }

  it("every compounder passes Quality, and no red-flag case does", () => {
    const r = run(TEMPLATES.find((t) => t.id === "quality")!.query);
    const matched = new Set(r.matched);
    PLANS.forEach((p, i) => {
      if (p.entry.archetype === "compounder") expect(matched.has(i), p.symbol).toBe(true);
      if (p.entry.archetype.startsWith("rf_")) expect(matched.has(i), p.symbol).toBe(false);
    });
  });

  it("the Lenders template returns only lenders", () => {
    const r = run(TEMPLATES.find((t) => t.id === "lenders")!.query);
    for (const i of r.matched) expect(STORE.family(i), STORE.company(i).symbol).toBe("lender");
  });

  it("the Turnaround template finds the turnaround companies", () => {
    const r = run(TEMPLATES.find((t) => t.id === "turnaround")!.query);
    expect([...r.matched].filter((i) => archetypeOf(i) === "turnaround").length).toBeGreaterThanOrEqual(3);
  });

  it("the Dividend template finds every dividend payer", () => {
    const r = run(TEMPLATES.find((t) => t.id === "dividend")!.query);
    const matched = new Set(r.matched);
    PLANS.forEach((p, i) => {
      if (p.entry.archetype === "dividend_payer") expect(matched.has(i), p.symbol).toBe(true);
    });
  });

  it("a ROCE query reports the lenders and insurers as skipped (§G.4 #7)", () => {
    const r = run("roce > 15");
    const skipped = r.skipped.reduce((s, g) => s + g.count, 0);
    expect(skipped).toBeGreaterThanOrEqual(28);
  });

  it("representative FSQL queries run on the real store with sensible counts", () => {
    for (const q of [
      "roce > 20 AND debt_equity < 0.5",
      "pe < industry_median(pe) AND roe > 15",
      "avg(roce, 5y) > 20",
      "every(roce > 15, 5y)",
      "sales_cagr_5y > 15 AND is non_financial",
      "pctl(roce) > 75",
    ]) {
      const r = run(q);
      expect(r.ok, q).toBe(true);
      expect(r.compiled.issues.filter((x) => x.level === "error"), q).toEqual([]);
      if (process.env.SHOW_COUNTS) console.log(`${r.matchCount}\t${q}`);
      expect(r.matchCount, q).toBeGreaterThan(0);
      expect(r.matchCount, q).toBeLessThan(150);
    }
    // avg(roce, 5y) and the roce_avg_5y column agree exactly (§C.5 variant equivalence).
    expect(run("avg(roce, 5y) > 20").matchCount).toBe(run("roce_avg_5y > 20").matchCount);
  });
});
