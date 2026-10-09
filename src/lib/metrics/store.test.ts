import { describe, expect, it } from "vitest";
import type { ColumnProvider, CompanyRecord, FundamentalsDataset, MetricColumn, MetricStore } from "@/lib/contracts";
import { NULL_REASONS, UnknownMetricError, VF } from "@/lib/contracts";
import { evaluateArithmetic } from "@/test/fixtures/metrics/arith";
import { TINY_EXPECTED, type TinyExpectation } from "@/test/fixtures/metrics/tiny-expected";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { createMetricStore } from "./store";
import { cagrWindow, windowAggregate, windowColumns } from "./series";
import { aggregateWindow, cagrColumn, emptyColumn, setValue, valueAt } from "./windows";
import { ALL_METRIC_DEFS } from "./variants";

const tiny = (): MetricStore => createMetricStore(createTinyDataset(), { providers: [] });
const store = tiny();
const idx = (s: string) => store.indexOf(s);

function checkExpectation(s: MetricStore, e: TinyExpectation): void {
  const i = s.indexOf(e.symbol);
  const v = e.sel ? s.at(e.id, i, e.sel) : s.get(e.id, i);
  const where = `${e.symbol} ${e.id}${e.sel ? `[${e.sel.freq}-${e.sel.offset}]` : ""}`;
  if (e.reason) {
    expect(v.v, where).toBeNull();
    expect(v.reason, where).toBe(e.reason);
  } else {
    const expected = evaluateArithmetic(e.arithmetic ?? "NaN");
    expect(v.reason, where).toBeNull();
    expect(Math.abs((v.v as number) - expected), `${where}: ${v.v} vs ${expected}`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(expected)));
  }
  if (e.flags) expect(v.flags & e.flags, `${where} flags`).toBe(e.flags);
}

describe("tiny-expected (§E.5)", () => {
  it("has about sixty values", () => {
    expect(TINY_EXPECTED.length).toBeGreaterThanOrEqual(60);
  });

  it.each(TINY_EXPECTED.map((e) => [`${e.symbol} ${e.id}${e.sel ? `[${e.sel.freq}-${e.sel.offset}]` : ""}`, e] as const))("%s", (_n, e) =>
    checkExpectation(store, e));

  it("covers every null reason the statements can produce", () => {
    const reasons = new Set(TINY_EXPECTED.map((e) => e.reason).filter(Boolean));
    for (const r of ["loss_making", "negative_net_worth", "no_interest_cost", "not_applicable_financial", "insufficient_history",
      "transition_period", "non_positive_denominator", "missing_input", "too_few_inputs"] as const) {
      expect(reasons.has(r), r).toBe(true);
    }
  });
});

