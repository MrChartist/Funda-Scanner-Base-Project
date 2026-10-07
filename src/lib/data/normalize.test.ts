import { describe, expect, it } from "vitest";
import { ANNUAL_FIELDS, MAX_ANNUAL_SLOTS, MAX_QUARTER_SLOTS } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import {
  emptyAnnualRow, emptyQuarterRow, fiscalYearEnd, normalizeCompany, normalizeDataset, readBasis, readCompanyType, readDate,
  readFiscalYear, readFlags, readMonth, tidyAnnual, tidyDated, type IssueSink,
} from "./normalize";

const sink = (): IssueSink => ({ file: null, issues: [] });

describe("scalar readers", () => {
  it("reads dates in ISO, Indian day-first and month forms", () => {
    expect(readDate("2026-03-31")).toBe("2026-03-31");
    expect(readDate("31-03-2026")).toBe("2026-03-31");
    expect(readDate("31/03/2026")).toBe("2026-03-31");
    expect(readDate("31.3.2026")).toBe("2026-03-31");
    expect(readDate("31 Mar 2026")).toBe("2026-03-31");
    expect(readDate("Mar 2026")).toBe("2026-03-31");
    expect(readDate("Feb-2024")).toBe("2024-02-29");
    expect(readDate("2026-06")).toBe("2026-06-30");
    expect(readDate("")).toBeNull();
    expect(readDate(null)).toBeNull();
    expect(readDate("2026-02-30")).toBeUndefined();
    expect(readDate("31-02-2026")).toBeUndefined();
    expect(readDate("yesterday")).toBeUndefined();
    expect(readDate("2026-13")).toBeUndefined();
  });

  it("reads fiscal years", () => {
    expect(readFiscalYear(2026)).toBe(2026);
    expect(readFiscalYear("2026")).toBe(2026);
    expect(readFiscalYear("FY26")).toBe(2026);
    expect(readFiscalYear("fy 2026")).toBe(2026);
    expect(readFiscalYear("2025-26")).toBe(2026);
    expect(readFiscalYear("2099-00")).toBe(2100);
    expect(readFiscalYear("2025-2026")).toBe(2026);
    expect(readFiscalYear("")).toBeNull();
    expect(readFiscalYear("2025-27")).toBeUndefined();
    expect(readFiscalYear(2026.5)).toBeUndefined();
    expect(readFiscalYear("soon")).toBeUndefined();
  });

  it("reads company types, bases, months and flags", () => {
    expect(readCompanyType("Non-financial")).toBe("non_financial");
    expect(readCompanyType("BANK")).toBe("bank");
    expect(readCompanyType("Housing finance")).toBe("nbfc");
    expect(readCompanyType("insurer")).toBe("insurance");
    expect(readCompanyType("other financial")).toBe("other_financial");
    expect(readCompanyType("")).toBeNull();
    expect(readCompanyType("conglomerate")).toBeUndefined();
    expect(readBasis("Consolidated")).toBe("consolidated");
    expect(readBasis("SA")).toBe("standalone");
    expect(readBasis("mixed")).toBeUndefined();
    expect(readMonth("12")).toBe(12);
    expect(readMonth(3)).toBe(3);
    expect(readMonth("December")).toBe(12);
    expect(readMonth("13")).toBeUndefined();
    expect(readMonth("")).toBeNull();
    expect(readFlags("restated; transition|restated")).toEqual({ flags: ["restated", "transition"], unknown: [] });
    expect(readFlags(["transition", "audited"])).toEqual({ flags: ["transition"], unknown: ["audited"] });
    expect(readFlags(null)).toEqual({ flags: [], unknown: [] });
  });

  it("builds empty rows with every key present and null", () => {
    const r = emptyAnnualRow(2026);
    for (const f of ANNUAL_FIELDS) expect(r[f]).toBeNull();
    expect(r).toMatchObject({ fiscal_year: 2026, period_end: null, flags: [] });
    expect(Object.keys(emptyQuarterRow("2026-06-30"))).toHaveLength(6);
    expect(fiscalYearEnd(2026, 3)).toBe("2026-03-31");
    expect(fiscalYearEnd(2024, 2)).toBe("2024-02-29");
  });
});

