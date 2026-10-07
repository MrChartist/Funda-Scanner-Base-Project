import { describe, expect, it } from "vitest";
import type { MetricStore, MetricValue } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { ASSUMED_ZERO_TEXT, computeDataHealth, MISMATCH_THRESHOLD_PCT } from "./health";

function storeWith(edit: (ds: ReturnType<typeof createTinyDataset>) => void): MetricStore {
  const ds = createTinyDataset();
  edit(ds);
  return createStore(ds);
}

/** The same store with get() answers replaced for some metric ids. */
function withValues(store: MetricStore, values: Record<string, MetricValue>): MetricStore {
  return { ...store, get: (id: string, i: number) => values[id] ?? store.get(id, i) };
}

describe("computeDataHealth (acceptance)", () => {
  it("lists every zero-default assumption with the number of years", () => {
    const store = storeWith((ds) => {
      const mfg = ds.companies[0];
      mfg.annual[5].lease_liabilities = null;
      mfg.annual[6].lease_liabilities = null;
      mfg.annual[6].other_income = null;
    });
    const h = computeDataHealth(store, store.indexOf("TINYMFG"));
    expect(h.assumedZero).toEqual([{ field: "other_income", years: 1 }, { field: "lease_liabilities", years: 2 }]);
    expect(ASSUMED_ZERO_TEXT.lease_liabilities).toBe("Lease liabilities not provided; treated as 0 in debt.");
    for (const f of ["other_income", "exceptional_items", "non_controlling_interest", "lease_liabilities", "current_investments"]) {
      expect(ASSUMED_ZERO_TEXT[f]).toMatch(/treated as 0/);
    }
    const clean = createStore(createTinyDataset());
    expect(computeDataHealth(clean, clean.indexOf("TINYMFG")).assumedZero).toEqual([]);
  });

  it("reports a provided value that differs from the derived one by more than 5%", () => {
    // TINYMFG FY26 revenue is 1,760 in the statements; the file also supplied 2,000.
    const store = storeWith((ds) => {
      ds.companies[0].snapshot = { sales: 2000 };
    });
    const i = store.indexOf("TINYMFG");
    expect(store.get("sales", i)).toMatchObject({ v: 1760 });
    const h = computeDataHealth(store, i);
    expect(h.mismatches).toEqual([{ metric: "sales", provided: 2000, derived: 1760, pctDiff: 13.6 }]);
  });

  it("ignores differences of 5% or less, and values that only the file provides", () => {
    const store = storeWith((ds) => {
      ds.companies[0].snapshot = { sales: 1760 * 1.05, total_assets: 1724.41 };
    });
    expect(computeDataHealth(store, store.indexOf("TINYMFG")).mismatches).toEqual([]);
    const snap = createStore(createTinyDataset());
    // TINYSNAP has only provided values: nothing is derived, so nothing is compared.
    expect(computeDataHealth(snap, snap.indexOf("TINYSNAP")).mismatches).toEqual([]);
    expect(MISMATCH_THRESHOLD_PCT).toBe(5);
  });

  it("compares derived ratios and the supplied market cap through the store", () => {
    const base = storeWith((ds) => {
      ds.companies[0].snapshot = { pe: 30, unknown_metric: 5 };
      ds.companies[0].market.market_cap_supplied = 5000;
    });
    const store = withValues(base, {
      pe: { v: 24, reason: null, flags: 0 },
      market_cap: { v: 4200, reason: null, flags: 0 },
    });
    const h = computeDataHealth(store, store.indexOf("TINYMFG"));
    expect(h.mismatches).toEqual([
      { metric: "pe", provided: 30, derived: 24, pctDiff: 25 },
      { metric: "market_cap", provided: 5000, derived: 4200, pctDiff: 19 },
    ]);
    const provided = withValues(base, { pe: { v: 30, reason: null, flags: VF.Provided }, market_cap: { v: 5000, reason: null, flags: VF.Provided } });
    expect(computeDataHealth(provided, provided.indexOf("TINYMFG")).mismatches).toEqual([]);
  });

  it("summarises coverage, gaps, type inference, snapshot-only state and missing inputs", () => {
    const store = storeWith((ds) => {
      ds.companies[0].annual[6].total_assets = null;
      ds.companies[0].annual[6].capex = null;
    });
    const mfg = computeDataHealth(store, store.indexOf("TINYMFG"));
    expect(mfg.years).toEqual({ first: 2020, last: 2026, count: 7, gaps: [] });
    expect(mfg.quarters).toEqual({ count: 9, last: "2026-06-30" });
    expect(mfg.shareholding).toEqual({ count: 13, last: "2026-06-30" });
    expect(mfg.missingRequired).toEqual([{ period: "FY26", fields: ["total_assets", "capex"] }]);
    expect(mfg.snapshotOnly).toBe(false);
    expect(mfg.typeInferred).toBe(false);

    const neu = computeDataHealth(store, store.indexOf("TINYNEW"));
    expect(neu.years.gaps).toEqual([2024]);
    expect(neu.issues.map((x) => x.code)).toContain("W108_GAP_YEAR");

    const snap = computeDataHealth(store, store.indexOf("TINYSNAP"));
    expect(snap.snapshotOnly).toBe(true);
    expect(snap.years).toEqual({ first: null, last: null, count: 0, gaps: [] });
    expect(snap.quarters).toEqual({ count: 0, last: null });

    const bank = computeDataHealth(store, store.indexOf("TINYBANK"));
    expect(bank.typeInferred).toBe(true);
    expect(bank.missingRequired).toEqual([]); // required list applies to non-financial companies
    expect(bank.issues.map((x) => x.code)).toContain("I001_TYPE_INFERRED");
  });
});