describe("store basics", () => {
  it("indexes symbols case-insensitively and exposes companies, types and peer classes", () => {
    expect(store.size).toBe(6);
    expect(store.indexOf(" tinymfg ")).toBe(0);
    expect(store.indexOf("NOPE")).toBe(-1);
    expect(store.companyType(idx("TINYBANK"))).toEqual({ type: "bank", inferred: true });
    expect(store.family(idx("TINYBANK"))).toBe("lender");
    expect(store.peerClass(idx("TINYBANK"))).toBe("bank");
    expect(store.companyType(idx("TINYMFG"))).toEqual({ type: "non_financial", inferred: false });
    expect(store.industry(idx("TINYMFG"))).toBe("Industrial components");
    expect(store.sector(idx("TINYMFG"))).toBe("Capital goods");
    expect(store.modalLatestFy).toBe(2026);
    expect(store.defs()).toBe(ALL_METRIC_DEFS);
    expect(store.def("roce")?.label).toBe("Return on capital employed");
    expect(store.def("nope")).toBeUndefined();
    expect(store.meta.isSynthetic).toBe(true);
  });

  it("throws UnknownMetricError for ids that are neither catalogue nor provided", () => {
    expect(() => store.column("not_a_metric")).toThrow(UnknownMetricError);
    expect(() => store.columnAt("not_a_metric", { freq: "fy", offset: 0 })).toThrow(UnknownMetricError);
    expect(() => store.get("not_a_metric", 0)).toThrow(UnknownMetricError);
  });

  it("caches columns for the store's lifetime", () => {
    expect(store.column("roce")).toBe(store.column("roce"));
    expect(store.columnAt("roce", { freq: "fy", offset: 2 })).toBe(store.columnAt("roce", { freq: "fy", offset: 2 }));
    expect(store.columnAt("roce", { freq: "fy", offset: 0 })).toBe(store.column("roce"));
    expect(store.column("roce").id).toBe("roce");
  });

  it("is deterministic: two stores over equal datasets give identical typed arrays", () => {
    const a = tiny();
    const b = tiny();
    for (const def of ALL_METRIC_DEFS) {
      const ca = a.column(def.id);
      const cb = b.column(def.id);
      expect(Array.from(ca.reasons), def.id).toEqual(Array.from(cb.reasons));
      expect(Array.from(ca.flags), def.id).toEqual(Array.from(cb.flags));
      expect(Array.from(ca.values).map((v) => (Number.isNaN(v) ? "NaN" : v)), def.id)
        .toEqual(Array.from(cb.values).map((v) => (Number.isNaN(v) ? "NaN" : v)));
    }
    expect(a.key).toBe(b.key);
  });

  it("never returns NaN or Infinity, and a null always carries a reason", () => {
    for (const def of ALL_METRIC_DEFS) {
      for (let i = 0; i < store.size; i++) {
        const v = store.get(def.id, i);
        if (v.v === null) expect(v.reason, `${def.id} ${i}`).not.toBeNull();
        else {
          expect(Number.isFinite(v.v), `${def.id} ${i}`).toBe(true);
          expect(v.reason).toBeNull();
        }
      }
    }
  });

  it("changes the key when the data changes", () => {
    const ds = createTinyDataset();
    ds.companies[0].annual[0].revenue = 1;
    expect(createMetricStore(ds, { providers: [] }).key).not.toBe(store.key);
  });

  it("reports slots with holes counted and labels periods", () => {
    const n = idx("TINYNEW");
    expect(store.slots(n, "fy")).toBe(4); // FY26, FY25, (FY24 hole), FY23
    expect(store.slots(idx("TINYSOFT"), "q")).toBe(9); // Jun 24 … Jun 26 with Sep 25 a hole
    expect(store.slots(idx("TINYSNAP"), "fy")).toBe(0);
    expect(store.periodLabel(n, { freq: "fy", offset: 0 })).toBe("FY26");
    expect(store.periodLabel(n, { freq: "fy", offset: 2 })).toBeNull();
    expect(store.periodLabel(0, { freq: "q", offset: 0 })).toBe("Q1 FY27");
    expect(store.periodLabel(0, { freq: "ttm", offset: 0 })).toBe("TTM to Jun 2026");
    expect(store.periodLabel(0, { freq: "ttm", offset: 1 })).toBe("TTM to Jun 2025");
    expect(store.periodLabel(0, { freq: "ttm", offset: 3 })).toBeNull();
    expect(store.periodLabel(0, { freq: "fy", offset: -1 })).toBeNull();
  });

  it("measures coverage over applicable companies only", () => {
    expect(store.coverage("roce")).toEqual({ nonNull: 5, applicable: 5 }); // the bank is not applicable; TINYSNAP via snapshot
    expect(store.coverage("nii")).toEqual({ nonNull: 1, applicable: 1 });
    expect(store.coverage("pe")).toEqual({ nonNull: 5, applicable: 6 });
  });
});