describe("normalizeCompany", () => {
  it("fills defaults: consolidated, March year end, Unclassified sector, null optional inputs", () => {
    const s = sink();
    const c = normalizeCompany({ symbol: "abc" }, s, "Company 1");
    expect(c).toEqual({
      symbol: "ABC", name: "ABC", sector: "Unclassified", industry: null, isin: null, company_type: null,
      statement_basis: "consolidated", fy_end_month: 3,
      market: { price: null, price_date: null, shares_outstanding: null, face_value: null, market_cap_supplied: null },
      annual: [], quarterly: [], shareholding: [], snapshot: {}, sample_note: null, source_note: null,
    });
    expect(s.issues).toEqual([]);
  });

  it("turns NaN, blanks, '-' and 'NA' into null, never 0", () => {
    const s = sink();
    const c = normalizeCompany({
      symbol: "A",
      annual: [{ fiscal_year: 2026, revenue: Number.NaN, pbt: "", tax_expense: "-", net_profit: "NA", other_income: 0 }],
      market: { price: Number.POSITIVE_INFINITY },
    }, s, "x");
    expect(c?.annual[0]).toMatchObject({ revenue: null, pbt: null, tax_expense: null, net_profit: null, other_income: 0 });
    expect(c?.market.price).toBeNull();
    expect(s.issues).toEqual([]);
  });

  it("sorts every series ascending and keeps the later duplicate period, with warnings", () => {
    const s = sink();
    const c = normalizeCompany({
      symbol: "A",
      annual: [{ fiscal_year: 2026, revenue: 3 }, { fiscal_year: 2024, revenue: 1 }, { fiscal_year: 2026, revenue: 4 }],
      quarterly: [{ period_end: "2026-06-30", revenue: 2 }, { period_end: "2025-12-31", revenue: 1 }, { period_end: "2026-06-30", revenue: 5 }],
      shareholding: [{ period_end: "2026-06-30", promoter_pct: 50 }, { period_end: "2026-03-31", promoter_pct: 51 }],
    }, s, "x");
    expect(c?.annual.map((r) => [r.fiscal_year, r.revenue])).toEqual([[2024, 1], [2026, 4]]);
    expect(c?.quarterly.map((r) => [r.period_end, r.revenue])).toEqual([["2025-12-31", 1], ["2026-06-30", 5]]);
    expect(c?.shareholding.map((r) => r.period_end)).toEqual(["2026-03-31", "2026-06-30"]);
    expect(s.issues.map((i) => i.code)).toEqual(["W113_DUPLICATE_PERIOD", "W113_DUPLICATE_PERIOD"]);
  });

  it("derives a fiscal year from the period end when it is missing, and skips rows with neither", () => {
    const s = sink();
    const c = normalizeCompany({ symbol: "A", fy_end_month: 12, annual: [{ period_end: "2025-12-31", revenue: 1 }, { revenue: 2 }] }, s, "x");
    expect(c?.annual.map((r) => r.fiscal_year)).toEqual([2025]);
    expect(s.issues.map((i) => i.code)).toEqual(["W117_BAD_DATE"]);
  });

  it("reports unreadable values and falls back to documented defaults", () => {
    const s = sink();
    const c = normalizeCompany({ symbol: "A", company_type: "conglomerate", statement_basis: "both", fy_end_month: 15, market: { price_date: "someday" }, annual: [{ fiscal_year: 2026, flags: "audited" }] }, s, "x");
    expect(c).toMatchObject({ company_type: null, statement_basis: "consolidated", fy_end_month: 3 });
    expect(s.issues.map((i) => i.code)).toEqual(["W118_BAD_VALUE", "W118_BAD_VALUE", "W118_BAD_VALUE", "W117_BAD_DATE", "W118_BAD_VALUE"]);
  });

  it("renames legacy snapshot keys and moves price and market cap into market inputs", () => {
    const c = normalizeCompany({ symbol: "A", snapshot: { price_book: 2, pe: 10, price: 99, market_cap: 1000 } }, sink(), "x");
    expect(c?.snapshot).toEqual({ pb: 2, pe: 10 });
    expect(c?.market).toMatchObject({ price: 99, market_cap_supplied: 1000 });
  });

  it("skips entries without a symbol", () => {
    const s = sink();
    expect(normalizeCompany({ name: "x" }, s, "Company 3")).toBeNull();
    expect(normalizeCompany("nope", s, "Company 4")).toBeNull();
    expect(s.issues.map((i) => i.code)).toEqual(["W120_EMPTY_SYMBOL", "W120_EMPTY_SYMBOL"]);
  });
});

