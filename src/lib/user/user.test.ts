import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { cleanLayout, DASHBOARD_WIDGETS, layoutStore } from "./dashboard-layout";
import { portfolioStore, loadPortfolio, savePortfolio, PORTFOLIO_V0_BACKUP_KEY } from "./portfolio";
import { valuePortfolio } from "./portfolio-valuation";
import { learnModeStore } from "./learn-mode";
import { readRaw, writeRaw } from "./storage";
import { loadWatchlist, saveWatchlist, WATCHLIST_V0_BACKUP_KEY, watchlistStore } from "./watchlist";
import { xirr } from "./xirr";

beforeEach(() => localStorage.clear());

describe("watchlist storage", () => {
  it("reads a v0 string list and keeps the original as a backup on the first save", () => {
    writeRaw(STORAGE_KEYS.followed, JSON.stringify(["reliance", "TCS", "TCS", 5, ""]));
    expect(loadWatchlist().symbols).toEqual(["RELIANCE", "TCS"]);
    expect(readRaw(WATCHLIST_V0_BACKUP_KEY)).toBeNull(); // reading never writes
    saveWatchlist({ symbols: ["RELIANCE", "TCS", "INFY"] });
    expect(JSON.parse(readRaw(STORAGE_KEYS.followed) ?? "null")).toEqual({ v: 2, data: { symbols: ["RELIANCE", "TCS", "INFY"] } });
    expect(JSON.parse(readRaw(WATCHLIST_V0_BACKUP_KEY) ?? "null")).toEqual(["reliance", "TCS", "TCS", 5, ""]);
  });

  it("does not overwrite an existing backup and survives bad text", () => {
    writeRaw(STORAGE_KEYS.followed, "not json");
    expect(loadWatchlist().symbols).toEqual([]);
    saveWatchlist({ symbols: ["A"] });
    saveWatchlist({ symbols: ["A", "B"] });
    expect(readRaw(WATCHLIST_V0_BACKUP_KEY)).toBe("not json");
    expect(loadWatchlist().symbols).toEqual(["A", "B"]);
  });

  it("notifies subscribers on every save", () => {
    let calls = 0;
    const off = watchlistStore.subscribe(() => calls++);
    saveWatchlist({ symbols: ["A"] });
    saveWatchlist({ symbols: [] });
    off();
    saveWatchlist({ symbols: ["B"] });
    expect(calls).toBe(2);
  });
});

describe("portfolio storage", () => {
  it("migrates v0 holdings, dropping invalid rows", () => {
    writeRaw(
      STORAGE_KEYS.portfolio,
      JSON.stringify([
        { symbol: "tcs", qty: 5, avgCost: 3800, buyDate: "2024-03-10" },
        { symbol: "BAD", qty: 0, avgCost: 10, buyDate: "2024-03-10" },
        { symbol: "BAD2", qty: 1, avgCost: 10, buyDate: "10/03/2024" },
        { symbol: "BAD3", qty: "x", avgCost: 10, buyDate: "2024-03-10" },
      ]),
    );
    expect(loadPortfolio().holdings).toEqual([{ symbol: "TCS", qty: 5, avgCost: 3800, buyDate: "2024-03-10" }]);
    savePortfolio(loadPortfolio());
    expect(readRaw(PORTFOLIO_V0_BACKUP_KEY)).not.toBeNull();
    expect(portfolioStore.load().holdings).toHaveLength(1);
  });
});

describe("dashboard layout", () => {
  it("drops widget ids that no longer exist and adds missing ones", () => {
    writeRaw(
      STORAGE_KEYS.dashboardLayout,
      JSON.stringify([
        { id: "feeds", label: "FII/DII + News + IPO", visible: true },
        { id: "pulse", label: "Market Pulse", visible: true },
        { id: "learn", label: "x", visible: false },
        { id: "hero", label: "Search", visible: true },
      ]),
    );
    const layout = layoutStore.load();
    expect(layout.map((w) => w.id)).toEqual(["learn", ...DASHBOARD_WIDGETS.map((w) => w.id).filter((id) => id !== "learn")]);
    expect(layout[0].visible).toBe(false);
    expect(cleanLayout("nonsense").map((w) => w.id)).toEqual(DASHBOARD_WIDGETS.map((w) => w.id));
  });
});

describe("learn mode", () => {
  it("is on by default and can be turned off", () => {
    expect(learnModeStore.load()).toBe(true);
    learnModeStore.save(false);
    expect(learnModeStore.load()).toBe(false);
  });
});

describe("xirr", () => {
  it("matches a simple one-year case", () => {
    const r = xirr([{ amount: -1000, date: "2024-01-01" }, { amount: 1100, date: "2025-01-01" }]);
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(0.1, 2);
  });

  it("handles a loss and several flows", () => {
    const r = xirr([
      { amount: -1000, date: "2023-01-01" },
      { amount: -1000, date: "2024-01-01" },
      { amount: 1500, date: "2025-01-01" },
    ]);
    expect(r).not.toBeNull();
    expect(Number.isFinite(r as number)).toBe(true);
    expect(r as number).toBeLessThan(0);
  });

  it("returns null, never NaN, when the rate is undefined", () => {
    expect(xirr([])).toBeNull();
    expect(xirr([{ amount: -100, date: "2024-01-01" }])).toBeNull();
    expect(xirr([{ amount: -100, date: "2024-01-01" }, { amount: -50, date: "2025-01-01" }])).toBeNull();
    expect(xirr([{ amount: -100, date: "2024-01-01" }, { amount: 120, date: "2024-01-01" }])).toBeNull();
    expect(xirr([{ amount: -100, date: "2024-01-01" }, { amount: Number.NaN, date: "2025-01-01" }])).toBeNull();
    expect(xirr([{ amount: -100, date: "bad" }, { amount: 120, date: "2025-01-01" }])).toBeNull();
  });
});

describe("valuePortfolio", () => {
  const store = createStore(createTinyDataset());
  const sym = store.symbols[0];
  const price = store.get("price", 0).v;

  it("values holdings at the reference price and reports symbols that are not in the data", () => {
    const v = valuePortfolio(store, [
      { symbol: sym, qty: 10, avgCost: 100, buyDate: "2020-01-01" },
      { symbol: "RELIANCE", qty: 5, avgCost: 2000, buyDate: "2020-01-01" },
    ]);
    expect(v.missing.map((m) => m.holding.symbol)).toEqual(["RELIANCE"]);
    expect(v.rows).toHaveLength(1);
    if (price !== null) {
      expect(v.totals.value).toBeCloseTo(10 * price, 6);
      expect(v.totals.invested).toBe(1000);
    }
    expect(v.xirr === null || Number.isFinite(v.xirr)).toBe(true);
    if (v.xirr === null) expect(v.xirrNote).toBeTruthy();
  });

  it("has no totals and a reason for an empty list", () => {
    const v = valuePortfolio(store, []);
    expect(v.totals).toMatchObject({ invested: 0, value: 0, pricedCount: 0 });
    expect(v.xirr).toBeNull();
    expect(v.xirrNote).toBeTruthy();
  });
});
