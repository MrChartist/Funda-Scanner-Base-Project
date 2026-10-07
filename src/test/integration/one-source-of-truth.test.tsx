// src/test/integration/one-source-of-truth.test.tsx — §G.4 #2.
// For three sample companies, the ROCE, P/E and D/E strings rendered in the Screener row, the
// company page KeyMetrics, the Compare table and the Watchlist row are identical, and equal to
// formatMetric() on the store value. Every surface goes through <ValueCell>, so a drift here means
// a page started formatting numbers itself.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { STORAGE_KEYS, type DataProvider, type FundamentalsDataset, type MetricStore } from "@/lib/contracts";
import { setDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { formatMetric } from "@/lib/format/metric-value";
import { generateSampleDataset } from "@/lib/sample";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import CompanyDetail from "@/pages/CompanyDetail";
import Compare from "@/pages/Compare";
import Screener from "@/pages/Screener";
import Watchlist from "@/pages/Watchlist";

vi.setConfig({ testTimeout: 30000 });

const METRICS = ["roce", "pe", "debt_equity"] as const;
const WAIT = { timeout: 15000 };

let dataset: FundamentalsDataset;
let store: MetricStore;
let symbols: string[];

beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.scrollIntoView = () => {};
  proto.hasPointerCapture = () => false;
  proto.releasePointerCapture = () => {};
  proto.setPointerCapture = () => {};
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  dataset = generateSampleDataset();
  store = createStore(dataset);
  // Three non-financial companies from different sectors, each with a value for all three metrics.
  const seen = new Set<string>();
  symbols = [];
  for (let i = 0; i < store.size && symbols.length < 3; i++) {
    if (store.family(i) !== "non_financial" || seen.has(store.sector(i))) continue;
    if (METRICS.every((m) => store.get(m, i).v !== null)) {
      seen.add(store.sector(i));
      symbols.push(store.symbols[i]);
    }
  }
});

beforeEach(() => {
  localStorage.clear();
  window.innerWidth = 1280;
  const provider: DataProvider = { id: "one-source", name: dataset.meta.name, isDemo: true, revision: 0, getDataset: async () => dataset };
  setDataProvider(provider);
});
afterEach(() => {
  cleanup();
  setDataProvider(createSampleProvider());
});

function renderAt(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/screener" element={<Screener />} />
            <Route path="/company/:symbol" element={<CompanyDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/watchlist" element={<Watchlist />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

/** The text a ValueCell prints for the value itself (first text node; notes and period tags follow). */
function cellText(el: Element | null): string {
  expect(el, "value cell not found").not.toBeNull();
  const first = el?.firstChild;
  return (first?.textContent ?? "").trim();
}

function expected(symbol: string, id: string): string {
  const i = store.indexOf(symbol);
  const def = store.def(id);
  if (!def) throw new Error(id);
  return formatMetric(def, store.get(id, i));
}

describe("one source of truth (§G.4 #2)", () => {
  it("picked three comparable companies", () => {
    expect(symbols).toHaveLength(3);
    for (const s of symbols) for (const m of METRICS) expect(expected(s, m)).not.toBe("—");
  });

  it("Screener rows", async () => {
    renderAt(`/screener?v=1&u=${encodeURIComponent(`symbols:${symbols.join(",")}`)}&cols=${METRICS.join(",")}`);
    await screen.findByRole("heading", { name: "Your rules" }, WAIT);
    for (const sym of symbols) {
      const row = (await screen.findByRole("link", { name: new RegExp(`${sym}`) }, WAIT)).closest("tr");
      expect(row, sym).not.toBeNull();
      for (const m of METRICS) {
        expect(cellText((row as HTMLElement).querySelector(`[data-metric="${m}"]`)), `${sym} ${m}`).toBe(expected(sym, m));
      }
    }
  });

  it("Company KeyMetrics", async () => {
    for (const sym of symbols) {
      renderAt(`/company/${sym}`);
      await screen.findByRole("heading", { level: 1 }, WAIT);
      const summary = document.getElementById("summary") as HTMLElement;
      for (const m of METRICS) {
        const label = store.def(m)?.label ?? m;
        const dt = within(summary).getAllByText(label).map((n) => n.closest("dt")).find((d) => d !== null);
        expect(dt, `${sym} ${m} tile`).toBeTruthy();
        const tile = (dt as HTMLElement).parentElement as HTMLElement;
        expect(cellText(tile.querySelector(`dd [data-metric="${m}"]`)), `${sym} ${m}`).toBe(expected(sym, m));
      }
      cleanup();
    }
  });

  it("Compare table", async () => {
    renderAt(`/compare?symbols=${symbols.join(",")}`);
    const table = await screen.findByRole("table", { name: /Companies compared side by side/ }, WAIT);
    for (const m of METRICS) {
      const label = store.def(m)?.label ?? m;
      const row = within(table).getAllByRole("row").find((r) => within(r).queryAllByText(label).length > 0 && r.querySelector(`[data-metric="${m}"]`));
      expect(row, `compare row ${m}`).toBeTruthy();
      const cells = Array.from((row as HTMLElement).querySelectorAll(`[data-metric="${m}"]`));
      // Company cells come first, in the order of the URL; an industry-median cell may follow.
      symbols.forEach((sym, k) => expect(cellText(cells[k]), `${sym} ${m}`).toBe(expected(sym, m)));
    }
  });

  it("Watchlist rows", async () => {
    localStorage.setItem(STORAGE_KEYS.followed, JSON.stringify(symbols));
    renderAt("/watchlist");
    await screen.findByRole("region", { name: /^in your current data/i }, WAIT);
    for (const sym of symbols) {
      const row = screen.getByRole("link", { name: new RegExp(sym) }).closest("tr") as HTMLElement;
      for (const m of METRICS) expect(cellText(row.querySelector(`[data-metric="${m}"]`)), `${sym} ${m}`).toBe(expected(sym, m));
    }
    await waitFor(() => expect(document.body.textContent).not.toMatch(/NaN|undefined/));
  });
});
