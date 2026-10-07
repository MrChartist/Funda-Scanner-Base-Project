import { describe, it, expect } from "vitest";
import { runScreen, getDataProvider, setDataProvider, METRICS, type DataProvider, type StockRow } from "./data-provider";
import { demoProvider } from "./demo-provider";
import { createStore } from "@/lib/engine";
import { toStockRows } from "@/lib/metrics";

const row = (o: Partial<StockRow>): StockRow => ({
  symbol: "X", name: "X Ltd", sector: "IT", industry: "IT", market_cap: 1000, price: 100, pe: 20, eps: 5,
  price_book: 3, roe: 15, roce: 18, debt_equity: 0.3, debt_ebitda: 1, dividend_yield: 1,
  sales_growth: 10, profit_growth: 12, fcf_yield: 3, ...o,
});

const rows = [
  row({ symbol: "A", roce: 25, debt_equity: 0.1, market_cap: 5000 }),
  row({ symbol: "B", roce: 12, debt_equity: 0.9, market_cap: 9000 }),
  row({ symbol: "C", roce: 18, debt_equity: 0.4, market_cap: 100 }),
];

describe("runScreen", () => {
  it("ANDs multiple conditions", () => {
    const out = runScreen(rows, { filters: [
      { metric: "roce", operator: "gt", value: 15 },
      { metric: "debt_equity", operator: "lt", value: 0.5 },
    ] });
    expect(out.map((r) => r.symbol).sort()).toEqual(["A", "C"]);
  });

  it("supports between in either bound order, and requires value2", () => {
    const f = (value: number, value2?: number) => runScreen(rows, { filters: [{ metric: "roce", operator: "between", value, value2 }] });
    expect(f(15, 20).map((r) => r.symbol)).toEqual(["C"]);
    expect(f(20, 15).map((r) => r.symbol)).toEqual(["C"]);
    expect(f(15)).toEqual([]);
  });

  it("sorts (default market cap desc) and applies limit", () => {
    expect(runScreen(rows, { filters: [] }).map((r) => r.symbol)).toEqual(["B", "A", "C"]);
    expect(runScreen(rows, { filters: [], sortKey: "roce", sortDir: "asc" }).map((r) => r.symbol)).toEqual(["B", "C", "A"]);
    expect(runScreen(rows, { filters: [], sortKey: "symbol", sortDir: "asc", limit: 2 }).map((r) => r.symbol)).toEqual(["A", "B"]);
  });

  it("excludes rows with non-finite values and never mutates the input", () => {
    const input = [row({ symbol: "N", pe: NaN }), row({ symbol: "Y", pe: 10 })];
    const copy = [...input];
    expect(runScreen(input, { filters: [{ metric: "pe", operator: "lt", value: 50 }] }).map((r) => r.symbol)).toEqual(["Y"]);
    expect(input).toEqual(copy);
  });
});

describe("providers", () => {
  it("demo provider is the sample: 150 synthetic rows through toStockRows", async () => {
    expect(demoProvider.isDemo).toBe(true);
    const ds = await demoProvider.getDataset!();
    expect(ds.meta.isSynthetic).toBe(true);
    const u = toStockRows(createStore(ds));
    expect(u).toHaveLength(150);
    expect(new Set(u.map((r) => r.symbol)).size).toBe(150);
    // Every legacy metric is either a finite number or NaN (missing), never a made-up 0 placeholder.
    for (const r of u) for (const m of METRICS) expect(typeof r[m.key]).toBe("number");
    const finite = (k: (typeof METRICS)[number]["key"]) => u.filter((r) => Number.isFinite(r[k])).length;
    expect(finite("market_cap")).toBe(150);
    expect(finite("pe")).toBeGreaterThan(100);
    expect(finite("roce")).toBeGreaterThan(100);
  });

  it("a custom provider can be plugged in", async () => {
    const custom: DataProvider = { id: "csv", name: "My CSV", isDemo: false, getUniverse: async () => rows };
    setDataProvider(custom);
    expect(getDataProvider().name).toBe("My CSV");
    setDataProvider(demoProvider);
  });
});
