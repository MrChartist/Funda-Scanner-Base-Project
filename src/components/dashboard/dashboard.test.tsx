import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { MetricStore } from "@/lib/contracts";
import { importFiles } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { TEMPLATES } from "@/lib/screen";
import { renderWithApp } from "@/components/common/test-wrapper";
import { DatasetCard } from "./DatasetCard";
import { SectorMedians } from "./SectorMedians";
import { UniverseScatter } from "./charts/UniverseScatter";
import { RoceHistogram } from "./charts/RoceHistogram";
import { buildHistogram, buildUniverse, niceAxis, thin } from "./charts/chart-data";

vi.setConfig({ testTimeout: 30000 });

let store: MetricStore;
let snapshotStore: MetricStore;
const FORBIDDEN = /\b(buy|sell|strong buy|avoid|fraud|multibagger|target price|guaranteed|sure shot|will go bankrupt)\b/i;

beforeAll(async () => {
  store = createStore(await createSampleProvider().getDataset!());
  const out = await importFiles([{ name: "fundamentals-sample.csv", text: readFileSync("public/sample-data/fundamentals-sample.csv", "utf8") }]);
  if (!out.dataset) throw new Error("import failed");
  snapshotStore = createStore(out.dataset);
}, 30000);

afterEach(cleanup);

describe("chart data", () => {
  it("counts every non-financial company as plotted, outlier or missing", () => {
    const u = buildUniverse(store)!;
    expect(u.eligible + u.missing).toBe(u.nonFinancial);
    expect(u.inRange.length + u.outliers).toBe(u.eligible);
    expect(u.nonFinancial + u.otherTypes).toBe(store.size);
  });
  it("histogram bins add up to the companies counted", () => {
    const h = buildHistogram(store)!;
    expect(h.bins.reduce((a, b) => a + b.count, 0)).toBe(h.n);
    expect(h.q1).toBeLessThanOrEqual(h.median);
    expect(h.median).toBeLessThanOrEqual(h.q3);
  });
  it("thins to the cap but keeps highlighted points", () => {
    const pts = Array.from({ length: 5000 }, (_, i) => ({ i, x: i, y: i }));
    const hi = new Set([1, 2, 4999]);
    const t = thin(pts, hi, 1500);
    expect(t.thinned).toBe(true);
    expect(t.shown.length).toBeLessThanOrEqual(1500);
    for (const i of hi) expect(t.shown.some((p) => p.i === i)).toBe(true);
  });
  it("nice axes are round", () => {
    const a = niceAxis(-7.3, 29.1);
    expect(a.domain[0]).toBeLessThanOrEqual(-7.3);
    expect(a.ticks.every((t) => Number.isInteger(t))).toBe(true);
  });
});

describe("Dashboard widgets", () => {
  it("About your data keeps the honest sentences", () => {
    renderWithApp(<DatasetCard store={store} dataset={{ meta: store.meta, companies: [] } as never} />);
    expect(screen.getByText("Companies")).toBeInTheDocument();
    expect(screen.getByText(/Data as of: not provided/)).toBeInTheDocument();
    expect(screen.getByText(/not live quotes/)).toBeInTheDocument();
  });

  it("scatter states coverage, offers a table with links, and the highlight updates the count", () => {
    renderWithApp(<UniverseScatter store={store} />);
    expect(screen.getByRole("heading", { name: "The universe at a glance" })).toBeInTheDocument();
    expect(screen.getByTestId("chart-takeaway").textContent).toMatch(/median ROCE is/);
    expect(screen.getByTestId("scatter-coverage").textContent).toMatch(/non-financial companies plotted/);
    expect(screen.getByTestId("scatter-coverage").textContent).toMatch(/lenders and insurers are left out/);
    expect(screen.getByText(/View as table/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /companies on the chart/i });
    const links = within(table).getAllByRole("link");
    expect(links.length).toBeGreaterThan(10);
    expect(links[0].getAttribute("href")).toMatch(/^\/company\//);
    expect(links[0].textContent).toMatch(/\(fictional\)/);

    expect(screen.getByTestId("scatter-highlight-status").textContent).toBe("");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(TEMPLATES[0].title) }));
    const status = screen.getByTestId("scatter-highlight-status").textContent ?? "";
    expect(status).toMatch(/highlighted on the chart/);
    expect(screen.getByRole("columnheader", { name: "In screen" })).toBeInTheDocument();
    const yes = within(screen.getByRole("table", { name: /companies on the chart/i })).getAllByText("Yes").length;
    expect(yes).toBe(Number(/^(\d[\d,]*) highlighted/.exec(status)?.[1].replace(/,/g, "")));
  });

  it("ranked screens say top N of M ranked", () => {
    renderWithApp(<UniverseScatter store={store} />);
    fireEvent.click(screen.getByRole("radio", { name: /Earnings yield and return on capital rank/ }));
    expect(screen.getByTestId("scatter-highlight-status").textContent).toMatch(/top 20 of \d+ ranked/);
  });

  it("sector medians chart has n, a metric switch and a table alternative", () => {
    renderWithApp(<SectorMedians store={store} />);
    expect(screen.getByRole("radio", { name: "ROCE" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /median of .* by sector/i });
    expect(within(table).getByRole("columnheader", { name: "n" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "D/E" }));
    expect(screen.getByRole("table", { name: /median of debt to equity by sector/i })).toBeInTheDocument();
    expect(screen.getByTestId("chart-takeaway").textContent).toMatch(/at least 3 companies/);
  });

  it("histogram shows median, counts and a table", () => {
    renderWithApp(<RoceHistogram store={store} />);
    expect(screen.getByTestId("chart-takeaway").textContent).toMatch(/Median ROCE is .*are above 25%/s);
    expect(screen.getByTestId("histogram-coverage").textContent).toMatch(/non-financial companies counted/);
    expect(screen.getByRole("table", { name: /by ROCE.* range/i })).toBeInTheDocument();
  });

  it("shows which fields are needed when the data is snapshot-only or tiny", () => {
    renderWithApp(<UniverseScatter store={snapshotStore} />);
    expect(screen.getByText(/needs more than your data has/i)).toBeInTheDocument();
    expect(screen.getByText(/annual statements and a price/i)).toBeInTheDocument();
    cleanup();
    renderWithApp(<RoceHistogram store={snapshotStore} />);
    expect(screen.getByText(/needs annual statements/i)).toBeInTheDocument();
  });

  it("uses none of the forbidden words", () => {
    renderWithApp(
      <>
        <UniverseScatter store={store} />
        <SectorMedians store={store} />
        <RoceHistogram store={store} />
      </>,
    );
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN);
  });
});
