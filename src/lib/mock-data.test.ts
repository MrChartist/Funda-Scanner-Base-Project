import { describe, it, expect } from "vitest";
import { MOCK_COMPANIES, getMockCompanyIntelligence, searchCompanies } from "./mock-data";

describe("mock data", () => {
  it("has unique symbols", () => {
    const symbols = MOCK_COMPANIES.map((c) => c.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("is deterministic per symbol", () => {
    const a = getMockCompanyIntelligence("TCS");
    const b = getMockCompanyIntelligence("TCS");
    expect(a.company.symbol).toBe("TCS");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("falls back to the first company for unknown symbols", () => {
    expect(getMockCompanyIntelligence("NOPE").company.symbol).toBe(MOCK_COMPANIES[0].symbol);
  });
});

describe("searchCompanies", () => {
  it("matches symbol and name case-insensitively", () => {
    expect(searchCompanies("reliance").map((c) => c.symbol)).toContain("RELIANCE");
    expect(searchCompanies("tata").length).toBeGreaterThan(0);
  });

  it("returns nothing for gibberish and caps results at 15", () => {
    expect(searchCompanies("zzzzzz")).toEqual([]);
    expect(searchCompanies("").length).toBeLessThanOrEqual(15);
  });
});
