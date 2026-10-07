import { describe, expect, it } from "vitest";
import { VF, type ColumnProvider } from "@/lib/contracts";
import { emptyColumn, setValue } from "@/lib/metrics/windows";
import { createFixtureStore, createTableStore, fnv1a32, inferCompanyType } from "./fixture-store";
import { createTinyDataset } from "./tiny-dataset";

const store = createTableStore(createTinyDataset());
const idx = (s: string) => store.indexOf(s);
const MFG = idx("TINYMFG");
const SOFT = idx("TINYSOFT");
const BANK = idx("TINYBANK");
const LOSS = idx("TINYLOSS");
const SNAP = idx("TINYSNAP");
const NEW = idx("TINYNEW");

describe("createTableStore: identity and types", () => {
  it("indexes symbols case-insensitively and exposes companies", () => {
    expect(store.size).toBe(6);
    expect(store.symbols).toEqual(["TINYMFG", "TINYSOFT", "TINYBANK", "TINYLOSS", "TINYSNAP", "TINYNEW"]);
    expect(idx(" tinysoft ")).toBe(1);
    expect(idx("RELIANCE")).toBe(-1);
    expect(store.company(MFG).name).toBe("Tinymill Engineering Ltd");
    expect(store.meta.isSynthetic).toBe(true);
    expect(store.modalLatestFy).toBe(2026);
  });

  it("infers the bank's type and keeps supplied types", () => {
    expect(store.companyType(BANK)).toEqual({ type: "bank", inferred: true });
    expect(store.family(BANK)).toBe("lender");
    expect(store.peerClass(BANK)).toBe("bank");
    expect(store.companyType(MFG)).toEqual({ type: "non_financial", inferred: false });
    expect(inferCompanyType("Financial services", "Housing finance")).toBe("nbfc");
    expect(inferCompanyType("Insurance", null)).toBe("insurance");
    expect(inferCompanyType("Cement", "Cement")).toBe("non_financial");
  });

  it("falls back to sector when industry is missing and has a stable key", () => {
    expect(store.industry(MFG)).toBe("Industrial components");
    const s2 = createTableStore(createTinyDataset());
    expect(s2.key).toBe(store.key);
    expect(fnv1a32("abc")).toBe("1a47e90b");
  });
});

describe("calendar grid (§C.1)", () => {
  it("slots annual years by fiscal year, keeping holes", () => {
    expect(store.slots(MFG, "fy")).toBe(7);
    expect(store.slots(NEW, "fy")).toBe(4); // FY26, FY25, (FY24 hole), FY23
    expect(store.slots(SNAP, "fy")).toBe(0);
    expect(store.at("total_assets", NEW, { freq: "fy", offset: 1 }).v).toBeGreaterThan(0);
    expect(store.at("total_assets", NEW, { freq: "fy", offset: 2 })).toMatchObject({ v: null, reason: "missing_input" });
    expect(store.at("total_assets", NEW, { freq: "fy", offset: 3 }).v).toBeGreaterThan(0);
    expect(store.at("total_assets", NEW, { freq: "fy", offset: 4 })).toMatchObject({ v: null, reason: "insufficient_history" });
  });

  it("slots quarters by date with a hole for the missing quarter", () => {
    expect(store.slots(SOFT, "q")).toBe(9);
    expect(store.at("q_sales", SOFT, { freq: "q", offset: 0 }).v).toBe(338);
    expect(store.at("q_sales", SOFT, { freq: "q", offset: 3 })).toMatchObject({ v: null, reason: "missing_input" });
    expect(store.at("q_sales", SOFT, { freq: "q", offset: 4 }).v).toBe(312); // Jun 2025, the year-ago quarter
    expect(store.slots(MFG, "sh")).toBe(13);
    expect(store.slots(LOSS, "q")).toBe(0);
  });

  it("labels periods", () => {
    expect(store.periodLabel(MFG, { freq: "fy", offset: 0 })).toBe("FY26");
    expect(store.periodLabel(MFG, { freq: "q", offset: 0 })).toBe("Q1 FY27");
    expect(store.periodLabel(MFG, { freq: "q", offset: 4 })).toBe("Q1 FY26");
    expect(store.periodLabel(MFG, { freq: "ttm", offset: 0 })).toBe("TTM to Jun 2026");
    expect(store.periodLabel(MFG, { freq: "ttm", offset: 1 })).toBe("TTM to Jun 2025");
    expect(store.periodLabel(NEW, { freq: "fy", offset: 2 })).toBeNull();
    expect(store.periodLabel(SOFT, { freq: "q", offset: 3 })).toBeNull();
  });
});