describe("selectors", () => {
  it("returns no history for latest-only metrics at past periods and for mismatched frequencies", () => {
    const m = idx("TINYMFG");
    expect(store.at("pe", m, { freq: "fy", offset: 1 }).reason).toBe("insufficient_history");
    expect(store.at("roce", m, { freq: "q", offset: 0 }).reason).toBe("insufficient_history");
    expect(store.at("q_sales", m, { freq: "fy", offset: 0 }).reason).toBe("insufficient_history");
    expect(store.at("roce", m, { freq: "ttm", offset: 0 }).reason).toBe("insufficient_history"); // roce has no TTM form
    expect(store.at("roce", idx("TINYBANK"), { freq: "q", offset: 0 }).reason).toBe("not_applicable_financial");
    expect(store.at("pe", m, { freq: "ttm", offset: 0 })).toEqual(store.get("pe", m));
    expect(store.at("roce", m, { freq: "fy", offset: 1.5 }).reason).toBe("insufficient_history");
  });

  it("serves [prev] relative to the period asked for", () => {
    const m = idx("TINYMFG");
    expect(store.get("roce_prev", m)).toEqual(store.at("roce", m, { freq: "fy", offset: 1 }));
    expect(store.at("roce_prev", m, { freq: "fy", offset: 2 })).toEqual(store.at("roce", m, { freq: "fy", offset: 3 }));
    expect(store.get("q_sales_prev", m)).toEqual(store.at("q_sales", m, { freq: "q", offset: 1 }));
    expect(store.get("promoter_holding_prev", m).v).toBe(61.9);
  });

  it("serves windowed variants at past offsets", () => {
    const m = idx("TINYMFG");
    const at1 = store.at("opm_avg_3y", m, { freq: "fy", offset: 1 }).v as number;
    const expected = ((1600 - 1312) / 1600 + (1450 - 1200.6) / 1450 + (1335 - 1118.73) / 1335) / 3 * 100;
    expect(at1).toBeCloseTo(expected, 9);
    expect(store.at("sales_cagr_3y", m, { freq: "fy", offset: 3 }).v).toBeCloseTo(((1335 / 1000) ** (1 / 3) - 1) * 100, 9);
    expect(store.at("sales_cagr_3y", m, { freq: "fy", offset: 4 }).reason).toBe("insufficient_history");
  });
});

describe("TTM (§C.1)", () => {
  it("sums the four latest grid quarters", () => {
    const m = idx("TINYMFG");
    expect(store.get("sales_ttm", m).v).toBeCloseTo(448.8 + 466.4 + 457.6 + 431.2, 9);
    expect(store.get("sales_ttm", m).flags & VF.FyFallback).toBe(0);
  });

  it("falls back to the latest FY, flagged FyFallback, when a quarter is missing", () => {
    const s = idx("TINYSOFT");
    expect(store.get("sales_ttm", s)).toEqual({ v: 1300, reason: null, flags: VF.FyFallback });
    expect(store.get("net_profit_ttm", s)).toEqual({ v: 228.78, reason: null, flags: VF.FyFallback });
    expect(store.get("eps_ttm", s).flags & VF.FyFallback).toBe(VF.FyFallback);
  });

  it("falls back when there is no quarterly block, and stays null for older blocks", () => {
    const l = idx("TINYLOSS");
    expect(store.get("sales_ttm", l)).toEqual({ v: 295, reason: null, flags: VF.FyFallback });
    expect(store.at("sales", l, { freq: "ttm", offset: 1 }).reason).toBe("insufficient_history");
  });

  it("does not use quarters that end before the latest financial year", () => {
    const ds = createTinyDataset();
    const mfg = ds.companies[0];
    mfg.quarterly = mfg.quarterly.filter((r) => r.period_end <= "2025-12-31"); // latest quarter Dec 25 < FY26 end
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("sales_ttm", 0)).toEqual({ v: 1760, reason: null, flags: VF.FyFallback });
  });

  it("does not mix quarters with a missing field into a TTM ratio", () => {
    const ds = createTinyDataset();
    ds.companies[0].quarterly[8].operating_expenses = null;
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("opm_ttm", 0).flags & VF.FyFallback).toBe(VF.FyFallback);
    expect(s.get("opm_ttm", 0).v).toBeCloseTo((1760 - 1439.68) / 1760 * 100, 9);
    expect(s.get("sales_ttm", 0).flags & VF.FyFallback).toBe(0); // revenue is complete
  });
});

