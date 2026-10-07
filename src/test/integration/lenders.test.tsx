// src/test/integration/lenders.test.tsx — §G.4 #7.
// Lenders are never judged by non-lender measures. A sample bank's page shows "not applicable"
// chips (never a zero, never a blank), and a ROCE query reports the lenders under "skipped", not
// as failures.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NULL_REASONS, type FundamentalsDataset, type MetricStore } from "@/lib/contracts";
import { setDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { generateSampleDataset } from "@/lib/sample";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { runScreen } from "@/lib/screen";
import { TooltipProvider } from "@/components/ui/tooltip";
import CompanyDetail from "@/pages/CompanyDetail";

vi.setConfig({ testTimeout: 30000 });

const CTX = { watchlist: [], portfolio: [] };
let dataset: FundamentalsDataset;
let store: MetricStore;
let banks: number[];
let lenders: number[];

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  dataset = generateSampleDataset();
  store = createStore(dataset);
  lenders = [];
  banks = [];
  for (let i = 0; i < store.size; i++) {
    if (store.family(i) === "lender") lenders.push(i);
    if (store.companyType(i).type === "bank") banks.push(i);
  }
});

beforeEach(() => {
  localStorage.clear();
  setDataProvider({ id: "lenders-test", name: dataset.meta.name, isDemo: true, revision: 0, getDataset: async () => dataset });
});
afterEach(() => {
  cleanup();
  setDataProvider(createSampleProvider());
});

describe("lenders (§G.4 #7)", () => {
  it("the sample has 24 lenders", () => {
    expect(lenders).toHaveLength(24);
    expect(banks.length).toBeGreaterThan(0);
  });

  it("a sample bank's page shows not-applicable chips and lender measures", async () => {
    const symbol = store.symbols[banks[0]];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[`/company/${symbol}`]}>
            <Routes>
              <Route path="/company/:symbol" element={<CompanyDetail />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1 }, { timeout: 15000 });
    expect(screen.getAllByText("N/A for lenders").length).toBeGreaterThan(0);
    const summary = document.getElementById("summary") as HTMLElement;
    expect(within(summary).getByText("Gross NPA ratio")).toBeInTheDocument();
    expect(within(summary).getByText("Measures that do not apply to lenders")).toBeInTheDocument();
    // NAF is a null with a reason: the store agrees with the chips.
    expect(store.get("roce", banks[0])).toEqual({ v: null, reason: "not_applicable_financial", flags: 0 });
    expect(store.get("debt_equity", banks[0]).reason).toBe("not_applicable_financial");
    expect(store.get("gnpa_ratio", banks[0]).v).not.toBeNull();
  });

  it("a ROCE query reports the lenders under skipped, and none of them match or fail", () => {
    const run = runScreen(store, { query: "roce > 15", columns: null, sort: null, universe: { kind: "all" } }, CTX);
    expect(run.ok).toBe(true);
    const group = run.skipped.find((g) => g.reason === "not_applicable_financial");
    expect(group, "no not-applicable group in skipped").toBeDefined();
    expect(group?.count).toBeGreaterThanOrEqual(lenders.length);
    expect(group?.metrics).toContain("roce");
    expect(group?.message).toMatch(/lender|bank|NBFC/i);
    expect(group?.message).not.toMatch(/NaN|undefined/);
    // No lender matches...
    const matched = new Set(run.matched);
    for (const i of lenders) expect(matched.has(i), store.symbols[i]).toBe(false);
    // ...and the funnel counts them as unknown, not failed.
    const step = run.funnel[0];
    expect(step.unknown).toBeGreaterThanOrEqual(lenders.length);
    expect(step.passed + step.failed + step.unknown).toBe(run.universe.length);
    // Not a "near miss" either: a lender cannot be one rule away from passing a rule that does not apply.
    for (const nm of run.nearMisses) expect(store.family(nm.index)).not.toBe("lender");
    // Every null reason used by the engine is a known code.
    expect(NULL_REASONS).toContain("not_applicable_financial");
  });

  it("lender-only measures, by contrast, evaluate lenders", () => {
    const run = runScreen(store, { query: "gnpa_ratio < 3\nroa > 0.8", columns: null, sort: null, universe: { kind: "all" } }, CTX);
    expect(run.ok).toBe(true);
    for (const i of run.matched) expect(store.family(i)).toBe("lender");
    expect(run.matchCount).toBeGreaterThan(0);
  });
});