describe("values", () => {
  it("serves line items at the latest period and applies appliesTo", () => {
    expect(store.get("sales", MFG).v).toBe(1760);
    expect(store.get("pat", LOSS).v).toBe(-88.04);
    expect(store.get("advances", BANK).v).toBe(13000);
    expect(store.get("advances", MFG)).toMatchObject({ v: null, reason: "not_applicable_financial" });
    expect(store.get("cogs", SOFT)).toMatchObject({ v: null, reason: "missing_input" });
    expect(store.get("inventories", SOFT).v).toBe(0); // a real zero stays zero
    expect(store.get("promoter_holding", MFG).v).toBe(61.9);
    expect(store.get("q_sales", MFG).v).toBe(448.8);
  });

  it("serves price, market cap and history facts", () => {
    expect(store.get("price", MFG).v).toBe(420);
    expect(store.get("market_cap", MFG).v).toBe(4200);
    expect(store.get("market_cap", SNAP)).toEqual({ v: 5000, reason: null, flags: VF.Provided });
    expect(store.get("latest_fy", MFG).v).toBe(2026);
    expect(store.get("latest_fy", SNAP)).toMatchObject({ v: null, reason: "insufficient_history" });
    expect(store.get("years_of_history", NEW).v).toBe(3);
    expect(store.get("years_of_history", SNAP).v).toBe(0);
  });

  it("serves snapshot values as Provided and leaves other derived metrics missing", () => {
    expect(store.get("roce", SNAP)).toEqual({ v: 17.8, reason: null, flags: VF.Provided });
    expect(store.get("pb", SNAP).v).toBe(3.1);
    expect(store.get("roce", MFG)).toEqual({ v: null, reason: "missing_input", flags: 0 });
    expect(store.get("roce", BANK).reason).toBe("not_applicable_financial");
    expect(store.get("nii", MFG).reason).toBe("not_applicable_financial");
  });

  it("computes line-item variants with the shared window functions", () => {
    expect(store.get("sales_prev", MFG).v).toBe(1600);
    expect(store.get("sales_cagr_3y", MFG).v).toBeCloseTo((Math.pow(1760 / 1335, 1 / 3) - 1) * 100, 10);
    expect(store.get("sales_cagr_3y", NEW).v).toBeCloseTo((Math.pow(262 / 140, 1 / 3) - 1) * 100, 10);
    expect(store.get("sales_cagr_3y", LOSS).reason).toBe("transition_period"); // FY2024 inside the span
    expect(store.get("sales_cagr_5y", NEW).reason).toBe("insufficient_history");
    expect(store.get("cfo_cum_3y", MFG).v).toBeCloseTo(212.54 + 190.73 + 161.01, 6);
    expect(store.get("cfo_cum_3y", NEW).reason).toBe("insufficient_history"); // FY2024 hole
    expect(store.get("promoter_holding_chg_1y", MFG).v).toBeCloseTo(-0.2, 10);
    expect(store.get("promoter_holding_chg_3y", MFG).v).toBeCloseTo(-0.6, 10);
    expect(store.get("promoter_holding_chg_1y", LOSS).v).toBeCloseTo(-7, 10);
    expect(store.get("promoter_holding_chg_3y", SOFT).reason).toBe("insufficient_history");
    expect(store.get("q_sales_prev", MFG).v).toBe(466.4);
    expect(store.get("sales_ttm", MFG).reason).toBe("missing_input"); // derived: WS3
  });

  it("caches columns and rejects unknown ids", () => {
    expect(store.column("sales")).toBe(store.column("sales"));
    expect(() => store.get("no_such_metric", 0)).toThrow(/Unknown metric/);
    expect(store.def("roce")?.label).toBe("Return on capital employed");
    expect(store.defs().length).toBe(286); // 129 base metrics + 157 variants
  });

  it("reports coverage among applicable companies", () => {
    expect(store.coverage("roce")).toEqual({ nonNull: 1, applicable: 5 });
    expect(store.coverage("advances")).toEqual({ nonNull: 1, applicable: 1 });
  });
});

