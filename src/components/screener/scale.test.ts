// Unit tests for the data-bar percentile scale and the column presets. No rendering: pure functions.
import { describe, expect, it } from "vitest";
import type { ColumnSpec, MetricStore, ResolvedColumn, ScreenRun } from "@/lib/contracts";
import { COLUMN_PRESETS, activePreset, presetColumns } from "./column-presets";
import { buildScales, hasBar, percentileIn } from "./scale";

function column(n: number, unit: ResolvedColumn["unit"], make: (i: number) => number): ResolvedColumn {
  const values = Float64Array.from({ length: n }, (_, i) => make(i));
  return {
    key: "roce", metricId: "roce", label: "ROCE", short: "ROCE", unit, decimals: 1, direction: "higher", periodTag: "FY", fromQuery: false,
    column: { values, reasons: new Uint8Array(n), flags: new Uint16Array(n) },
  } as unknown as ResolvedColumn;
}

describe("percentileIn", () => {
  it("is 0 for the lowest, 1 for the highest, and averages ties", () => {
    const sorted = Float64Array.from([1, 2, 2, 2, 5]);
    expect(percentileIn(sorted, 1)).toBe(0);
    expect(percentileIn(sorted, 5)).toBe(1);
    expect(percentileIn(sorted, 2)).toBe(0.5);
  });
  it("returns null without a scale or a finite value, and 0.5 for a single value", () => {
    expect(percentileIn(undefined, 1)).toBeNull();
    expect(percentileIn(new Float64Array(), 1)).toBeNull();
    expect(percentileIn(Float64Array.from([3]), Number.NaN)).toBeNull();
    expect(percentileIn(Float64Array.from([3]), 3)).toBe(0.5);
  });
});

describe("buildScales", () => {
  it("only scales percentage-type columns, over every listed company, and stays fast for 5,000 companies", () => {
    const n = 5000;
    const pct = column(n, "pct", (i) => ((i * 7919) % n) / 10 - 100);
    const times = { ...column(n, "x", (i) => i), key: "pe", metricId: "pe" } as ResolvedColumn;
    const run = { columns: [pct, times], matched: Int32Array.from({ length: n }, (_, i) => i) } as unknown as ScreenRun;
    expect(hasBar(pct)).toBe(true);
    expect(hasBar(times)).toBe(false);
    const t0 = performance.now();
    const scales = buildScales(run);
    const ms = performance.now() - t0;
    expect(scales.has("roce")).toBe(true);
    expect(scales.has("pe")).toBe(false);
    expect(scales.get("roce")?.length).toBe(n);
    expect(ms).toBeLessThan(500);
    const sorted = scales.get("roce");
    expect(percentileIn(sorted, -100)).toBe(0);
    expect(percentileIn(sorted, 399.9)).toBe(1);
  });

  it("skips missing values", () => {
    const col = column(4, "pct", (i) => i);
    col.column.reasons[1] = 5;
    const run = { columns: [col], matched: Int32Array.from([0, 1, 2, 3]) } as unknown as ScreenRun;
    expect(Array.from(buildScales(run).get("roce") ?? [])).toEqual([0, 2, 3]);
  });
});

describe("column presets", () => {
  const known = new Set(["pb", "ev_ebitda", "earnings_yield", "fcf_yield", "price_to_sales", "peg", "roce_avg_5y", "roic", "opm", "npm", "piotroski_f"]);
  const store = { def: (id: string) => (known.has(id) ? ({ id } as never) : undefined) } as unknown as MetricStore;

  it("lists the six presets and skips metrics the data does not define", () => {
    expect(COLUMN_PRESETS.map((p) => p.label)).toEqual(["Overview", "Valuation", "Quality", "Growth", "Balance sheet", "Cash flow"]);
    const valuation = COLUMN_PRESETS.find((p) => p.id === "valuation");
    expect(presetColumns(valuation!, store)?.map((c) => (c as Extract<ColumnSpec, { kind: "metric" }>).id)).toEqual(["pb", "ev_ebitda", "earnings_yield", "fcf_yield", "price_to_sales", "peg"]);
    const growth = COLUMN_PRESETS.find((p) => p.id === "growth");
    expect(presetColumns(growth!, store)).toBeNull();
  });

  it("recognises the active preset; no columns means Overview", () => {
    const valuation = COLUMN_PRESETS.find((p) => p.id === "valuation")!;
    expect(activePreset(null, store)).toBe("overview");
    expect(activePreset(presetColumns(valuation, store), store)).toBe("valuation");
    expect(activePreset([{ kind: "metric", id: "pb" }], store)).toBeNull();
  });
});