describe("year-ago quarter by date (§C.1)", () => {
  it("matches the year-ago quarter by date when one quarter is missing", () => {
    const s = idx("TINYSOFT");
    // Grid: Jun 26 (0), Mar 26 (1), Dec 25 (2), Sep 25 hole (3), Jun 25 (4)
    expect(store.at("q_sales", s, { freq: "q", offset: 3 }).reason).toBe("missing_input");
    expect(store.at("q_sales", s, { freq: "q", offset: 4 }).v).toBe(312);
    expect(store.get("q_sales_yoy", s).v).toBeCloseTo((338 / 312 - 1) * 100, 9);
    // Dec 25 against Dec 24 (slot 6), not against position 4 of the raw array
    expect(store.at("q_sales_yoy", s, { freq: "q", offset: 2 }).v).toBeCloseTo((331.5 / 303.45 - 1) * 100, 9);
    // Sep 25 is a hole, so its YoY is missing; Mar 26's year-ago quarter is Mar 25
    expect(store.at("q_sales_yoy", s, { freq: "q", offset: 3 }).reason).toBe("missing_input");
    expect(store.at("q_sales_yoy", s, { freq: "q", offset: 1 }).v).toBeCloseTo((331.5 / 303.45 - 1) * 100, 9);
  });

  it("tolerates period ends a few days off the month end (±15 days)", () => {
    const ds = createTinyDataset();
    const mfg = ds.companies[0];
    mfg.quarterly = mfg.quarterly.map((r) => (r.period_end === "2025-06-30" ? { ...r, period_end: "2025-06-24" } : r));
    const s = createMetricStore(ds, { providers: [] });
    expect(s.at("q_sales", 0, { freq: "q", offset: 4 }).v).toBe(404.8);
    expect(s.get("q_sales_yoy", 0).v).toBeCloseTo((448.8 / 404.8 - 1) * 100, 9);
  });

  it("never shifts data into a hole when a quarter is far off the grid", () => {
    const ds = createTinyDataset();
    const mfg = ds.companies[0];
    mfg.quarterly = mfg.quarterly.map((r) => (r.period_end === "2025-06-30" ? { ...r, period_end: "2025-05-10" } : r));
    const s = createMetricStore(ds, { providers: [] });
    expect(s.at("q_sales", 0, { freq: "q", offset: 4 }).reason).toBe("missing_input");
    expect(s.get("q_sales_yoy", 0).reason).toBe("insufficient_history");
  });
});

describe("snapshot values (derived values win)", () => {
  it("fills only gaps and flags them Provided", () => {
    const ds = createTinyDataset();
    ds.companies[0].snapshot = { roce: 99, pe: 1, gross_margin: 50 };
    ds.companies[1].snapshot = { gross_margin: 31.5 };
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("roce", 0).v).not.toBe(99); // derived wins
    expect(s.get("pe", 0).v).not.toBe(1);
    expect(s.get("gross_margin", 1)).toEqual({ v: 31.5, reason: null, flags: VF.Provided }); // gap filled
    expect(s.at("gross_margin", 1, { freq: "fy", offset: 1 }).reason).toBe("missing_input"); // past years are never filled
  });

  it("does not fill not-applicable or not-meaningful values", () => {
    const ds = createTinyDataset();
    ds.companies[2].snapshot = { roce: 12 };
    ds.companies[3].snapshot = { pe: 5 };
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("roce", 2).reason).toBe("not_applicable_financial");
    expect(s.get("pe", 3).reason).toBe("loss_making");
  });
});