describe("peers (§C.7)", () => {
  it("falls back to class when sector and industry groups are too small", () => {
    const g = store.groups("industry");
    expect(g.labels[g.groupOf[MFG]]).toBe("Non-financial companies · 5 companies in your data");
    expect(g.effectiveScope[MFG]).toBe(0);
    expect(g.groupOf[BANK]).not.toBe(g.groupOf[MFG]);
    const st = store.peerStat("market_cap", MFG, "industry");
    expect(st).toMatchObject({ n: 5, median: 4200, p25: 660, p75: 5000, scope: "class", fellBackTo: "class" });
  });

  it("computes ascending percentiles with ties averaged and minimums applied", () => {
    expect(store.percentile("market_cap", LOSS, "class").v).toBe(0);
    expect(store.percentile("market_cap", MFG, "class").v).toBe(50);
    expect(store.percentile("market_cap", SOFT, "class").v).toBe(100);
    expect(store.percentile("market_cap", BANK, "class").reason).toBe("too_few_peers"); // classes never mix
    const tied = store.percentileOf(Float64Array.from([1, 1, 1, 1, 1, 1]), "class");
    expect(tied.values[MFG]).toBe(50);
    const med = store.medianOf(Float64Array.from([1, 2, 3, NaN, NaN, NaN]), "class");
    expect(med.reasons[MFG]).not.toBe(0); // only 2 non-null non-financial values (< 3)
  });

  it("lists peers by market cap within the class", () => {
    expect(store.peers(MFG, "class").map((i) => store.symbols[i])).toEqual(["TINYSOFT", "TINYSNAP", "TINYNEW", "TINYLOSS"]);
    expect(store.peers(MFG, "class", 2)).toHaveLength(2);
    expect(store.peers(BANK, "class")).toEqual([]);
  });
});

describe("column providers and createFixtureStore", () => {
  it("serves provider columns", () => {
    const provider: ColumnProvider = {
      ids: ["red_flag_count"],
      compute: (s, id) => {
        const c = emptyColumn(id, s.size);
        for (let i = 0; i < s.size; i++) setValue(c, i, i);
        return c;
      },
    };
    const s = createTableStore(createTinyDataset(), { providers: [provider] });
    expect(s.get("red_flag_count", 3).v).toBe(3);
  });

  it("returns literal table values, including explicit null reasons", () => {
    const s = createFixtureStore({
      companies: [
        { symbol: "alpha", name: "Alpha Works", sector: "Cement", values: { roce: 21.5, pe: null, interest_coverage: { v: null, reason: "no_interest_cost" } } },
        { symbol: "BETA", sector: "Banks", type: null, values: { roe: 14 } },
      ],
    });
    expect(s.symbols).toEqual(["ALPHA", "BETA"]);
    expect(s.get("roce", 0).v).toBe(21.5);
    expect(s.get("pe", 0).reason).toBe("missing_input");
    expect(s.get("interest_coverage", 0).reason).toBe("no_interest_cost");
    expect(s.get("roe", 0).reason).toBe("missing_input");
    expect(s.family(1)).toBe("lender");
    expect(s.get("roe", 1).v).toBe(14);
    expect(s.get("roce", 1).reason).toBe("not_applicable_financial");
    expect(s.meta.isSynthetic).toBe(true);
  });
});
