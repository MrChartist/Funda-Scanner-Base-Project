// src/lib/sample/calibration.test.ts — archetype calibration against the REAL metrics engine (§E.4).
// The generator's own tests (sample.test.ts) check intent with local arithmetic; this file checks
// that the same intent survives the metric definitions, period rules and null reasons of
// src/lib/metrics and the §C.9 red-flag rules evaluated through FSQL.
import { describe, expect, it } from "vitest";
import { NULL_REASONS } from "@/lib/contracts";
import { validateDataset } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { triggeredRedFlags } from "@/test/fixtures/sample/red-flags";
import { type Archetype, generateSampleDataset, samplePlans } from "./index";

const DS = generateSampleDataset();
const STORE = createStore(DS);
const PLANS = samplePlans();
const FLAGS = triggeredRedFlags(STORE);
const NAF = NULL_REASONS.indexOf("not_applicable_financial");

const indicesOf = (a: Archetype) => PLANS.flatMap((p, i) => (p.entry.archetype === a ? [i] : []));
const value = (id: string, i: number) => {
  const col = STORE.column(id);
  return col.reasons[i] === 0 ? col.values[i] : null;
};

describe("sample calibration on the real metrics engine (§E.4)", () => {
  it("the dataset and the store line up with the roster", () => {
    expect(STORE.size).toBe(150);
    PLANS.forEach((p, i) => expect(STORE.company(i).symbol).toBe(p.symbol));
  });

  it("validateDataset reports no errors on the sample", () => {
    expect(validateDataset(DS).filter((x) => x.level === "error")).toEqual([]);
  });

  it("compounders have roce_avg_5y above 15%, and sales and profit CAGRs above 10%", () => {
    const compounders = indicesOf("compounder");
    expect(compounders).toHaveLength(14);
    for (const i of compounders) {
      const sym = STORE.company(i).symbol;
      expect(value("roce_avg_5y", i), sym).toBeGreaterThan(15);
      expect(value("sales_cagr_5y", i), sym).toBeGreaterThan(10);
      expect(value("net_profit_cagr_5y", i), sym).toBeGreaterThan(10);
      expect(value("debt_equity", i), sym).toBeLessThan(0.5);
    }
  });

  it("red-flag cases trigger the flag they were built for", () => {
    const expected: [Archetype, string][] = [["rf_receivables", "RF-02"], ["rf_pledge", "RF-03"], ["rf_cash", "RF-01"]];
    for (const [archetype, flag] of expected) {
      const idx = indicesOf(archetype);
      expect(idx, archetype).toHaveLength(2);
      for (const i of idx) expect(FLAGS[i], `${STORE.company(i).symbol} (${archetype})`).toContain(flag);
    }
  });

  it("raw patterns behind the red-flag cases are visible in the metrics", () => {
    for (const i of indicesOf("rf_receivables")) {
      const now = value("debtor_days", i);
      const before = STORE.columnAt("debtor_days", { freq: "fy", offset: 3 }).values[i];
      expect(now! / before).toBeGreaterThan(1.3);
      expect(value("sales_cagr_3y", i)).toBeLessThan(10);
    }
    for (const i of indicesOf("rf_cash")) expect(value("cum_cfo_to_pat_5y", i)).toBeLessThan(0.7);
    for (const i of indicesOf("rf_pledge")) expect(value("pledged_pct", i)).toBeGreaterThan(25);
  });

  it("at least 70% of non-financial companies have at most one red flag", () => {
    const nf = PLANS.flatMap((_, i) => (STORE.family(i) === "non_financial" ? [i] : []));
    expect(nf).toHaveLength(122);
    const healthy = nf.filter((i) => FLAGS[i].length <= 1).length;
    expect(healthy / nf.length).toBeGreaterThanOrEqual(0.7);
  });

  it("cash-rich companies show no_interest_cost for interest coverage", () => {
    const nic = NULL_REASONS.indexOf("no_interest_cost");
    const col = STORE.column("interest_coverage");
    for (const i of indicesOf("cash_rich")) expect(col.reasons[i], STORE.company(i).symbol).toBe(nic);
  });

  it("negative net worth and loss-makers carry the matching flags", () => {
    for (const i of indicesOf("negative_net_worth")) expect(FLAGS[i]).toContain("RF-07");
    for (const i of indicesOf("loss_maker")) expect(value("net_profit_ttm", i) ?? value("net_profit", i)).toBeLessThan(0);
  });

  it("lenders and insurers get not_applicable_financial for ROCE; lenders have NPA metrics", () => {
    const roce = STORE.column("roce");
    const gnpa = STORE.column("gnpa_ratio");
    let lenders = 0;
    for (let i = 0; i < STORE.size; i++) {
      const family = STORE.family(i);
      if (family === "non_financial") continue;
      expect(roce.reasons[i], STORE.company(i).symbol).toBe(NAF);
      if (family === "lender") {
        lenders++;
        expect(gnpa.reasons[i], STORE.company(i).symbol).toBe(0);
      }
    }
    expect(lenders).toBe(24);
  });

  it("good banks have lower GNPA than stressed banks on average", () => {
    const avg = (a: Archetype) => {
      const v = indicesOf(a).map((i) => value("gnpa_ratio", i)!);
      return v.reduce((s, x) => s + x, 0) / v.length;
    };
    expect(avg("good_bank")).toBeLessThan(avg("stressed_bank"));
  });
});
