// src/test/integration/legacy-upgrade.test.tsx — §G.4 #6.
// A browser that still holds the v0 keys (funda-imported-data, funda-screens, funda-followed with
// RELIANCE) is upgraded at boot: the import becomes a v1 dataset, the saved screen is a v2 screen
// that runs on it, and RELIANCE, which is not in the imported file, sits under "Not in your
// current data" on the Watchlist instead of silently disappearing or being invented.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { STORAGE_KEYS } from "@/lib/contracts";
import { getDataProvider, hasLegacyImport, restoreActiveProvider, setDataProvider, setStorageAdapters } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { loadSavedScreens, runScreen, V0_BACKUP_KEY } from "@/lib/screen";
import { TooltipProvider } from "@/components/ui/tooltip";
import Watchlist from "@/pages/Watchlist";

vi.setConfig({ testTimeout: 30000 });

const V0_IMPORT = JSON.stringify({
  name: "my-old-file.csv",
  rows: [
    { symbol: "alpha", name: "Alpha Ltd", sector: "IT", industry: "Software", market_cap: 1000, price: 50, pe: 20, eps: null, price_book: 3, roe: 18, roce: 22, debt_equity: 0.1, debt_ebitda: null, dividend_yield: 1, sales_growth: 12, profit_growth: 15, fcf_yield: 4 },
    { symbol: "BETA", name: "Beta Ltd", sector: "FMCG", industry: "Foods", market_cap: 5000, price: 80, pe: 12, eps: 9, price_book: 2, roe: 14, roce: 11, debt_equity: 0.4, debt_ebitda: null, dividend_yield: 2, sales_growth: 6, profit_growth: 5, fcf_yield: 3 },
    { symbol: "GAMMA", name: "Gamma Ltd", sector: "Metals", industry: "Steel", market_cap: 900, price: 20, pe: 8, eps: 2, price_book: 1, roe: 9, roce: 25, debt_equity: 0.9, debt_ebitda: null, dividend_yield: 0, sales_growth: 2, profit_growth: 1, fcf_yield: 1 },
  ],
});
const V0_SCREENS = JSON.stringify([{ name: "High return", filters: [{ metric: "roce", operator: "gt", value: 20 }] }]);

beforeEach(() => {
  localStorage.clear();
  setStorageAdapters(null);
  localStorage.setItem(STORAGE_KEYS.importedLegacy, V0_IMPORT);
  localStorage.setItem(STORAGE_KEYS.screens, V0_SCREENS);
  localStorage.setItem(STORAGE_KEYS.followed, JSON.stringify(["RELIANCE"]));
});
afterEach(() => {
  cleanup();
  setStorageAdapters(null);
  setDataProvider(createSampleProvider());
});

describe("legacy upgrade (§G.4 #6)", () => {
  it("boots onto the migrated import, removes the v0 key once it is safely stored, and keeps a screens backup", async () => {
    expect(hasLegacyImport()).toBe(true);
    const provider = restoreActiveProvider();
    expect(provider.isDemo).toBe(false);
    const dataset = await provider.getDataset();
    expect(dataset.companies.map((c) => c.symbol)).toEqual(["ALPHA", "BETA", "GAMMA"]);
    expect(dataset.meta.name).toBe("my-old-file.csv");
    expect(dataset.meta.isSynthetic).toBe(false);
    expect(dataset.companies.every((c) => c.annual.length === 0)).toBe(true);
    expect(hasLegacyImport()).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.activeSource) ?? "null")).toEqual({ v: 1, data: "imported" });
    // A second boot reads the new storage, not the old key.
    const again = await restoreActiveProvider().getDataset();
    expect(again.companies).toHaveLength(3);
  });

  it("loads the saved screen as a v2 screen and runs it on the migrated data", async () => {
    const dataset = await restoreActiveProvider().getDataset();
    const screens = loadSavedScreens();
    expect(screens).toHaveLength(1);
    expect(screens[0]).toMatchObject({ v: 2, name: "High return", query: "roce > 20" });
    expect(localStorage.getItem(V0_BACKUP_KEY)).toBe(V0_SCREENS);
    const store = createStore(dataset);
    const run = runScreen(store, { query: screens[0].query, columns: screens[0].columns, sort: screens[0].sort, universe: screens[0].universe }, { watchlist: [], portfolio: [] });
    expect(run.ok).toBe(true);
    expect(Array.from(run.matched, (i) => store.symbols[i]).sort()).toEqual(["ALPHA", "GAMMA"]);
  });

  it("shows RELIANCE under 'Not in your current data' on the Watchlist", async () => {
    await restoreActiveProvider().getDataset();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter initialEntries={["/watchlist"]}>
            <Watchlist />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    const missing = await screen.findByRole("region", { name: /not in your current data/i }, { timeout: 15000 });
    expect(within(missing).getByText("RELIANCE")).toBeInTheDocument();
    expect(getDataProvider().isDemo).toBe(false);
    // The follow is kept, not dropped: the user may import the data that contains it later.
    expect(JSON.stringify(JSON.parse(localStorage.getItem(STORAGE_KEYS.followed) ?? "null"))).toContain("RELIANCE");
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });
});
