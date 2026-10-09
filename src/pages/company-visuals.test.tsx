// Tests for the visual layer of the Company page: period tables, sparklines, position bars, shareholding,
// the sticky mini header and the active section link.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataProvider, FundamentalsDataset } from "@/lib/contracts";
import { setDataProvider } from "@/lib/data";
import { generateSampleDataset } from "@/lib/sample";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import CompanyDetail from "@/pages/CompanyDetail";

vi.setConfig({ testTimeout: 30000 });

let sample: FundamentalsDataset;
beforeAll(() => {
  sample = generateSampleDataset();
});

class MockIO {
  static all: MockIO[] = [];
  targets: Element[] = [];
  constructor(public cb: IntersectionObserverCallback) {
    MockIO.all.push(this);
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.targets = [];
  }
  takeRecords() {
    return [];
  }
}

/** Calls every observer that watches `target` with one entry. */
function fire(target: Element, entry: { isIntersecting: boolean; bottom?: number }) {
  for (const io of MockIO.all.filter((o) => o.targets.includes(target))) {
    act(() => {
      io.cb(
        [{ target, isIntersecting: entry.isIntersecting, boundingClientRect: { bottom: entry.bottom ?? 0, top: 0 } } as unknown as IntersectionObserverEntry],
        io as unknown as IntersectionObserver,
      );
    });
  }
}

function renderAt(url: string, ds: FundamentalsDataset = sample, id = "visuals-test") {
  const provider: DataProvider = { id, name: ds.meta.name, isDemo: ds.meta.isSynthetic, revision: 0, getDataset: async () => ds };
  setDataProvider(provider);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/company/:symbol" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  MockIO.all = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setDataProvider(createSampleProvider());
});

describe("period tables", () => {
  it("shows the latest years by default, starts scrolled to the right and offers Last 5 / All", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const pnl = document.getElementById("pnl") as HTMLElement;
    const region = within(pnl).getByRole("region", { name: /Profit and loss, in rupees crore/ });
    const heads = within(region).getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(heads.some((h) => h.startsWith("FY26"))).toBe(true);
    expect(heads.some((h) => h.startsWith("FY17"))).toBe(false);
    // The scroll container is moved to its right edge (jsdom has no layout, so scrollLeft mirrors scrollWidth = 0).
    expect(region.scrollLeft).toBe(region.scrollWidth);

    const group = within(pnl).getByRole("group", { name: /Periods shown/ });
    const last5 = within(group).getByRole("button", { name: "Last 5" });
    const all = within(group).getByRole("button", { name: "All" });
    expect(last5).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(all);
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(within(pnl).getByRole("status")).toHaveTextContent(/Showing the latest 10 of 10 periods/);
    expect(within(region).getAllByRole("columnheader").some((h) => (h.textContent ?? "").startsWith("FY17"))).toBe(true);
  });

  it("shows the latest eight quarters first", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const q = document.getElementById("quarterly") as HTMLElement;
    const region = within(q).getByRole("region", { name: /Quarterly results in rupees crore/ });
    expect(within(region).getAllByRole("columnheader").filter((h) => /^Q\d FY\d\d/.test(h.textContent ?? ""))).toHaveLength(8);
    expect(within(q).getAllByRole("button", { name: "Last 8" })[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("has sparkline rows that still carry the figure as text, and says which way the latest figure moved", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const pnl = document.getElementById("pnl") as HTMLElement;
    const sparks = within(pnl).getAllByTestId("sparkline");
    expect(sparks.length).toBeGreaterThan(0);
    for (const s of sparks) expect(s).toHaveAttribute("aria-hidden", "true");
    const row = within(pnl).getByRole("row", { name: /Revenue from operations/ });
    expect(within(row).getByTestId("sparkline")).toBeInTheDocument();
    expect(row.querySelector('[data-metric="sales"]')?.textContent ?? "").toMatch(/\d/);
    expect(within(row).getAllByText(/Higher|Lower|Unchanged/).length).toBeGreaterThan(0);
  });
});

describe("summary position bars", () => {
  it("places figures within the peer range when enough companies can be compared", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const summary = document.getElementById("summary") as HTMLElement;
    const bars = within(summary).getAllByTestId("bullet");
    expect(bars.length).toBeGreaterThan(5);
    expect(bars[0].getAttribute("aria-label") ?? "").toMatch(/median of .* Range across \d+ companies/);
    expect(within(summary).getAllByText(/Industry median/, { selector: "p" }).length).toBeGreaterThan(0);
  });

  it("hides the bar and says why when too few companies can be compared", async () => {
    renderAt("/company/TINYBANK", createTinyDataset(), "tiny-visuals");
    await screen.findByRole("heading", { level: 1 });
    const summary = document.getElementById("summary") as HTMLElement;
    expect(within(summary).queryAllByTestId("bullet")).toHaveLength(0);
    expect(within(summary).getAllByText(/Too few comparable companies to place this figure/).length).toBeGreaterThan(0);
  });

  it("writes a plain-language caption per group from the data", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const summary = document.getElementById("summary") as HTMLElement;
    expect(within(summary).getByText(/was above the industry median in \d+ of the last \d+ years\./)).toBeInTheDocument();
  });
});

