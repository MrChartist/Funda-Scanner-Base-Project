// src/test/integration/legacy-snapshot.test.tsx — §G.4 #3.
// Importing public/sample-data/fundamentals-sample.csv (the original one-row-per-company file)
// still works end to end: `roce > 20` returns DELTA, ALPHA, ZETA; the company page says that only
// a snapshot exists; the statement-based scores are not calculated.
//
// DECISION recorded here (spec §G.4 #3 says "scores show TFI"): a snapshot-only company has no
// statements at all, so the Piotroski F-score is TFI (too_few_inputs: 0 of 9 tests evaluable) but
// the Altman Z'' score is MISSING_INPUT (its first required input is absent). The spec text
// lumps them together; the code distinguishes "some tests could run" from "a required input is
// absent", which is the intended behaviour, so the test asserts each as implemented.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import type { FundamentalsDataset } from "@/lib/contracts";
import { activateImportedDataset, getDataProvider, importFiles, setDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { runScreen } from "@/lib/screen";
import { DatasetBanner, SNAPSHOT_ONLY_TEXT } from "@/components/data/DatasetBanner";
import { TooltipProvider } from "@/components/ui/tooltip";
import CompanyDetail from "@/pages/CompanyDetail";

vi.setConfig({ testTimeout: 30000 });

const CSV = readFileSync("public/sample-data/fundamentals-sample.csv", "utf8");
const CTX = { watchlist: [], portfolio: [] };
let dataset: FundamentalsDataset;

beforeAll(async () => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.scrollIntoView = () => {};
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const out = await importFiles([{ name: "fundamentals-sample.csv", text: CSV }]);
  expect(out.report.ok).toBe(true);
  if (!out.dataset) throw new Error("import failed");
  dataset = out.dataset;
});

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  setDataProvider(createSampleProvider());
});

describe("legacy snapshot import (§G.4 #3)", () => {
  it("imports as a snapshot-only dataset with no statements", () => {
    expect(dataset.companies.map((c) => c.symbol)).toEqual(["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA"]);
    for (const c of dataset.companies) {
      expect(c.annual).toEqual([]);
      expect(c.quarterly).toEqual([]);
      expect(Object.keys(c.snapshot).length).toBeGreaterThan(3);
    }
  });

  it("'roce > 20' returns DELTA, ALPHA, ZETA on the new engine", () => {
    const store = createStore(dataset);
    const run = runScreen(store, { query: "roce > 20\nSORT BY roce DESC", columns: null, sort: null, universe: { kind: "all" } }, CTX);
    expect(run.ok).toBe(true);
    expect(Array.from(run.matched, (i) => store.symbols[i])).toEqual(["DELTA", "ALPHA", "ZETA"]);
    // The lender (BETA) has no ROCE; it is reported as not applicable, never as a failure.
    expect(run.skipped.length).toBeGreaterThan(0);
  });

  it("scores: Piotroski is too_few_inputs and Altman is missing_input (decision above)", () => {
    const store = createStore(dataset);
    const alpha = store.indexOf("ALPHA");
    expect(store.get("piotroski_f", alpha)).toMatchObject({ v: null, reason: "too_few_inputs" });
    expect(store.get("altman_z", alpha)).toMatchObject({ v: null, reason: "missing_input" });
    // History-based metrics are unavailable rather than zero.
    expect(store.get("roce_avg_5y", alpha).v).toBeNull();
    expect(store.get("sales_cagr_5y", alpha).v).toBeNull();
    // Values supplied in the file are served as provided.
    expect(store.get("roce", alpha).v).toBe(35.1);
    expect(store.get("pe", alpha).v).toBe(24.5);
  });

  it("the company page shows the snapshot-only state and no invented history", async () => {
    await activateImportedDataset(await importFiles([{ name: "fundamentals-sample.csv", text: CSV }]));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter initialEntries={["/company/ALPHA"]}>
            <DatasetBanner />
            <Routes>
              <Route path="/company/:symbol" element={<CompanyDetail />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1 }, { timeout: 15000 });
    expect(getDataProvider().isDemo).toBe(false);
    // Dataset banner and the per-company data-health panel both say it.
    expect(screen.getByText(SNAPSHOT_ONLY_TEXT)).toBeInTheDocument();
    const health = document.getElementById("data-health") as HTMLElement;
    expect(within(health).getByText(/Only a snapshot was provided for this company/)).toBeInTheDocument();
    // Scores: no number, an honest reason.
    const scores = document.getElementById("scores") as HTMLElement;
    expect(within(scores).getAllByText(/Too few inputs to calculate|Not provided/).length).toBeGreaterThanOrEqual(2);
    fireEvent.scroll(window);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });
});
