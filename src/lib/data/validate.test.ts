// One positive and one negative case for every validation code (§E.3).
import { describe, expect, it } from "vitest";
import type { CompanyRecord, FundamentalsDataset } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { importFiles } from "./import";
import { exportDatasetJson } from "./import/canonical-json";
import { buildReport, computeCoverage, quartersOfYear, sortIssues, validateCompany, validateDataset } from "./validate";
import { makeIssue } from "./normalize";

function tiny(): FundamentalsDataset {
  return createTinyDataset();
}

function company(symbol: string, ds = tiny()): CompanyRecord {
  const c = ds.companies.find((x) => x.symbol === symbol);
  if (!c) throw new Error(symbol);
  return c;
}

const codesOf = (c: CompanyRecord) => validateCompany(c).map((i) => i.code);
const latest = (c: CompanyRecord) => c.annual[c.annual.length - 1];

describe("import-level errors", () => {
  it("E001: a CSV without a symbol column", async () => {
    const bad = await importFiles([{ name: "a.csv", text: "name,fiscal_year,revenue\nAlpha,2026,1\n" }]);
    expect(bad.report.issues.map((i) => i.code)).toContain("E001_NO_SYMBOL");
    expect(bad.dataset).toBeNull();
    const snap = await importFiles([{ name: "s.json", text: '[{"name":"x","pe":1}]' }]);
    expect(snap.report.issues.map((i) => i.code)).toContain("E001_NO_SYMBOL");
    const good = await importFiles([{ name: "s.csv", text: "symbol,pe\nA,1\n" }]);
    expect(good.report.issues.map((i) => i.code)).not.toContain("E001_NO_SYMBOL");
  });

  it("E002: zero usable companies", async () => {
    const empty = await importFiles([{ name: "s.csv", text: "symbol,pe\n" }]);
    expect(empty.report.issues.map((i) => i.code)).toContain("E002_NO_COMPANIES");
    expect(empty.dataset).toBeNull();
    const none = await importFiles([]);
    expect(none.report.issues[0].code).toBe("E002_NO_COMPANIES");
    const ok = await importFiles([{ name: "s.csv", text: "symbol,pe\nA,1\n" }]);
    expect(ok.report.ok).toBe(true);
    expect(ok.report.issues.map((i) => i.code)).not.toContain("E002_NO_COMPANIES");
  });

  it("E003: an unknown schema version", async () => {
    const v2 = { ...tiny(), version: 2 };
    const bad = await importFiles([{ name: "d.json", text: JSON.stringify(v2) }]);
    expect(bad.report.issues[0]).toMatchObject({ level: "error", code: "E003_SCHEMA_VERSION", file: "d.json" });
    const good = await importFiles([{ name: "d.json", text: exportDatasetJson(tiny()) }]);
    expect(good.report.issues.map((i) => i.code)).not.toContain("E003_SCHEMA_VERSION");
  });

  it("E004: files above the limits (25 MB JSON, 200,000 CSV rows, 5 MB and 20,000 rows for snapshots)", async () => {
    const pad = "x".repeat(25 * 1024 * 1024);
    const big = `{"schema":"funda-dataset","version":1,"meta":{"notes":["${pad}"]},"companies":[]}`;
    const json = await importFiles([{ name: "big.json", text: big }]);
    expect(json.report.issues.map((i) => i.code)).toEqual(["E004_TOO_LARGE"]);

    const rows = "A,2020\n".repeat(200_001);
    const csv = await importFiles([{ name: "annual.csv", text: `symbol,fiscal_year\n${rows}` }]);
    expect(csv.report.issues.map((i) => i.code)).toContain("E004_TOO_LARGE");

    const snapRows = Array.from({ length: 20_001 }, (_, k) => `S${k},1`).join("\n");
    const snap = await importFiles([{ name: "snap.csv", text: `symbol,pe\n${snapRows}\n` }]);
    expect(snap.report.issues.map((i) => i.code)).toContain("E004_TOO_LARGE");

    const snapBytes = await importFiles([{ name: "snap.csv", text: `symbol,name,pe\nA,${"y".repeat(5 * 1024 * 1024)},1\n` }]);
    expect(snapBytes.report.issues.map((i) => i.code)).toContain("E004_TOO_LARGE");

    const fine = await importFiles([{ name: "annual.csv", text: "symbol,fiscal_year\nA,2020\n" }, { name: "c.csv", text: "symbol,name,isin\nA,Alpha,\n" }]);
    expect(fine.report.issues.map((i) => i.code)).not.toContain("E004_TOO_LARGE");
  }, 30_000);

  it("E005/E006: JSON that is not a dataset, and text that is not JSON", async () => {
    const shape = await importFiles([{ name: "x.json", text: '{"hello":1}' }]);
    expect(shape.report.issues[0].code).toBe("E005_UNKNOWN_KIND");
    const broken = await importFiles([{ name: "x.json", text: "{oops" }]);
    expect(broken.report.issues[0].code).toBe("E006_BAD_JSON");
    const badCompanies = await importFiles([{ name: "x.json", text: '{"schema":"funda-dataset","version":1,"companies":[{"name":"no symbol"}]}' }]);
    expect(badCompanies.report.issues[0]).toMatchObject({ code: "E005_BAD_SHAPE" });
    expect(badCompanies.report.issues[0].message).toMatch(/companies\[0\]\.symbol/);
  });
});

