import { describe, expect, it } from "vitest";
import { DATASET_SCHEMA } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { importFiles } from "./index";
import { exportDatasetJson, exportFileName, parseCanonicalJson, readCanonicalDataset } from "./canonical-json";
import type { IssueSink } from "../normalize";

const sink = (): IssueSink => ({ file: "d.json", issues: [] });

describe("canonical JSON", () => {
  it("export → import round-trips to a deep-equal dataset", async () => {
    const original = createTinyDataset();
    const text = exportDatasetJson(original);
    const out = await importFiles([{ name: "tiny.json", text }]);
    expect(out.report.ok).toBe(true);
    expect(out.dataset).toEqual(original);
    expect(out.files).toEqual([{ name: "tiny.json", kind: "canonical_json", rows: 6 }]);
    // and once more, from the re-imported copy
    const again = await importFiles([{ name: "again.json", text: exportDatasetJson(out.dataset ?? original) }]);
    expect(again.dataset).toEqual(original);
  });

  it("keeps the dataset's own meta, including the synthetic flag and notes", () => {
    const ds = createTinyDataset();
    ds.meta.notes = ["Pledge is % of promoter holding."];
    ds.meta.asOf = "2026-06-30";
    const back = parseCanonicalJson(exportDatasetJson(ds), sink(), "fallback");
    expect(back?.meta).toEqual(ds.meta);
  });

  it("indents small datasets and writes large ones compactly", () => {
    const ds = createTinyDataset();
    expect(exportDatasetJson(ds)).toContain("\n  ");
    expect(exportDatasetJson(ds, { pretty: false })).not.toContain("\n");
  });

  it("names exported files, with the SAMPLE- prefix for synthetic data", () => {
    const ds = createTinyDataset();
    expect(exportFileName(ds, "2026-10-07")).toMatch(/^SAMPLE-funda-.+-2026-10-07\.json$/);
    ds.meta.isSynthetic = false;
    ds.meta.name = "My Portfolio: FY26!";
    expect(exportFileName(ds, "2026-10-07")).toBe("funda-my-portfolio-fy26-2026-10-07.json");
  });

  it("reads NaN-free, lenient cells: numeric strings, blanks and junk", () => {
    const s = sink();
    const value = {
      schema: DATASET_SCHEMA,
      version: 1,
      companies: [{
        symbol: " abc ",
        annual: [{ fiscal_year: "FY26", revenue: "1,200", pbt: "", tax_expense: "NA", net_profit: "oops", flags: ["restated"] }],
        quarterly: [{ period_end: "2026-06-30", revenue: 5 }, { period_end: "bad", revenue: 1 }],
        snapshot: { pe: "12.5", price_book: 3, junk: "x" },
      }],
    };
    const ds = readCanonicalDataset(value, s, "fallback");
    const c = ds?.companies[0];
    expect(c?.symbol).toBe("ABC");
    expect(c?.annual[0]).toMatchObject({ fiscal_year: 2026, revenue: 1200, pbt: null, tax_expense: null, net_profit: null, flags: ["restated"] });
    expect(c?.quarterly).toHaveLength(1);
    expect(c?.snapshot).toEqual({ pe: 12.5, pb: 3 });
    expect(s.issues.map((i) => i.code)).toEqual(["W111_NOT_A_NUMBER", "W111_NOT_A_NUMBER", "W117_BAD_DATE"]); // snapshot junk, annual junk, bad quarter date
    expect(ds?.meta.name).toBe("fallback");
    expect(ds?.meta.isSynthetic).toBe(false);
  });

  it("rejects an unknown version (E003), a wrong structure and broken JSON", () => {
    const s1 = sink();
    expect(readCanonicalDataset({ ...createTinyDataset(), version: 7 }, s1, "x")).toBeNull();
    expect(s1.issues[0].code).toBe("E003_SCHEMA_VERSION");
    expect(s1.issues[0].message).toMatch(/version 7/);
    const s2 = sink();
    expect(readCanonicalDataset({ schema: DATASET_SCHEMA, version: 1, companies: "none" }, s2, "x")).toBeNull();
    expect(s2.issues[0].code).toBe("E005_BAD_SHAPE");
    const s3 = sink();
    expect(parseCanonicalJson("{", s3, "x")).toBeNull();
    expect(s3.issues[0].code).toBe("E006_BAD_JSON");
  });

  it("warns about declared units other than crore and INR", () => {
    const s = sink();
    const ds = createTinyDataset() as unknown as Record<string, unknown>;
    const meta = { ...(ds.meta as object), moneyUnit: "lakh", currency: "USD" };
    readCanonicalDataset({ ...ds, meta }, s, "x");
    expect(s.issues.map((i) => i.code)).toEqual(["W105_UNITS_META", "W105_UNITS_META"]);
  });
});
