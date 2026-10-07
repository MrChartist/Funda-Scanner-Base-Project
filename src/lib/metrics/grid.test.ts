import { describe, expect, it } from "vitest";
import type { AnnualRow, QuarterRow } from "@/lib/contracts";
import { MAX_ANNUAL_SLOTS, MAX_QUARTER_SLOTS } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { inferCompanyType, resolveCompanyType } from "./company-type";
import { buildGrid, fyEndDay, isFlaggedYear, slotAnnual, slotByDate, slotState } from "./grid";
import { daysFromCivil } from "@/lib/time/civil";

const q = (period_end: string): QuarterRow => ({
  period_end, revenue: 1, operating_expenses: null, depreciation: null, net_profit: null, net_profit_owners: null,
});
const year = (fiscal_year: number, flags: AnnualRow["flags"] = []): AnnualRow =>
  ({ fiscal_year, period_end: `${fiscal_year}-03-31`, flags, revenue: fiscal_year } as unknown as AnnualRow);

describe("annual grid", () => {
  it("slots fiscal years from the latest backwards, with holes and no shifting", () => {
    const { annual, latestFy } = slotAnnual([year(2023), year(2026), year(2025)]);
    expect(latestFy).toBe(2026);
    expect(annual.map((r) => r?.fiscal_year ?? null)).toEqual([2026, 2025, null, 2023]);
  });

  it("keeps the last row given for a duplicated year and caps the history", () => {
    const a = { ...year(2026), revenue: 1 } as AnnualRow;
    const b = { ...year(2026), revenue: 2 } as AnnualRow;
    expect(slotAnnual([a, b]).annual[0]?.revenue).toBe(2);
    const many = Array.from({ length: 30 }, (_, k) => year(1997 + k));
    expect(slotAnnual(many).annual).toHaveLength(MAX_ANNUAL_SLOTS);
    expect(slotAnnual([]).annual).toEqual([]);
    expect(slotAnnual([]).latestFy).toBeNull();
  });

  it("knows flagged years and slot states", () => {
    const g = buildGrid({ ...createTinyDataset().companies[3] });
    expect(isFlaggedYear(g, 2)).toBe(true); // TINYLOSS FY2024
    expect(isFlaggedYear(g, 1)).toBe(false);
    expect(isFlaggedYear(g, 99)).toBe(false);
    expect(slotState(g.annual, 0)).toBe("ok");
    expect(slotState(g.annual, 6)).toBe("beyond");
    const n = buildGrid(createTinyDataset().companies[5]);
    expect(slotState(n.annual, 2)).toBe("hole");
  });

  it("dates a year end from period_end, else from the fiscal-year-end month", () => {
    expect(fyEndDay(year(2026), 3)).toBe(daysFromCivil(2026, 3, 31));
    expect(fyEndDay({ ...year(2026), period_end: null }, 12)).toBe(daysFromCivil(2026, 12, 31));
  });
});

describe("quarter grid (±15 days)", () => {
  it("slots by date with holes for missing quarters", () => {
    const rows = [q("2026-06-30"), q("2026-03-31"), q("2025-09-30"), q("2025-06-30")];
    expect(slotByDate(rows, MAX_QUARTER_SLOTS).map((r) => r?.period_end ?? null))
      .toEqual(["2026-06-30", "2026-03-31", null, "2025-09-30", "2025-06-30"]);
  });

  it("accepts dates within 15 days and rejects ones further away", () => {
    const near = slotByDate([q("2026-06-30"), q("2026-03-20")], 16);
    expect(near.map((r) => r?.period_end ?? null)).toEqual(["2026-06-30", "2026-03-20"]);
    const far = slotByDate([q("2026-06-30"), q("2026-03-10"), q("2025-12-31")], 16);
    expect(far.map((r) => r?.period_end ?? null)).toEqual(["2026-06-30", null, "2025-12-31"]);
  });

  it("ignores invalid dates, sorts by date and caps the number of slots", () => {
    const rows = [q("2025-03-31"), q("not a date"), q("2026-03-31"), q("2025-12-31"), q("2025-06-30"), q("2025-09-30")];
    expect(slotByDate(rows, 16).map((r) => r?.period_end)).toEqual(["2026-03-31", "2025-12-31", "2025-09-30", "2025-06-30", "2025-03-31"]);
    expect(slotByDate(rows, 2)).toHaveLength(2);
    expect(slotByDate([], 16)).toEqual([]);
  });

  it("uses each quarter once", () => {
    const rows = [q("2026-06-30"), q("2026-06-25")];
    expect(slotByDate(rows, 16).map((r) => r?.period_end ?? null)).toEqual(["2026-06-30"]);
  });
});

describe("company type (§C.7)", () => {
  it.each([
    ["Banks", "Private sector bank", "bank"],
    ["Financials", "Small finance bank", "bank"],
    ["Finance", "Housing finance", "nbfc"],
    ["NBFC", null, "nbfc"],
    ["Financial services", "Non-banking financial company", "nbfc"],
    ["Finance", "Microfinance", "nbfc"],
    ["Insurance", "Life insurance", "insurance"],
    ["Financial services", "Investment banking", "non_financial"],
    ["Textiles", "Bankura Mills", "non_financial"],
    ["IT services", null, "non_financial"],
    ["Capital markets", "Brokers", "non_financial"],
  ] as const)("%s / %s → %s", (sector, industry, expected) => {
    expect(inferCompanyType(sector, industry)).toBe(expected);
  });

  it("uses the supplied type when present and flags inference otherwise", () => {
    expect(resolveCompanyType({ company_type: "nbfc", sector: "Banks", industry: null })).toEqual({ type: "nbfc", inferred: false });
    expect(resolveCompanyType({ company_type: null, sector: "Banks", industry: null })).toEqual({ type: "bank", inferred: true });
  });
});
