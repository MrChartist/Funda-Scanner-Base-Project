import { describe, expect, it } from "vitest";
import { createFixtureStore } from "@/test/fixtures/fixture-store";
import { historyStore } from "@/test/fixtures/query/stores";
import { runScreen } from "./run";
import { screenCsvFilename, screenToCsv, toCsvCell } from "./export-csv";

const ctx = { watchlist: [], portfolio: [] };

describe("CSV export", () => {
  it("guards text cells against formula injection but never prefixes numbers", () => {
    expect(toCsvCell("=CMD()")).toBe("'=CMD()");
    expect(toCsvCell("+1")).toBe("'+1");
    expect(toCsvCell("-5.2")).toBe("'-5.2");
    expect(toCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(toCsvCell("\tx")).toBe("'\tx");
    expect(toCsvCell("\rx")).toBe("\"'\rx\"");
    expect(toCsvCell(-5.2)).toBe("-5.2");
    expect(toCsvCell(0.1 + 0.2)).toBe("0.3");
    expect(toCsvCell(1e21)).toBe("1000000000000000000000");
    expect(toCsvCell(0.0000001)).toBe("0");
    expect(toCsvCell(-12.3456789)).toBe("-12.345679");
  });

  it("quotes commas, quotes and line breaks; nulls are empty", () => {
    expect(toCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
    expect(toCsvCell(null)).toBe("");
    expect(toCsvCell(Number.NaN)).toBe("");
    expect(toCsvCell(Infinity)).toBe("");
  });

  it("writes a BOM, the provenance header, labelled columns and an is_synthetic column", () => {
    const s = historyStore();
    const run = runScreen(s, { query: "pe > 0 SORT BY pe ASC LIMIT 3", columns: null, sort: null, universe: { kind: "all" } }, ctx);
    const csv = screenToCsv(run, s);
    const lines = csv.split("\r\n");
    expect(csv.startsWith("﻿# Funda Scanner screen export\r\n")).toBe(true);
    expect(lines.slice(1, 9)).toEqual([
      "# Dataset: Fixture table (fictional)",
      "# Synthetic: yes (fictional companies)",
      "# Imported at: not applicable",
      "# As of: not provided",
      "# Query: pe > 0 SORT BY pe ASC LIMIT 3",
      `# In plain English: ${run.compiled.english}`,
      "# Catalogue version: 2026.1",
      "# Blank cells mean missing or not applicable",
    ]);
    expect(lines[9]).toBe(
      "Symbol,Name,Sector,Industry,Market capitalisation (₹ Cr; Latest),Price to earnings (x; TTM),Return on capital employed (%; FY),Return on equity (%; FY),Debt to equity (x; FY),Sales · 3Y CAGR (%; 3Y),Dividend yield (%; Latest),Sort value (pe ASC),is_synthetic",
    );
    expect(lines[10]).toBe("BANKX,Bankwell Bank Ltd (fictional),Banks,Banks,4000,9,,14,,5.566719,,9,true");
    expect(lines.filter((l) => /^[A-Z]+,/.test(l))).toHaveLength(3);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("keeps header comments on one line and does not mark real data as fictional", () => {
    const s = createFixtureStore({
      companies: [{ symbol: "AAA", name: "=HYPERLINK(\"x\")", sector: "-Cement", values: { pe: 5 } }],
      meta: { name: "Mine\r\n=1+1", isSynthetic: false, source: "user_import", importedAt: "2026-10-07T10:00:00.000Z", asOf: "2026-09-30" },
    });
    const run = runScreen(s, { query: "", columns: null, sort: null, universe: { kind: "all" } }, ctx);
    const csv = screenToCsv(run, s);
    expect(csv).toContain("# Dataset: Mine =1+1\r\n");
    expect(csv).toContain("# Synthetic: no\r\n");
    expect(csv).toContain("# As of: 2026-09-30\r\n");
    expect(csv).toContain("# Imported at: 2026-10-07T10:00:00.000Z\r\n");
    expect(csv).toContain(`AAA,"'=HYPERLINK(""x"")",'-Cement`);
    expect(csv).toContain(",false\r\n");
    expect(csv.split("\r\n").some((l) => l.startsWith("=1+1"))).toBe(false);
  });

  it("names the file by local date, with a SAMPLE- prefix for synthetic data", () => {
    expect(screenCsvFilename(historyStore())).toMatch(/^SAMPLE-funda-screen-\d{4}-\d{2}-\d{2}\.csv$/);
    const real = createFixtureStore({ companies: [{ symbol: "A" }], meta: { isSynthetic: false } });
    expect(screenCsvFilename(real, "my-screen")).toMatch(/^my-screen-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