describe("column providers", () => {
  it("serves provided ids through the provider and nothing else", () => {
    const provider: ColumnProvider = {
      ids: ["red_flag_count", "x_custom"],
      compute(s, id) {
        const col = emptyColumn(id, s.size);
        for (let i = 0; i < s.size; i++) setValue(col, i, i);
        return col;
      },
    };
    const s = createMetricStore(createTinyDataset(), { providers: [provider] });
    expect(s.get("red_flag_count", 3).v).toBe(3);
    expect(s.get("x_custom", 2).v).toBe(2);
    expect(s.at("x_custom", 2, { freq: "fy", offset: 1 }).reason).toBe("insufficient_history");
    expect(s.def("x_custom")).toBeUndefined();
    expect(store.get("red_flag_count", 0).reason).toBe("missing_input"); // no provider registered
  });
});

describe("variant equivalence with aggregateWindow and cagrColumn (§C.5)", () => {
  function same(a: MetricColumn, b: MetricColumn): void {
    expect(Array.from(a.reasons)).toEqual(Array.from(b.reasons));
    expect(Array.from(a.flags)).toEqual(Array.from(b.flags));
    for (let i = 0; i < a.values.length; i++) expect(Object.is(a.values[i], b.values[i]) || (Number.isNaN(a.values[i]) && Number.isNaN(b.values[i]))).toBe(true);
  }

  it("column('roce_avg_5y') equals avg(roce, 5y) exactly", () => {
    same(store.column("roce_avg_5y"), aggregateWindow("avg", windowColumns(store, "roce", 5), "x"));
    same(store.column("roce_avg_5y"), windowAggregate(store, "avg", "roce", 5));
    same(store.column("opm_stdev_5y"), aggregateWindow("stdev", windowColumns(store, "opm", 5), "x"));
    same(store.column("cfo_cum_5y"), aggregateWindow("sum", windowColumns(store, "cfo", 5), "x"));
    same(store.column("roce_min_5y"), aggregateWindow("min", windowColumns(store, "roce", 5), "x"));
  });

  it("column('sales_cagr_5y') equals cagr(sales, 5y) exactly", () => {
    same(store.column("sales_cagr_5y"), cagrWindow(store, "sales", 5));
    // Without transition years in the span, it is cagrColumn of the two ends.
    const ends = cagrColumn(store.column("sales"), store.columnAt("sales", { freq: "fy", offset: 5 }), 5, "x");
    expect(valueAt(store.column("sales_cagr_5y"), 0)).toEqual(valueAt(ends, 0));
  });

  it("window inputs mark restated and transition years", () => {
    const l = idx("TINYLOSS");
    const inputs = windowColumns(store, "sales", 3);
    expect(valueAt(inputs[2], l).reason).toBe("transition_period");
    expect(valueAt(inputs[1], l).v).toBe(310);
    expect(store.at("sales", l, { freq: "fy", offset: 2 }).v).toBe(330);
  });
});

describe("company-type inference flags", () => {
  it("flags restricted metrics of an inferred lender, but not NAF nulls or all-family metrics", () => {
    const b = idx("TINYBANK");
    expect(store.get("nii", b).flags & VF.InferredType).toBe(VF.InferredType);
    expect(store.get("roce", b)).toEqual({ v: null, reason: "not_applicable_financial", flags: 0 });
    expect(store.get("roe", b).flags & VF.InferredType).toBe(0);
  });
});

describe("null reasons", () => {
  it("only ever uses codes from NULL_REASONS", () => {
    for (const def of ALL_METRIC_DEFS) {
      const col = store.column(def.id);
      for (const r of col.reasons) expect(r).toBeLessThan(NULL_REASONS.length);
    }
  });
});

