// Golden companies: every value is checked against arithmetic written out by hand (spec §E.5).
import { describe, expect, it } from "vitest";
import type { AnnualField, MetricStore, PeriodSel } from "@/lib/contracts";
import { ANNUAL_FIELD_INFO, VF } from "@/lib/contracts";
import { evaluateArithmetic } from "@/test/fixtures/metrics/arith";
import {
  GOLDEN_BLOCKS, GOLDEN_EXPECTATIONS, type GoldenExpectation, goldenDataset,
} from "@/test/fixtures/metrics/golden-company";
import { CURATED_METRICS } from "./catalogue";
import { createMetricStore } from "./store";
import { explainAltman, explainPiotroski } from "./index";

const store: MetricStore = createMetricStore(goldenDataset(), { providers: [] });

function read(e: GoldenExpectation) {
  const i = store.indexOf(e.symbol);
  return e.sel ? store.at(e.id, i, e.sel) : store.get(e.id, i);
}

function selText(sel: PeriodSel | undefined): string {
  return sel ? `[${sel.freq}-${sel.offset}]` : "";
}

const TOL = 1e-6;

function check(e: GoldenExpectation): void {
  const v = read(e);
  const where = `${e.symbol} ${e.id}${selText(e.sel)}`;
  if (e.reason) {
    expect(v.v, where).toBeNull();
    expect(v.reason, where).toBe(e.reason);
  } else {
    const expected = evaluateArithmetic(e.arithmetic ?? "NaN");
    expect(v.reason, where).toBeNull();
    expect(v.v, where).not.toBeNull();
    expect(Math.abs((v.v as number) - expected), `${where}: ${v.v} vs ${expected}`).toBeLessThanOrEqual(TOL * Math.max(1, Math.abs(expected)));
  }
  if (e.flags) expect(v.flags & e.flags, `${where} flags`).toBe(e.flags);
}