describe("content checks", () => {
  it("a clean company raises nothing", () => {
    expect(validateCompany(company("TINYMFG"))).toEqual([]);
    expect(validateCompany(company("TINYSOFT"))).toEqual([]);
  });

  it("W100: pbt − tax differs from net profit by more than max(1%, ₹1 Cr)", () => {
    const c = company("TINYMFG");
    latest(c).net_profit = (latest(c).net_profit ?? 0) + 0.9; // within ₹1 Cr
    expect(codesOf(c)).not.toContain("W100_PNL_IDENTITY");
    latest(c).net_profit = (latest(c).net_profit ?? 0) + 5;
    const issues = validateCompany(c).filter((i) => i.code === "W100_PNL_IDENTITY");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ symbol: "TINYMFG", period: "FY26", level: "warning" });
  });

  it("W101: four quarters differ from the FY figure by more than 2%", () => {
    const c = company("TINYMFG");
    const fy26 = latest(c);
    expect(quartersOfYear(c, fy26)?.map((q) => q.period_end)).toEqual(["2026-03-31", "2025-12-31", "2025-09-30", "2025-06-30"]);
    expect(codesOf(c)).not.toContain("W101_QUARTER_SUM");
    fy26.revenue = (fy26.revenue ?? 0) * 1.05;
    const issue = validateCompany(c).find((i) => i.code === "W101_QUARTER_SUM");
    expect(issue?.period).toBe("FY26");
    expect(issue?.message).toMatch(/revenue/);
    // A missing quarter means no comparison (TINYSOFT lacks Sep 2025).
    const soft = company("TINYSOFT");
    latest(soft).revenue = 1;
    expect(codesOf(soft)).not.toContain("W101_QUARTER_SUM");
  });

  it("W102: cash and bank ≤ total current assets ≤ total assets", () => {
    const c = company("TINYMFG");
    expect(codesOf(c)).not.toContain("W102_BALANCE_ORDER");
    latest(c).cash_and_bank = (latest(c).total_current_assets ?? 0) + 10;
    expect(codesOf(c)).toContain("W102_BALANCE_ORDER");
    const d = company("TINYMFG");
    latest(d).total_current_assets = (latest(d).total_assets ?? 0) + 1;
    expect(codesOf(d)).toContain("W102_BALANCE_ORDER");
  });

  it("W103: shareholding total above 100.5", () => {
    const c = company("TINYMFG");
    expect(codesOf(c)).not.toContain("W103_SHAREHOLDING_TOTAL");
    c.shareholding[0].fii_pct = 30; // 62.5 + 30 + 9.8 = 102.3
    expect(validateCompany(c).find((i) => i.code === "W103_SHAREHOLDING_TOTAL")?.period).toBe("2023-06-30");
    const edge = company("TINYMFG");
    edge.shareholding[0].fii_pct = 100.5 - 62.5 - 9.8; // exactly 100.5 is accepted
    expect(codesOf(edge)).not.toContain("W103_SHAREHOLDING_TOTAL");
  });

  it("W104: negative revenue, inventories, receivables or capex", () => {
    for (const f of ["revenue", "inventories", "trade_receivables", "capex"] as const) {
      const c = company("TINYMFG");
      c.annual[0][f] = -1;
      expect(validateCompany(c).find((i) => i.code === "W104_NEGATIVE")?.field).toBe(f);
    }
    const q = company("TINYMFG");
    q.quarterly[0].revenue = -3;
    expect(codesOf(q)).toContain("W104_NEGATIVE");
    const ok = company("TINYLOSS"); // negative profit and net worth are allowed
    expect(codesOf(ok)).not.toContain("W104_NEGATIVE");
  });

  it("W105: unit sniffing runs at dataset level", () => {
    const ds = tiny();
    expect(validateDataset(ds).some((i) => i.code.startsWith("W105"))).toBe(false);
    for (const c of ds.companies) for (const r of c.annual) if (r.revenue !== null) r.revenue *= 1e7;
    expect(validateDataset(ds).map((i) => i.code)).toContain("W105_UNITS_RUPEES");
  });

  it("W106: the statement basis changes within one company", async () => {
    const files = (b1: string, b2: string) => [
      { name: "c.csv", text: "symbol,name,sector,company_type\nA,Alpha,IT,non_financial\n" },
      { name: "a.csv", text: `symbol,fiscal_year,statement_basis,revenue\nA,2025,${b1},10\nA,2026,${b2},11\n` },
    ];
    const changed = await importFiles(files("consolidated", "standalone"));
    expect(changed.report.issues.find((i) => i.code === "W106_BASIS_CHANGE")?.symbol).toBe("A");
    const same = await importFiles(files("consolidated", "consolidated"));
    expect(same.report.issues.map((i) => i.code)).not.toContain("W106_BASIS_CHANGE");
  });

  it("W107: fiscal_year and period_end disagree", () => {
    const c = company("TINYMFG");
    expect(codesOf(c)).not.toContain("W107_PERIOD_MISMATCH");
    latest(c).period_end = "2025-03-31"; // FY25, not FY26
    expect(validateCompany(c).find((i) => i.code === "W107_PERIOD_MISMATCH")?.period).toBe("FY26");
    const m = company("TINYMFG");
    latest(m).period_end = "2025-12-31"; // falls in FY26 but is not a March year end
    expect(codesOf(m)).toContain("W107_PERIOD_MISMATCH");
    latest(m).flags = ["transition"];
    expect(codesOf(m)).not.toContain("W107_PERIOD_MISMATCH");
  });

  it("W108: a gap year (info)", () => {
    const gap = validateCompany(company("TINYNEW")).find((i) => i.code === "W108_GAP_YEAR");
    expect(gap).toMatchObject({ level: "info", period: "FY24" });
    expect(codesOf(company("TINYMFG"))).not.toContain("W108_GAP_YEAR");
  });

  it("W109: a lender with industrial fields (info)", () => {
    const bank = company("TINYBANK");
    bank.company_type = "bank";
    expect(codesOf(bank)).not.toContain("W109_LENDER_FIELDS");
    bank.annual[0].inventories = 5;
    expect(validateCompany(bank).find((i) => i.code === "W109_LENDER_FIELDS")).toMatchObject({ level: "info", field: "inventories" });
  });

  it("W110: ISIN format", () => {
    const c = company("TINYMFG");
    c.isin = "INE000A01019";
    expect(codesOf(c)).not.toContain("W110_ISIN_FORMAT");
    c.isin = "US0378331005";
    expect(codesOf(c)).toContain("W110_ISIN_FORMAT");
    c.isin = "INE000A0101X";
    expect(codesOf(c)).toContain("W110_ISIN_FORMAT");
  });

  it("I001: company type will be inferred", () => {
    expect(validateCompany(company("TINYBANK")).find((i) => i.code === "I001_TYPE_INFERRED")).toMatchObject({ level: "info", symbol: "TINYBANK" });
    expect(codesOf(company("TINYMFG"))).not.toContain("I001_TYPE_INFERRED");
  });

  it("summarises I001 in one line when many companies need inference", () => {
    const ds = tiny();
    for (const c of ds.companies) c.company_type = null;
    const lines = validateDataset(ds).filter((i) => i.code === "I001_TYPE_INFERRED");
    expect(lines).toHaveLength(1);
    expect(lines[0].message).toMatch(/6 companies/);
  });
});

describe("report", () => {
  it("sorts issues by level and computes coverage per company-year", () => {
    const ds = tiny();
    const issues = [makeIssue("info", "I1", "i"), makeIssue("warning", "W1", "w"), makeIssue("error", "E1", "e"), makeIssue("warning", "W2", "w2")];
    expect(sortIssues(issues).map((i) => i.code)).toEqual(["E1", "W1", "W2", "I1"]);
    const r = buildReport(ds, issues, 2);
    expect(r).toMatchObject({ ok: false, companies: 6, companiesRejected: 2 });
    const cov = computeCoverage(ds);
    expect(cov.revenue).toBe(1);
    expect(cov.cogs).toBeGreaterThan(0);
    expect(cov.cogs).toBeLessThan(1);
    expect(cov["quarterly.revenue"]).toBe(1);
    expect(Object.keys(cov).every((k) => cov[k] >= 0 && cov[k] <= 1)).toBe(true);
    expect(buildReport(null, [], 0)).toMatchObject({ ok: true, companies: 0, coverage: {} });
  });
});