describe("edge cases", () => {
  function one(c: Partial<CompanyRecord>): FundamentalsDataset {
    const ds = createTinyDataset();
    ds.companies = [{ ...ds.companies[0], ...c }];
    return ds;
  }

  it("reports no price as no_price, and uses a supplied market cap only when price × shares is unavailable", () => {
    const base = createTinyDataset().companies[0];
    const s1 = createMetricStore(one({ market: { ...base.market, price: null } }), { providers: [] });
    expect(s1.get("market_cap", 0).reason).toBe("no_price");
    expect(s1.get("pe", 0).reason).toBe("no_price");
    expect(s1.get("dividend_yield", 0).reason).toBe("no_price");
    const s2 = createMetricStore(one({ market: { ...base.market, shares_outstanding: null, market_cap_supplied: 4000 } }), { providers: [] });
    expect(s2.get("market_cap", 0)).toEqual({ v: 4000, reason: null, flags: VF.Provided });
    expect(s2.get("pe", 0).flags & VF.Provided).toBe(VF.Provided);
    const s3 = createMetricStore(one({ market: { ...base.market, shares_outstanding: null } }), { providers: [] });
    expect(s3.get("market_cap", 0).reason).toBe("missing_input");
  });

  it("treats only ZERO_DEFAULT_FIELDS as 0, flagged AssumedZero", () => {
    const ds = createTinyDataset();
    const row = ds.companies[0].annual[6];
    row.lease_liabilities = null;
    row.other_income = null;
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("total_debt", 0)).toEqual({ v: 320, reason: null, flags: VF.AssumedZero });
    expect(s.get("ebit", 0).flags & VF.AssumedZero).toBe(VF.AssumedZero);
    expect(s.get("lease_liabilities", 0).reason).toBe("missing_input"); // the line itself is not invented
    row.borrowings_current = null;
    expect(createMetricStore(ds, { providers: [] }).get("total_debt", 0).reason).toBe("missing_input");
  });

  it("falls back to the market share count for per-share values, flagged Approximate", () => {
    const ds = createTinyDataset();
    ds.companies[0].annual[6].shares_outstanding_ye = null;
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("eps", 0)).toEqual({ v: 170.45 / 10, reason: null, flags: VF.Approximate });
  });

  it("flags payout above 100%", () => {
    const ds = createTinyDataset();
    ds.companies[0].annual[6].dividend_per_share = 30;
    const v = createMetricStore(ds, { providers: [] }).get("dividend_payout", 0);
    expect(v.v).toBeCloseTo(300 / 170.45 * 100, 9);
    expect(v.flags & VF.PayoutOver100).toBe(VF.PayoutOver100);
  });

  it("marks a turnaround in profit growth", () => {
    const ds = createTinyDataset();
    ds.companies[0].annual[5].net_profit_owners = -10;
    const v = createMetricStore(ds, { providers: [] }).get("profit_growth", 0);
    expect(v).toEqual({ v: null, reason: "non_positive_denominator", flags: VF.Turnaround });
  });

  it("gives ev_not_positive when spare cash exceeds market value plus debt", () => {
    const ds = createTinyDataset();
    ds.companies[1].market.price = 1; // TINYSOFT: market cap 50 against cash 360.61
    const s = createMetricStore(ds, { providers: [] });
    expect(s.get("ev_ebitda", 1).reason).toBe("ev_not_positive");
    expect(s.get("earnings_yield", 1).reason).toBe("ev_not_positive");
  });

  it("handles an empty dataset", () => {
    const ds = createTinyDataset();
    ds.companies = [];
    const s = createMetricStore(ds, { providers: [] });
    expect(s.size).toBe(0);
    expect(s.column("roce_avg_5y").values.length).toBe(0);
    expect(s.modalLatestFy).toBeNull();
    expect(s.groups("industry").labels).toEqual([]);
  });

  it("gives not meaningful for pledge when promoters hold nothing", () => {
    const ds = createTinyDataset();
    const last = ds.companies[0].shareholding[12];
    last.promoter_pct = 0;
    expect(createMetricStore(ds, { providers: [] }).get("pledged_pct", 0).reason).toBe("non_positive_denominator");
  });
});
