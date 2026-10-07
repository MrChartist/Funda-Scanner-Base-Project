// src/test/integration/company-sections.test.tsx — §G.3: every CompanySectionId that a rule can
// point at (and every other deep-link id) is rendered on the company page, so a "see section"
// link from a check never lands on nothing.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { COMPANY_SECTION_IDS } from "@/lib/contracts";
import { setDataProvider } from "@/lib/data";
import { CHECK_RULES } from "@/lib/insights";
import { generateSampleDataset } from "@/lib/sample";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import CompanyDetail from "@/pages/CompanyDetail";

vi.setConfig({ testTimeout: 30000 });

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  setDataProvider(createSampleProvider());
});

describe("company page sections (§G.3)", () => {
  it("renders every section id used by a rule, and in fact every section id", async () => {
    const ds = generateSampleDataset();
    setDataProvider({ id: "sections", name: ds.meta.name, isDemo: true, revision: 0, getDataset: async () => ds });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[`/company/${ds.companies[0].symbol}`]}>
            <Routes>
              <Route path="/company/:symbol" element={<CompanyDetail />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1 }, { timeout: 15000 });
    const used = new Set(CHECK_RULES.map((r) => r.section));
    expect(used.size).toBeGreaterThan(3);
    for (const id of COMPANY_SECTION_IDS) expect(document.getElementById(id), `section #${id}`).not.toBeNull();
    for (const id of used) expect(document.getElementById(id), `rule section #${id}`).not.toBeNull();
  });
});
