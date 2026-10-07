import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { STORAGE_KEYS, type MetricStore } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { GLOSSARY } from "@/lib/learn";
import { runScreen, TEMPLATES } from "@/lib/screen";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { renderWithApp } from "@/components/common/test-wrapper";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TOUR_STEPS } from "@/components/OnboardingTour";
import { dcfDefaults } from "@/pages/DCFCalculator";
import { forbiddenWordHits } from "@/test/fixtures/sample/forbidden-words";
import Dashboard from "./Dashboard";
import DCFCalculator from "./DCFCalculator";
import Learn from "./Learn";
import NotFound from "./NotFound";
import Portfolio from "./Portfolio";
import Watchlist from "./Watchlist";

vi.setConfig({ testTimeout: 30000 });

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let store: MetricStore;
const WAIT = { timeout: 15000 };

beforeAll(async () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  store = createStore(await createSampleProvider().getDataset!());
}, 30000);

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

const BANNED_DASHBOARD = /nifty|sensex|fii|dii|ipo|gainers|losers|breadth|market pulse|headline/i;

describe("Dashboard", () => {
  it("has no ticker, flows, news, IPOs, movers or breadth", async () => {
    renderWithApp(<Dashboard />);
    await screen.findByRole("heading", { name: "Guided screens" }, WAIT);
    expect(document.body.textContent ?? "").not.toMatch(BANNED_DASHBOARD);
    expect(screen.queryByText(/news/i)).toBeNull();
    expect(screen.getByRole("heading", { name: "About your data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sector medians" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learn one metric" })).toBeInTheDocument();
  });

  it("shows live match counts that equal a screen run on the loaded data", async () => {
    renderWithApp(<Dashboard />);
    await screen.findByRole("heading", { name: "Guided screens" }, WAIT);
    for (const t of TEMPLATES) {
      const run = runScreen(store, { query: t.query, columns: null, sort: t.sort, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
      const text = screen.getByTestId(`match-count-${t.id}`).textContent ?? "";
      expect(run.ok).toBe(true);
      expect(text).toContain(`${run.matchCount.toLocaleString("en-IN")} of ${run.universe.length.toLocaleString("en-IN")} companies match`);
    }
  });

  it("shows sector medians with the number of companies behind each", async () => {
    renderWithApp(<Dashboard />);
    await screen.findByRole("heading", { name: "Sector medians" }, WAIT);
    const table = screen.getByRole("table", { name: /median of .* by sector/i });
    expect(within(table).getByRole("columnheader", { name: "n" })).toBeInTheDocument();
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(3);
  });

  it("drops widgets that no longer exist from a stored layout", async () => {
    localStorage.setItem(
      STORAGE_KEYS.dashboardLayout,
      JSON.stringify([{ id: "feeds", label: "FII/DII + News + IPO", visible: true }, { id: "pulse", label: "Market Pulse", visible: true }, { id: "heatmap", label: "Sector Heatmap", visible: true }]),
    );
    renderWithApp(<Dashboard />);
    await screen.findByRole("heading", { name: "Guided screens" }, WAIT);
    expect(screen.queryByText(/FII\/DII|Market Pulse|Sector Heatmap/)).toBeNull();
  });

  it("lets the reader hide the explanations", async () => {
    renderWithApp(<Dashboard />);
    await screen.findByRole("heading", { name: "Guided screens" }, WAIT);
    expect(screen.getByText(TEMPLATES[0].idea)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: /show explanations/i }));
    await waitFor(() => expect(screen.queryByText(TEMPLATES[0].idea)).toBeNull());
  });
});

describe("Watchlist", () => {
  it("groups RELIANCE under 'Not in your current data' and shows the sample company with store columns", async () => {
    const sym = store.symbols[0];
    localStorage.setItem(STORAGE_KEYS.followed, JSON.stringify(["RELIANCE", sym]));
    renderWithApp(<Watchlist />);
    const missing = await screen.findByRole("region", { name: /not in your current data/i }, WAIT);
    expect(within(missing).getByText("RELIANCE")).toBeInTheDocument();
    const inData = screen.getByRole("region", { name: /^in your current data/i });
    expect(within(inData).getByText(sym)).toBeInTheDocument();
    expect(within(inData).getAllByText(/\(fictional\)/).length).toBeGreaterThan(0);
    expect(within(inData).queryByText("RELIANCE")).toBeNull();
    // no alerts, no sparklines
    expect(screen.queryByText(/alert|trend/i)).toBeNull();
    expect(screen.queryByText(/NaN|undefined/)).toBeNull();
  });

  it("migrates a v0 list when a symbol is removed", async () => {
    localStorage.setItem(STORAGE_KEYS.followed, JSON.stringify(["RELIANCE", store.symbols[1]]));
    renderWithApp(<Watchlist />);
    fireEvent.click(await screen.findByRole("button", { name: /remove reliance from the watchlist/i }, WAIT));
    await waitFor(() => expect(screen.queryByRole("region", { name: /not in your current data/i })).toBeNull());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.followed) ?? "null")).toEqual({ v: 2, data: { symbols: [store.symbols[1]] } });
  });

  it("explains an empty list", () => {
    renderWithApp(<Watchlist />);
    expect(screen.getByText("Your watchlist is empty")).toBeInTheDocument();
  });
});