describe("shareholding", () => {
  it("says so when a holding is zero in every quarter, and keeps the table behind a disclosure", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const sh = document.getElementById("shareholding") as HTMLElement;
    expect(within(sh).getByRole("note")).toHaveTextContent(/Promoter is zero in every quarter in the data/);
    expect(within(sh).getByText("View as table")).toBeInTheDocument();
    expect(within(sh).queryByRole("table")).toBeNull();
    expect(within(sh).getByTestId("latest-split")).toBeInTheDocument();
    const details = within(sh).getByText("View as table").closest("details") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(within(sh).getAllByRole("table").length).toBeGreaterThan(0);
  });
});

describe("sticky bars", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIO);
  });

  it("shows a mini header with the name, price and Follow once the header card has scrolled away", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByTestId("mini-header")).toBeNull();
    const header = document.getElementById("company-header") as HTMLElement;
    fire(header, { isIntersecting: false, bottom: -20 });
    const mini = await screen.findByTestId("mini-header");
    expect(mini).toHaveTextContent("Varnex Infotech Ltd");
    expect(within(mini).getByRole("button", { name: /Follow/ })).toBeInTheDocument();
    fire(header, { isIntersecting: true, bottom: 200 });
    expect(screen.queryByTestId("mini-header")).toBeNull();
  });

  it("highlights the section being read in the section navigation", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const nav = screen.getByRole("navigation", { name: "Sections of this page" });
    expect(within(nav).getByRole("link", { name: "Summary" })).toHaveAttribute("aria-current", "location");
    fire(document.getElementById("pnl") as HTMLElement, { isIntersecting: true });
    expect(within(nav).getByRole("link", { name: "Profit and loss" })).toHaveAttribute("aria-current", "location");
    expect(within(nav).getByRole("link", { name: "Summary" })).not.toHaveAttribute("aria-current");
  });
});

describe("source rules for the visual layer", () => {
  const root = join(__dirname, "..");
  const files = [
    "components/company/viz/Sparkline.tsx", "components/company/viz/Bullet.tsx", "components/company/viz/SegmentedBar.tsx",
    "components/company/viz/chart-theme.ts", "components/company/viz/TooltipCard.tsx", "components/company/FinancialHistoryStrip.tsx",
    "components/company/CompanyPageNav.tsx", "components/compare/CompareCards.tsx",
  ];
  it.each(files)("%s formats numbers through the shared formatters and builds no HTML strings", (f) => {
    const src = readFileSync(join(root, f), "utf8");
    expect(src).not.toMatch(/\.toFixed\(/);
    expect(src).not.toMatch(/innerHTML|outerHTML|dangerouslySetInnerHTML|document\.write/);
  });
});
