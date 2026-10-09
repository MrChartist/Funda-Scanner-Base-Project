import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { DataProvider, FundamentalsDataset, StockRow } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { useDataset } from "@/hooks/use-dataset";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { getDataProvider, getProviderSwitchCount, loadDataset, setDataProvider, subscribeDataProvider } from "./registry";

const row: StockRow = {
  symbol: "alpha", name: "Alpha Ltd", sector: "IT", industry: "Software", market_cap: 1000, price: 50, pe: 20, eps: 2.5,
  price_book: Number.NaN, roe: 18, roce: 22, debt_equity: 0.1, debt_ebitda: 0.3, dividend_yield: 1, sales_growth: 12,
  profit_growth: 15, fcf_yield: 4,
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function named(name: string, symbols: string[]): FundamentalsDataset {
  const ds = createTinyDataset();
  ds.meta.name = name;
  ds.companies = ds.companies.filter((c) => symbols.includes(c.symbol));
  return ds;
}

afterEach(() => setDataProvider(createSampleProvider()));

describe("registry", () => {
  it("starts with the sample provider and notifies listeners on every switch", () => {
    setDataProvider(createSampleProvider());
    expect(getDataProvider().id).toBe("sample");
    let calls = 0;
    const off = subscribeDataProvider(() => calls++);
    const before = getProviderSwitchCount();
    const v0: DataProvider = { id: "csv", name: "My CSV", isDemo: false, getUniverse: async () => [row] };
    setDataProvider(v0);
    expect(getDataProvider()).toBe(v0);
    expect(calls).toBe(1);
    expect(getProviderSwitchCount()).toBe(before + 1);
    off();
    setDataProvider(createSampleProvider());
    expect(calls).toBe(1);
  });

  it("rejects a provider without a loader", () => {
    expect(() => setDataProvider({ id: "x", name: "x", isDemo: false })).toThrow(/getDataset\(\) or getUniverse\(\)/);
  });

  it("wraps a v0 provider into a snapshot-only dataset", async () => {
    const ds = await loadDataset({ id: "v0", name: "Legacy", isDemo: false, getUniverse: async () => [row, { ...row, symbol: "ALPHA", pe: 25 }] });
    expect(ds.meta).toMatchObject({ name: "Legacy", source: "custom_provider", isSynthetic: false });
    expect(ds.companies).toHaveLength(1); // the later duplicate wins
    expect(ds.companies[0]).toMatchObject({ symbol: "ALPHA", annual: [], snapshot: { pe: 25, roce: 22 } });
    expect(ds.companies[0].snapshot).not.toHaveProperty("pb"); // NaN omitted
    const demo = await loadDataset({ id: "d", name: "Demo", isDemo: true, getUniverse: async () => [row] });
    expect(demo.meta).toMatchObject({ isSynthetic: true, source: "synthetic_sample" });
  });

  it("normalises a custom v2 provider's data (NaN becomes null, symbols upper-cased)", async () => {
    const raw = createTinyDataset();
    raw.companies[0].symbol = "tinymfg";
    raw.companies[0].annual[0].revenue = Number.NaN;
    const p: DataProvider = { id: "api", name: "My API", isDemo: false, getDataset: async () => raw };
    const ds = await loadDataset(p);
    expect(ds.companies[0].symbol).toBe("TINYMFG");
    expect(ds.companies[0].annual[0].revenue).toBeNull();
    expect(raw.companies[0].symbol).toBe("tinymfg"); // input untouched
  });
});

describe("useDataset and provider switches (React Query key)", () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(QueryClientProvider, { client }, children);
  }

  it("switching provider mid-load returns the latest provider's data", async () => {
    const slow = deferred<FundamentalsDataset>();
    const a: DataProvider = { id: "a", name: "A", isDemo: false, revision: 0, getDataset: () => slow.promise };
    const b: DataProvider = { id: "b", name: "B", isDemo: false, revision: 0, getDataset: async () => named("Dataset B", ["TINYSOFT", "TINYNEW"]) };
    setDataProvider(a);
    const { result } = renderHook(() => useDataset(), { wrapper });
    expect(result.current.status).toBe("loading");
    act(() => setDataProvider(b));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const readyB = result.current;
    expect(readyB.status === "ready" && readyB.dataset.meta.name).toBe("Dataset B");
    // A finishes late; the hook still shows B.
    await act(async () => {
      slow.resolve(named("Dataset A", ["TINYMFG"]));
      await slow.promise;
    });
    const after = result.current;
    expect(after.status).toBe("ready");
    expect(after.status === "ready" && after.dataset.meta.name).toBe("Dataset B");
    expect(after.status === "ready" && after.store.size).toBe(2);
    expect(after.provider).toBe(b);
  });

  it("a new revision of the same provider id reloads", async () => {
    const one: DataProvider = { id: "imported", name: "One", isDemo: false, revision: 1, getDataset: async () => named("One", ["TINYMFG"]) };
    setDataProvider(one);
    const { result } = renderHook(() => useDataset(), { wrapper });
    await waitFor(() => expect(result.current.status === "ready" && result.current.dataset.meta.name).toBe("One"));
    const two: DataProvider = { ...one, name: "Two", revision: 2, getDataset: async () => named("Two", ["TINYSOFT"]) };
    act(() => setDataProvider(two));
    await waitFor(() => expect(result.current.status === "ready" && result.current.dataset.meta.name).toBe("Two"));
  });

  it("reports a failing provider as an error with a retry", async () => {
    let fail = true;
    const p: DataProvider = {
      id: "flaky", name: "Flaky", isDemo: false,
      getDataset: async () => {
        if (fail) throw new Error("Server said no.");
        return named("Recovered", ["TINYMFG"]);
      },
    };
    setDataProvider(p);
    const { result } = renderHook(() => useDataset(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    const err = result.current;
    expect(err.status === "error" && err.message).toBe("Server said no.");
    fail = false;
    act(() => {
      if (err.status === "error") err.retry();
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
