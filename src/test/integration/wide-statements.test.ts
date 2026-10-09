// src/test/integration/wide-statements.test.ts — §G.4 #4.
// Statements delivered as the four wide CSV files reproduce the canonical JSON exactly, so every
// metric value and every golden expectation is the same whichever format the user imports.
//   A. the four public funda-sample-*.csv files vs funda-sample-12.json;
//   B. the golden company plus 24 generated peers, written as four CSVs, still hits every golden value.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { computeDataHealth, importFiles } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { allMetricDefs, createMetricStore } from "@/lib/metrics";
import { generateSampleDataset } from "@/lib/sample";
import { evaluateArithmetic } from "@/test/fixtures/metrics/arith";
import { GOLDEN_EXPECTATIONS, goldenDataset } from "@/test/fixtures/metrics/golden-company";
import { wideFileInputs, writeWideCsv } from "@/test/fixtures/data/wide-writer";

const DIR = "public/sample-data";
const read = (name: string) => ({ name, text: readFileSync(`${DIR}/${name}`, "utf8") });

function sameValue(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function compareStores(wide: MetricStore, canon: MetricStore): string[] {
  const diffs: string[] = [];
  for (const d of allMetricDefs()) {
    for (let i = 0; i < canon.size; i++) {
      const j = wide.indexOf(canon.symbols[i]);
      const a = canon.get(d.id, i);
      const b = wide.get(d.id, j);
      if (!sameValue(a.v, b.v) || a.reason !== b.reason) diffs.push(`${canon.symbols[i]} ${d.id}: ${a.v}/${a.reason} vs ${b.v}/${b.reason}`);
    }
  }
  return diffs;
}

describe("the four public sample CSV files (§G.4 #4, part A)", () => {
  it("import cleanly, in any drop order, to the same companies as the canonical JSON", async () => {
    const files = ["funda-sample-shareholding.csv", "funda-sample-quarterly.csv", "funda-sample-annual.csv", "funda-sample-companies.csv"].map(read);
    const wide = await importFiles(files);
    const canon = await importFiles([read("funda-sample-12.json")]);
    expect(wide.report.ok).toBe(true);
    expect(canon.report.ok).toBe(true);
    expect(wide.report.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(wide.files.map((f) => f.kind).sort()).toEqual(["annual", "companies", "quarterly", "shareholding"]);
    expect(wide.dataset?.companies).toHaveLength(12);
    expect(wide.report.annualRows).toBe(canon.report.annualRows);
    expect(wide.report.quarterRows).toBe(canon.report.quarterRows);
    expect(wide.report.shareholdingRows).toBe(canon.report.shareholdingRows);
    // The public companies.csv has no source_note column (the JSON carries that provenance note
    // per company); everything else, every statement row included, is identical.
    const stripNote = (cs: FundamentalsDataset["companies"] | undefined) => cs?.map((c) => ({ ...c, source_note: null }));
    expect(stripNote(wide.dataset?.companies)).toEqual(stripNote(canon.dataset?.companies));
    expect(canon.dataset?.companies.every((c) => c.source_note !== null)).toBe(true);
  });

  it("produce identical values for every catalogue metric, and full data-health coverage", async () => {
    const wide = await importFiles(["funda-sample-companies.csv", "funda-sample-annual.csv", "funda-sample-quarterly.csv", "funda-sample-shareholding.csv"].map(read));
    const canon = await importFiles([read("funda-sample-12.json")]);
    if (!wide.dataset || !canon.dataset) throw new Error("import failed");
    const ws = createStore(wide.dataset);
    const cs = createStore(canon.dataset);
    expect(compareStores(ws, cs)).toEqual([]);
    // Spot-check a few concrete numbers, so the comparison above cannot pass on all-null columns.
    let populated = 0;
    for (const id of ["roce", "roe", "pe", "sales_cagr_5y", "piotroski_f", "altman_z", "q_sales"]) {
      for (let i = 0; i < ws.size; i++) if (ws.get(id, i).v !== null) populated++;
    }
    expect(populated).toBeGreaterThan(40);
    // Data health: statements, quarters and shareholding are all present and gap-free for the
    // companies that have them (the new listing has fewer years, with no gap).
    let full = 0;
    for (let i = 0; i < ws.size; i++) {
      const h = computeDataHealth(ws, i);
      expect(h.snapshotOnly, ws.symbols[i]).toBe(false);
      expect(h.years.gaps, ws.symbols[i]).toEqual([]);
      expect(h.missingRequired, ws.symbols[i]).toEqual([]);
      if (h.years.count === 11 && h.quarters.count === 13 && h.shareholding.count === 13) full++;
    }
    expect(full).toBeGreaterThanOrEqual(10);
  });
});

describe("golden company plus 24 generated peers as four CSVs (§G.4 #4, part B)", () => {
  const peers = generateSampleDataset().companies.filter((c) => c.annual.length >= 11 && c.company_type !== "bank").slice(0, 24);
  const source: FundamentalsDataset = goldenDataset(peers);

  it("round-trips to the same companies", async () => {
    expect(peers).toHaveLength(24);
    const wide = await importFiles(wideFileInputs(writeWideCsv(source)));
    expect(wide.report.ok).toBe(true);
    expect(wide.dataset?.companies).toEqual(source.companies);
  });

  it("reproduces every golden value from the CSV import", async () => {
    const wide = await importFiles(wideFileInputs(writeWideCsv(source)));
    if (!wide.dataset) throw new Error("import failed");
    const store = createMetricStore(wide.dataset, { providers: [] });
    expect(GOLDEN_EXPECTATIONS.length).toBeGreaterThan(50);
    for (const e of GOLDEN_EXPECTATIONS) {
      const i = store.indexOf(e.symbol);
      const v = e.sel ? store.at(e.id, i, e.sel) : store.get(e.id, i);
      const where = `${e.symbol} ${e.id}`;
      if (e.reason) {
        expect(v.v, where).toBeNull();
        expect(v.reason, where).toBe(e.reason);
      } else {
        const expected = evaluateArithmetic(e.arithmetic ?? "NaN");
        expect(v.v, where).not.toBeNull();
        expect(Math.abs((v.v as number) - expected), where).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(expected)));
      }
    }
  });
});