describe("golden companies", () => {
  it.each(GOLDEN_BLOCKS.map((e) => [`${e.symbol} ${e.id}${selText(e.sel)}`, e] as const))("building block %s", (_name, e) => check(e));
  it.each(GOLDEN_EXPECTATIONS.map((e) => [`${e.symbol} ${e.id}${selText(e.sel)}`, e] as const))("%s", (_name, e) => check(e));

  it("covers every curated base metric", () => {
    const covered = new Set(GOLDEN_EXPECTATIONS.map((e) => e.id));
    const missing = CURATED_METRICS.map((d) => d.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it("serves every annual line item of the latest year exactly as supplied", () => {
    const i = store.indexOf("GOLDMFG");
    const row = store.company(i).annual[store.company(i).annual.length - 1];
    for (const [field, info] of Object.entries(ANNUAL_FIELD_INFO) as [AnnualField, (typeof ANNUAL_FIELD_INFO)[AnnualField]][]) {
      const v = store.get(info.metricId, i);
      if (info.appliesTo === "lender") expect(v.reason, info.metricId).toBe("not_applicable_financial");
      else expect(v.v, info.metricId).toBe(row[field]);
    }
  });

  it("explains the Piotroski score criterion by criterion", () => {
    const x = explainPiotroski(store, store.indexOf("GOLDMFG"));
    expect(x.value.v).toBe(8);
    expect(x.band).toEqual({ label: "Strong", tone: "good" });
    expect(x.evaluable).toBe(9);
    expect(x.criteria.map((c) => `${c.id}:${c.result}`)).toEqual([
      "F1:met", "F2:met", "F3:met", "F4:met", "F5:met", "F6:met", "F7:met", "F8:met", "F9:not_met",
    ]);
    expect(x.criteria[0].detail).toBe("ROA FY26 10.5% (net profit on assets at the start of the year).");
    expect(x.criteria[0].inputs.map((e) => e.label)).toEqual(["PAT · FY26", "Total assets · FY25"]);
    expect(x.criteria[8].detail).toBe("Sales to opening assets FY26 1.07x (FY25 1.07x).");
  });

  it("explains the Altman Z'' score component by component", () => {
    const x = explainAltman(store, store.indexOf("GOLDMFG"));
    expect(x.band).toEqual({ label: "Safe zone", tone: "good" });
    expect(x.criteria.map((c) => c.id)).toEqual(["X1", "X2", "X3", "X4"]);
    expect(x.criteria.every((c) => c.result === "met")).toBe(true);
    expect(x.caveats).toContain("A distress screen, not a prediction of default.");
    expect(x.criteria[0].detail).toBe("X1 FY26 = 0.244; weight 6.56 adds 1.60 to the score.");
  });

  it("flags the bank's TTM fallback and approximate NIM, and leaves nothing unflagged by accident", () => {
    const b = store.indexOf("GOLDBNK");
    expect(store.get("pe", b).flags & VF.FyFallback).toBe(VF.FyFallback);
    expect(store.get("roe", b).flags).toBe(0);
    expect(store.get("pe", store.indexOf("GOLDMFG")).flags).toBe(0);
  });
});

// ── golden-company.md: the hand-check sheet, generated from the same table ──
function fmt(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function rows(list: readonly GoldenExpectation[]): string[] {
  return list.map((e) => {
    const period = e.sel ? `${e.sel.freq}-${e.sel.offset}` : "default";
    const value = e.reason ? `null (${e.reason})` : fmt(evaluateArithmetic(e.arithmetic ?? "0"));
    const flags = e.flags ? Object.entries(VF).filter(([, bit]) => ((e.flags as number) & bit) !== 0).map(([k]) => k).join(", ") : "";
    const arithmetic = e.arithmetic ? "`" + e.arithmetic + "`" : "—";
    return `| ${e.symbol} | ${"`" + e.id + "`"} | ${period} | ${arithmetic} | ${value} | ${[flags, e.note ?? ""].filter(Boolean).join("; ")} |`;
  });
}

function renderGoldenSheet(): string {
  const head = "| Company | Metric | Period | Arithmetic | Expected | Flags / note |\n|---|---|---|---|---|---|";
  return [
    "# Golden companies: hand-check sheet",
    "",
    "<!-- Generated by src/lib/metrics/golden.test.ts from src/test/fixtures/metrics/golden-company.ts. Regenerate with: npx vitest run src/lib/metrics/golden.test.ts -u -->",
    "",
    "GOLDMFG (Goldmere Components Ltd) and GOLDBNK (Goldmere Lending Bank Ltd) are **fictional** companies with",
    "round figures chosen so that every metric can be worked out by hand. Their raw figures are in",
    "golden-company.ts. Each row below shows the arithmetic from those figures; the test evaluates exactly this",
    "arithmetic (with a small parser, not eval) and compares it with the metric engine to within 1e-6.",
    "",
    "Periods: default is the metric's default period (latest FY, latest quarter or latest value); fy-k is the",
    "financial year k years before the latest (FY26 = fy-0); q-k is the k-th quarter before the latest (Jun 26 = q-0);",
    "ttm-k is the k-th earlier non-overlapping block of four quarters (ttm-0 = Sep 25 to Jun 26).",
    "",
    "Shorthand used in the arithmetic (FY26 unless stated): EBIT 234; capital employed FY26 1343.75, FY25 1246.25;",
    "TTM sales 1660 (previous TTM 1520); TTM owners' profit 158.75 (previous 135.75); TTM EBITDA 284; TTM operating",
    "expenses 1376; enterprise value 3150.75; total equity 1073.75 (FY25 956.25); net debt 110. Each of these is",
    "itself checked in the building-blocks table or the metrics table.",
    "",
    "## Building blocks by year",
    "",
    head,
    ...rows(GOLDEN_BLOCKS),
    "",
    "## Metrics",
    "",
    head,
    ...rows(GOLDEN_EXPECTATIONS),
    "",
  ].join("\n");
}

describe("golden-company.md", () => {
  it("matches the generated hand-check sheet", async () => {
    await expect(renderGoldenSheet()).toMatchFileSnapshot("../../test/fixtures/metrics/golden-company.md");
  });
});
