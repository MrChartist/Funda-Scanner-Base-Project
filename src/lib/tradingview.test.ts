import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchStocksBySymbols, fetchScreenedStocks, fetchTopStocksCached, invalidateStockCache } from "./tradingview";

// Column order must match FIELDS in tradingview.ts
const row = (overrides: Record<number, unknown> = {}) => {
  const d: unknown[] = new Array(27).fill(null);
  Object.assign(d, {
    0: "RELIANCE", 1: "Reliance Industries", 2: "Oil & Gas", 3: "Energy Minerals", 4: 20_000_000_000_000,
    5: "INR", 6: 100.126, 7: 25.554, 8: 2845.6, 9: 1.234,
  }, overrides);
  return { s: "NSE:RELIANCE", d };
};

const mockFetch = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body });

describe("tradingview client", () => {
  beforeEach(() => invalidateStockCache());
  afterEach(() => vi.unstubAllGlobals());

  it("parses rows: strips exchange prefix, converts market cap to crore, maps sectors", async () => {
    vi.stubGlobal("fetch", mockFetch({ data: [row()] }));
    const [s] = await fetchStocksBySymbols(["RELIANCE"]);
    expect(s.symbol).toBe("RELIANCE");
    expect(s.market_cap).toBe(2_000_000); // 2e13 / 1e7
    expect(s.sector).toBe("Energy");
    expect(s.pe).toBe(25.55);
    expect(s.change_pct).toBe(1.23);
  });

  it("defaults missing values to 0 / empty rather than NaN", async () => {
    vi.stubGlobal("fetch", mockFetch({ data: [{ s: "NSE:XYZ", d: new Array(27).fill(null) }] }));
    const [s] = await fetchStocksBySymbols(["XYZ"]);
    expect(s.price).toBe(0);
    expect(s.currency).toBe("INR");
    expect(Number.isNaN(s.roce)).toBe(false);
  });

  it("always restricts screening to NSE and forwards user filters", async () => {
    const f = mockFetch({ data: [] });
    vi.stubGlobal("fetch", f);
    await fetchScreenedStocks({ filters: [{ left: "return_on_equity", operation: "greater", right: 15 }] });
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.filter[0]).toEqual({ left: "exchange", operation: "equal", right: "NSE" });
    expect(body.filter).toHaveLength(2);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false, 503));
    await expect(fetchStocksBySymbols(["TCS"])).rejects.toThrow("503");
  });

  it("caches top stocks until invalidated", async () => {
    const f = mockFetch({ data: [row()] });
    vi.stubGlobal("fetch", f);
    await fetchTopStocksCached(10);
    await fetchTopStocksCached(10);
    expect(f).toHaveBeenCalledTimes(1);
    invalidateStockCache();
    await fetchTopStocksCached(10);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