describe("grid caps", () => {
  it("drops annual periods older than the grid can hold", () => {
    const s = sink();
    const rows = Array.from({ length: MAX_ANNUAL_SLOTS + 3 }, (_, k) => emptyAnnualRow(2000 + k));
    const kept = tidyAnnual(rows, "A", s);
    expect(kept).toHaveLength(MAX_ANNUAL_SLOTS);
    expect(kept[0].fiscal_year).toBe(2003);
    expect(s.issues[0].code).toBe("W116_PERIODS_DROPPED");
  });

  it("drops quarters older than the quarter grid", () => {
    const s = sink();
    const ends = ["2021-06-30", "2021-09-30", "2021-12-31", "2022-03-31", "2022-06-30", "2022-09-30", "2022-12-31", "2023-03-31",
      "2023-06-30", "2023-09-30", "2023-12-31", "2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30"];
    const kept = tidyDated(ends.map(emptyQuarterRow), "A", s, MAX_QUARTER_SLOTS, "quarterly");
    expect(kept).toHaveLength(MAX_QUARTER_SLOTS);
    expect(kept[0].period_end).toBe("2021-12-31");
    expect(s.issues[0].code).toBe("W116_PERIODS_DROPPED");
  });
});

describe("normalizeDataset", () => {
  it("is idempotent on canonical data and does not mutate its input", () => {
    const ds = createTinyDataset();
    const copy = structuredClone(ds);
    const s = sink();
    expect(normalizeDataset(ds, s)).toEqual(ds);
    expect(ds).toEqual(copy);
    expect(s.issues).toEqual([]);
  });

  it("keeps the later company when a symbol repeats, in the earlier position", () => {
    const s = sink();
    const ds = normalizeDataset({ companies: [{ symbol: "A", name: "One" }, { symbol: "B" }, { symbol: "a", name: "Two" }] }, s, "Mine");
    expect(ds.companies.map((c) => [c.symbol, c.name])).toEqual([["A", "Two"], ["B", "B"]]);
    expect(s.issues.map((i) => i.code)).toEqual(["W114_DUPLICATE_COMPANY"]);
    expect(ds.meta).toMatchObject({ name: "Mine", source: "user_import", isSynthetic: false, asOf: null, currency: "INR", moneyUnit: "crore" });
  });

  it("never auto-fills asOf and rejects an unreadable one", () => {
    const s = sink();
    expect(normalizeDataset({ meta: { asOf: "31/03/2026" }, companies: [] }, s).meta.asOf).toBe("2026-03-31");
    expect(normalizeDataset({ meta: { asOf: "recently" }, companies: [] }, s).meta.asOf).toBeNull();
    expect(normalizeDataset({ companies: [] }, s).meta.asOf).toBeNull();
    expect(s.issues.map((i) => i.code)).toEqual(["W117_BAD_DATE"]);
  });
});