describe("Portfolio", () => {
  it("values holdings at the reference price, reports unknown symbols and never shows NaN", async () => {
    localStorage.setItem(
      STORAGE_KEYS.portfolio,
      JSON.stringify([
        { symbol: store.symbols[0], qty: 10, avgCost: 100, buyDate: "2020-01-15" },
        { symbol: "RELIANCE", qty: 5, avgCost: 2500, buyDate: "2021-03-10" },
      ]),
    );
    renderWithApp(<Portfolio />);
    await screen.findByText(/valued at the reference price in your data \(price date: /i, {}, WAIT);
    const missing = screen.getByRole("region", { name: /not in your current data/i });
    expect(within(missing).getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("Annual return (XIRR)")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/NaN|Infinity|undefined/);
  });

  it("keeps a symbol that is not in the data when it is added", async () => {
    renderWithApp(<Portfolio />);
    fireEvent.click(await screen.findByRole("button", { name: /add holding/i }, WAIT));
    const form = screen.getByRole("form", { name: /add a holding/i });
    fireEvent.change(within(form).getByLabelText("Symbol"), { target: { value: "reliance" } });
    fireEvent.change(within(form).getByLabelText("Quantity"), { target: { value: "5" } });
    fireEvent.change(within(form).getByLabelText(/average cost/i), { target: { value: "2500" } });
    fireEvent.change(within(form).getByLabelText("Purchase date"), { target: { value: "2021-03-10" } });
    fireEvent.click(within(form).getByRole("button", { name: /add holding/i }));
    expect(await screen.findByRole("region", { name: /not in your current data/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.portfolio) ?? "null").data.holdings[0].symbol).toBe("RELIANCE");
  });

  it("asks for a valid quantity", async () => {
    renderWithApp(<Portfolio />);
    fireEvent.click(await screen.findByRole("button", { name: /add holding/i }, WAIT));
    const form = screen.getByRole("form", { name: /add a holding/i });
    fireEvent.change(within(form).getByLabelText("Symbol"), { target: { value: "ABC" } });
    fireEvent.click(within(form).getByRole("button", { name: /add holding/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/quantity/i);
  });
});

describe("Learn", () => {
  it("lists every glossary entry with a /learn#<id> anchor", () => {
    renderWithApp(<Learn />, "/learn");
    const ids = Object.keys(GLOSSARY);
    expect(ids.length).toBeGreaterThan(50);
    for (const id of ids) {
      const el = document.getElementById(id);
      expect(el, `entry ${id}`).not.toBeNull();
      expect(el?.querySelector("h4")?.textContent?.length).toBeGreaterThan(1);
    }
    expect(screen.getByRole("heading", { name: "What a screen cannot tell you" })).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBeGreaterThanOrEqual(10);
  });

  it("opens the entry named in the URL hash", () => {
    renderWithApp(<Learn />, "/learn#roce");
    const el = document.getElementById("roce") as HTMLDetailsElement;
    expect(el.open).toBe(true);
  });

  it("filters the glossary", () => {
    renderWithApp(<Learn />, "/learn");
    fireEvent.change(screen.getByLabelText("Filter the glossary"), { target: { value: "return on capital" } });
    expect(document.getElementById("roce")).not.toBeNull();
    expect(document.getElementById("market_cap")).toBeNull();
  });
});

describe("DCF calculator", () => {
  function pickSymbol(): { symbol: string; other: string } {
    const ok: string[] = [];
    for (let i = 0; i < store.size && ok.length < 2; i++) {
      const d = dcfDefaults(store, i);
      if (d.fcf !== null && d.fcf > 0 && d.shares !== null && d.netDebt !== null) ok.push(d.symbol);
    }
    return { symbol: ok[0], other: ok[1] };
  }

  const renderDcf = (symbol: string) =>
    renderWithApp(
      <Routes>
        <Route path="/dcf" element={<DCFCalculator />} />
      </Routes>,
      `/dcf?symbol=${symbol}`,
    );

  it("reads ?symbol= and takes cash flow, shares and net debt from the data", async () => {
    const { symbol } = pickSymbol();
    renderDcf(symbol.toLowerCase());
    expect(await screen.findByText(symbol, { selector: "span.font-mono" }, WAIT)).toBeInTheDocument();
    const d = dcfDefaults(store, store.indexOf(symbol));
    expect((screen.getByLabelText(/base free cash flow/i) as HTMLInputElement).value).toBe(String(Math.round(d.fcf as number)));
    expect((screen.getByLabelText(/shares outstanding/i) as HTMLInputElement).value).toBe(String(d.shares));
    expect(screen.getByRole("heading", { name: "Your assumptions" })).toBeInTheDocument();
  });

  it("gives the same result every time for a symbol, and a different range for another", async () => {
    const { symbol, other } = pickSymbol();
    renderDcf(symbol);
    const value1 = (await screen.findByTestId("dcf-value", {}, WAIT)).textContent;
    const range1 = screen.getByTestId("dcf-range").textContent;
    cleanup();
    renderDcf(symbol);
    const value2 = (await screen.findByTestId("dcf-value", {}, WAIT)).textContent;
    const range2 = screen.getByTestId("dcf-range").textContent;
    expect(value2).toBe(value1);
    expect(range2).toBe(range1);
    expect(value1).toMatch(/₹/);
    cleanup();
    renderDcf(other);
    await screen.findByTestId("dcf-value", {}, WAIT);
    expect(screen.getByTestId("dcf-range").textContent).not.toBe(range1);
  });

  it("falls back when the symbol is not in the data, and does not invent missing inputs", async () => {
    renderDcf("RELIANCE");
    expect(await screen.findByText(/RELIANCE is not in your current data/i, {}, WAIT)).toBeInTheDocument();
    // a lender has no free cash flow in the data: the field is empty and says so
    const lenderIndex = Array.from({ length: store.size }, (_, i) => i).find((i) => dcfDefaults(store, i).fcf === null);
    if (lenderIndex !== undefined) {
      cleanup();
      renderDcf(store.symbols[lenderIndex]);
      await screen.findByLabelText(/base free cash flow/i, {}, WAIT);
      expect((screen.getByLabelText(/base free cash flow/i) as HTMLInputElement).value).toBe("");
      expect(screen.queryByTestId("dcf-value")).toBeNull();
      expect(screen.getByRole("note")).toHaveTextContent(/could not be taken from your data/i);
    }
  });
});

describe("copy", () => {
  it("avoids the forbidden words on every page and in the shell", async () => {
    const pages: [string, JSX.Element, string][] = [
      ["Dashboard", <Dashboard key="d" />, "/"],
      ["Learn", <Learn key="l" />, "/learn"],
      ["Watchlist", <Watchlist key="w" />, "/watchlist"],
      ["Portfolio", <Portfolio key="p" />, "/portfolio"],
      ["DCF", <DCFCalculator key="f" />, "/dcf"],
      ["NotFound", <NotFound key="n" />, "/nope"],
    ];
    localStorage.setItem(STORAGE_KEYS.followed, JSON.stringify(["RELIANCE", store.symbols[0]]));
    for (const [name, ui, route] of pages) {
      cleanup();
      renderWithApp(ui, route);
      if (name !== "Learn" && name !== "NotFound") await waitFor(() => expect(screen.queryByText(/loading the data/i)).toBeNull(), WAIT);
      expect(forbiddenWordHits(document.body.textContent ?? ""), name).toEqual([]);
    }
    cleanup();
    renderWithApp(<><Header /><Footer /></>);
    expect(forbiddenWordHits(document.body.textContent ?? "")).toEqual([]);
    expect(forbiddenWordHits(TOUR_STEPS.map((s) => `${s.title} ${s.description} ${(s.points ?? []).join(" ")}`).join(" "))).toEqual([]);
  });
});

describe("shell", () => {
  it("keeps five items on the mobile bar and the rest behind More", () => {
    renderWithApp(<Header />);
    const bars = screen.getAllByRole("navigation", { name: "Main" });
    const mobile = bars.find((b) => b.className.includes("fixed")) as HTMLElement;
    const items = within(mobile).getAllByRole("link").length + within(mobile).getAllByRole("button").length;
    expect(items).toBe(5);
    expect(within(mobile).getByRole("button", { name: /more/i })).toBeInTheDocument();
    for (const el of within(mobile).getAllByText(/./)) expect(el.className).not.toMatch(/text-\[\d+px\]/);
  });
});
