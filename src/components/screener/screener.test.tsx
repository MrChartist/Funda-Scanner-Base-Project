// RTL tests for the Screener page (spec §E.7 acceptance). They run against the real 150-company
// sample dataset through the real engine, so the numbers on screen are the engine's numbers.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { DataProvider, FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { setDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { TEMPLATES, runScreen } from "@/lib/screen";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { Toaster } from "@/components/ui/toaster";
import Screener from "@/pages/Screener";
import { buildSegments } from "./highlight";

// A full page render in jsdom with Radix and a 150-row dataset takes about a second.
vi.setConfig({ testTimeout: 30000 });

const FORBIDDEN = /\b(buy|sell|strong buy|avoid|fraud|multibagger|target price|guaranteed|sure shot|will go bankrupt)\b/i;

let dataset: FundamentalsDataset;
let store: MetricStore;

function providerFor(getDataset: DataProvider["getDataset"]): DataProvider {
  return { id: "screener-test", name: "Sample data (150 fictional companies)", isDemo: true, revision: 0, getDataset };
}

beforeAll(async () => {
  dataset = await createSampleProvider().getDataset();
  store = createStore(dataset);
  // Radix primitives expect these browser APIs.
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
});

beforeEach(() => {
  localStorage.clear();
  window.innerWidth = 1280;
  setDataProvider(providerFor(async () => dataset));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Where() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname}{loc.search}</output>;
}

function renderScreener(url = "/screener") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/screener" element={<Screener />} />
          <Route path="/company/:symbol" element={<p>Company page</p>} />
          <Route path="/compare" element={<p>Compare page</p>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

async function ready(url?: string) {
  renderScreener(url);
  await screen.findByRole("heading", { name: "Your rules" });
}

const summary = () => screen.getByTestId("results-summary");
const tab = (name: RegExp | string) => screen.getByRole("tab", { name });
const openTab = (name: RegExp | string) => fireEvent.mouseDown(tab(name), { button: 0 });
/** The panel a tab controls (the page has two tab groups, so there are several tabpanels). */
const panelOf = (name: RegExp | string) => document.getElementById(tab(name).getAttribute("aria-controls") ?? "") as HTMLElement;
const queryBox = () => screen.getByRole("textbox", { name: "Query" }) as HTMLTextAreaElement;

function type(text: string) {
  fireEvent.change(queryBox(), { target: { value: text } });
}

/** Opens a Radix Select by keyboard and picks an option by its visible name. */
function choose(trigger: HTMLElement, option: string | RegExp) {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const item = screen.getByRole("option", { name: option });
  fireEvent.keyDown(item, { key: "Enter" });
}

function expectedCount(query: string): number {
  return runScreen(store, { query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] }).matchCount;
}

/** Applies a template from the template bar (the chips above the results). */
function useTemplateCard(title: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${title}(,|$)`) }));
}

describe("Screener: default view and honest labelling", () => {
  it("shows the results first: the table is populated, the template bar is compact, Simple rules is the default tab", async () => {
    await ready();
    expect(screen.getByRole("tab", { name: "Simple rules", selected: true })).toBeInTheDocument();
    // The table is already there with every company, and the gallery is folded away.
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(summary()).toHaveTextContent("150 of 150 match");
    expect(screen.queryByRole("heading", { name: /about the templates/i })).toBeNull();
    for (const t of TEMPLATES) expect(screen.getByRole("button", { name: new RegExp(`^${t.title}(,|$)`) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import data/i })).toBeInTheDocument();
    // The one data-source badge lives in the Header, not on this page.
    expect(screen.queryByLabelText(/data source/i)).toBeNull();
  });

  it("uses no forbidden words and always shows the plain-English preview", async () => {
    await ready();
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN);
    expect(screen.getByTestId("plain-english")).toHaveTextContent(/no rules yet/i);
    useTemplateCard("Quality compounders");
    expect(await screen.findByTestId("plain-english")).toHaveTextContent(/ROCE/);
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("shows a skeleton with 'Loading data…' while loading, then the page", async () => {
    let release: (d: FundamentalsDataset) => void = () => {};
    setDataProvider(providerFor(() => new Promise<FundamentalsDataset>((r) => { release = r; })));
    renderScreener();
    expect(screen.getByText("Loading data…")).toBeInTheDocument();
    expect(screen.queryByText(/no companies match/i)).toBeNull();
    await act(async () => release(dataset));
    expect(await screen.findByRole("heading", { name: "Your rules" })).toBeInTheDocument();
    expect(screen.queryByText("Loading data…")).toBeNull();
  });

  it("shows the message and a Retry button on error, never 'No companies match'", async () => {
    let fail = true;
    setDataProvider(providerFor(async () => {
      if (fail) throw new Error("The file is damaged.");
      return dataset;
    }));
    renderScreener();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The file is damaged.");
    expect(screen.queryByText(/no companies match/i)).toBeNull();
    expect(screen.queryByText(/no stocks match/i)).toBeNull();
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Your rules" })).toBeInTheDocument();
  });
});

describe("Screener: templates", () => {
  it("applies a template to an empty screen and shows an Undo toast", async () => {
    await ready();
    useTemplateCard("Quality compounders");
    expect(screen.getByRole("listitem", { name: "Rule 1" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Rule 4" })).toBeInTheDocument();
    expect(await screen.findByText("Quality compounders applied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Rule 1" })).toBeNull());
    expect(summary()).toHaveTextContent("150 of 150 match");
  });

  it("adds a template to existing rules, then Undo returns to the original rules", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    useTemplateCard("Reliable dividend payers");
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Replace my rules" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to my rules" }));
    await waitFor(() => expect(screen.getByRole("listitem", { name: "Rule 5" })).toBeInTheDocument());
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Rule 2" })).toBeNull());
    expect(screen.getByRole("listitem", { name: "Rule 1" })).toBeInTheDocument();
  });

  it("replaces existing rules when asked", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    useTemplateCard("Steady growers");
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Replace my rules" }));
    await waitFor(() => expect(screen.getByRole("listitem", { name: "Rule 4" })).toBeInTheDocument());
    expect(screen.queryByRole("listitem", { name: "Rule 5" })).toBeNull();
  });

  it("the lenders template shows 'not applicable' chips in the ROCE column", async () => {
    await ready();
    useTemplateCard("Lenders with clean books");
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    const table = screen.getByRole("table");
    await waitFor(() => expect(table.querySelectorAll('[data-null-reason="not_applicable_financial"]').length).toBeGreaterThan(0));
    const roceHeader = within(table).getByRole("columnheader", { name: /ROCE/ });
    const col = Array.from(roceHeader.parentElement?.children ?? []).indexOf(roceHeader);
    const firstRow = table.querySelector("tbody tr");
    expect(firstRow?.children[col].querySelector('[data-null-reason="not_applicable_financial"]')).not.toBeNull();
  });
});

describe("Screener: query mode", () => {
  it("typing a query updates the live count after the debounce", async () => {
    await ready();
    expect(summary()).toHaveTextContent("150 of 150 match");
    openTab("Query");
    type("roce > 15");
    const n = expectedCount("roce > 15");
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(150);
    await waitFor(() => expect(summary()).toHaveTextContent(new RegExp(`${n} of 150 match`)));
    // The results header is a polite live region.
    expect(summary().querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("Ctrl+Enter runs immediately", async () => {
    await ready();
    openTab("Query");
    type("pe < 15");
    fireEvent.keyDown(queryBox(), { key: "Enter", ctrlKey: true });
    const n = expectedCount("pe < 15");
    expect(summary()).toHaveTextContent(new RegExp(`${n} of 150 match`));
  });

  it("a typo shows a suggestion and keeps the previous results; the suggestion fixes it", async () => {
    await ready();
    openTab("Query");
    type("roce > 15");
    const n = expectedCount("roce > 15");
    await waitFor(() => expect(summary()).toHaveTextContent(new RegExp(`${n} of 150 match`)));
    type("rocee > 15");
    const fix = await screen.findByRole("button", { name: /Use Return on capital employed \(roce\)/ });
    expect(screen.getByRole("list", { name: "Query issues" })).toHaveTextContent(/line 1, column 1/i);
    expect(screen.getByText(/Your query has an error\. Results below are from the last valid query\./)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 400));
    expect(summary()).toHaveTextContent(new RegExp(`${n} of 150 match`));
    fireEvent.click(fix);
    expect(queryBox().value).toBe("roce > 15");
    await waitFor(() => expect(screen.queryByText(/Results below are from the last valid query/)).toBeNull());
  });

  it("draws the highlight layer from React text spans only, with squiggles for issues", async () => {
    await ready();
    openTab("Query");
    type('roce > 15 AND <img src=x onerror="alert(1)">');
    const layer = screen.getByTestId("highlight-layer");
    expect(layer.querySelector("img")).toBeNull();
    expect(layer.textContent).toContain("<img src=x");
    expect(layer.querySelector('[data-issue="error"]')).not.toBeNull();
    const segs = buildSegments("roce > 15 # note", []);
    expect(segs.map((s) => s.kind)).toContain("comment");
  });

  it("offers autocomplete with listbox semantics and inserts with Tab", async () => {
    await ready();
    openTab("Query");
    const box = queryBox();
    fireEvent.change(box, { target: { value: "roc", selectionStart: 3, selectionEnd: 3 } });
    const list = await screen.findByRole("listbox", { name: "Suggestions" });
    const options = within(list).getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(box).toHaveAttribute("aria-activedescendant", options[0].id);
    fireEvent.keyDown(box, { key: "Tab" });
    expect(box.value.startsWith("roce")).toBe(true);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Screener: simple rules (chips)", () => {
  it("editing a chip updates the text, and editing the text updates the chip", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    const value = screen.getByRole("textbox", { name: "Rule 1 value" }) as HTMLInputElement;
    expect(value.value).toBe("15");
    fireEvent.change(value, { target: { value: "20" } });
    openTab("Query");
    expect(queryBox().value).toBe("roce > 20");
    type("roce > 25\ndebt_equity < 1");
    openTab("Simple rules");
    expect((screen.getByRole("textbox", { name: "Rule 1 value" }) as HTMLInputElement).value).toBe("25");
    expect(screen.getByRole("listitem", { name: "Rule 2" })).toBeInTheDocument();
  });

  it("shows a unit suffix and 'Incomplete. Not applied.' for a blank rule", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    expect(screen.getByTestId("unit-suffix")).toHaveTextContent("%");
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(screen.getByText("Incomplete. Not applied.")).toBeInTheDocument();
    // The blank rule is not part of the query.
    openTab("Query");
    expect(queryBox().value).toBe("roce > 15");
  });

  it("clears the value when the metric changes and offers only existing period variants", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    // ROCE has period variants.
    const period = screen.getByRole("combobox", { name: "Rule 1 period" });
    fireEvent.keyDown(period, { key: "ArrowDown" });
    const names = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(names[0]).toMatch(/default/i);
    for (const n of names) expect(n).toMatch(/default|year|quarter|trailing|average|growth|total|change|variab|minimum/i);
    fireEvent.keyDown(screen.getAllByRole("option")[0], { key: "Escape" });
    // Changing the metric clears the value.
    choose(screen.getByRole("combobox", { name: "Rule 1 metric" }), "Return on equity");
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Rule 1 value" }) as HTMLInputElement).value).toBe(""));
    expect(screen.getByText("Incomplete. Not applied.")).toBeInTheDocument();
  });

  it("groups the metric picker and puts basic metrics first in Beginner view", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Rule 1 metric" }), { key: "ArrowDown" });
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0]).toHaveTextContent("Basic metrics");
    fireEvent.keyDown(screen.getAllByRole("option")[0], { key: "Escape" });
    fireEvent.click(screen.getByRole("switch", { name: "Beginner view" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Rule 1 metric" }), { key: "ArrowDown" });
    expect(screen.getAllByRole("group")[0]).not.toHaveTextContent("Basic metrics");
  });

  it("shows an advanced rule with 'Edit as text'", async () => {
    await ready("/screener?q=" + encodeURIComponent("every(roce > 15, 5y)"));
    expect(screen.getByText("Advanced rule")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit as text" }));
    expect(queryBox().value).toBe("every(roce > 15, 5y)");
  });
});

describe("Screener: results", () => {
  it("shows a captioned table with sortable headers, a median row and company links", async () => {
    await ready();
    const table = await screen.findByRole("table");
    expect(table.querySelector("caption")).not.toBeNull();
    expect(within(table).getByText("Median of matches")).toBeInTheDocument();
    const links = within(table).getAllByRole("link");
    expect(links.length).toBe(25);
    const first = links[0];
    expect(first.getAttribute("href")).toMatch(/^\/company\/[A-Z0-9%_-]+$/i);
    expect(first.textContent).toContain("(fictional)");
    // Every header button sits inside a th.
    const th = within(table).getByRole("columnheader", { name: /Company/ });
    expect(th.querySelector("button")).not.toBeNull();
  });

  it("toggles aria-sort on header click: text columns ascending first, numeric columns descending first", async () => {
    await ready();
    const table = await screen.findByRole("table");
    const company = within(table).getByRole("columnheader", { name: /Company/ });
    expect(company).toHaveAttribute("aria-sort", "none");
    fireEvent.click(within(company).getByRole("button", { name: /Company/ }));
    expect(company).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(within(company).getByRole("button", { name: /Company/ }));
    expect(company).toHaveAttribute("aria-sort", "descending");
    const pe = within(table).getByRole("columnheader", { name: /P\/E/ });
    fireEvent.click(within(pe).getByRole("button", { name: /P\/E/ }));
    expect(pe).toHaveAttribute("aria-sort", "descending");
    expect(company).toHaveAttribute("aria-sort", "none");
    fireEvent.click(within(pe).getByRole("button", { name: /P\/E/ }));
    expect(pe).toHaveAttribute("aria-sort", "ascending");
  });

  it("paginates with 25, 50 and 100 rows per page", async () => {
    await ready();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("link")).toHaveLength(25);
    expect(screen.getByText(/Page 1 of 6/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Page 2 of 6/)).toBeInTheDocument();
    choose(screen.getByRole("combobox", { name: "Rows per page" }), "50");
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(50));
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    choose(screen.getByRole("combobox", { name: "Rows per page" }), "100");
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(100));
  });

  it("lists near misses with their gap text", async () => {
    const query = "roce > 20\ndebt_equity < 1";
    await ready("/screener?q=" + encodeURIComponent(query));
    const run = runScreen(store, { query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    expect(run.nearMisses.length).toBeGreaterThan(0);
    openTab(/near misses/i);
    const panel = panelOf(/near misses/i);
    expect(within(panel).getByText(run.nearMisses[0].gapText)).toBeInTheDocument();
    expect(within(panel).getAllByRole("link").length).toBe(run.nearMisses.length);
  });

  it("shows the funnel with drop-one counts", async () => {
    const query = "roce > 20\ndebt_equity < 1";
    await ready("/screener?q=" + encodeURIComponent(query));
    openTab("Funnel");
    const run = runScreen(store, { query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    const table = within(panelOf("Funnel")).getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Without this rule" })).toBeInTheDocument();
    expect(within(table).getAllByText(String(run.funnel[0].dropOneMatches)).length).toBeGreaterThan(0);
    expect(within(table).getByText("Strictest")).toBeInTheDocument();
  });

  it("opens the Why drawer with Passes, Fails and Not checked in words", async () => {
    const query = "roce > 20\ndebt_equity < 1";
    await ready("/screener?q=" + encodeURIComponent(query));
    const run = runScreen(store, { query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    openTab(/near misses/i);
    const name = store.company(run.nearMisses[0].index).name;
    fireEvent.click(within(panelOf(/near misses/i)).getByRole("button", { name: `Rule results for ${name}` }));
    const dialog = await screen.findByRole("dialog");
    const legend = within(dialog).getByTestId("why-legend");
    for (const word of ["Passes", "Fails", "Not checked"]) expect(within(legend).getByText(word)).toBeInTheDocument();
    expect(within(dialog).getAllByText("Passes").length).toBeGreaterThan(1);
    expect(within(dialog).getAllByText("Fails").length).toBeGreaterThan(1);
  });

  it("opens the Why drawer from a table row", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    const table = await screen.findByRole("table");
    fireEvent.click(within(table).getAllByRole("button", { name: /^Why .* matched$/ })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Why it matched/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Rule 1/)).toBeInTheDocument();
  });

  it("renders cards on a narrow screen, with '(fictional)', a pass count and 'Why it matched'", async () => {
    window.innerWidth = 390;
    await ready("/screener?q=" + encodeURIComponent("roce > 15\ndebt_equity < 1"));
    await waitFor(() => expect(screen.queryByRole("table")).toBeNull());
    const cards = await screen.findAllByRole("listitem", { name: /fictional|\w/ });
    expect(cards.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Why .* matched$/ })[0]).toHaveTextContent("Why it matched ▸");
    expect(screen.getAllByText("(fictional)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2/2").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toMatch(/^\/company\//);
  });

  it("never says 'No companies match' for a query error", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce >"));
    openTab("Query");
    expect(screen.queryByText(/no companies match/i)).toBeNull();
    expect(screen.getByText(/Results will appear here/)).toBeInTheDocument();
  });

  it("says no companies match when the rules are valid but nothing passes", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 5000"));
    expect(await screen.findByText("No companies match these rules")).toBeInTheDocument();
  });
});

describe("Screener: universe, URL, save, share, export, compare", () => {
  it("keeps the URL in sync in replace mode, and reads the legacy ?sector=", async () => {
    const sector = store.sector(0);
    await ready("/screener?sector=" + encodeURIComponent(sector));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toContain("u=sector"));
    expect(screen.getByRole("combobox", { name: "Companies to screen" })).toHaveTextContent(sector);
    openTab("Query");
    type("pe < 20");
    await waitFor(() => expect(decodeURIComponent((screen.getByTestId("location").textContent ?? "").replace(/\+/g, " "))).toContain("q=pe < 20"), { timeout: 2000 });
  });

  it("changes the universe", async () => {
    await ready();
    const sector = store.sector(0);
    const inSector = Array.from({ length: store.size }, (_, i) => store.sector(i)).filter((s) => s === sector).length;
    choose(screen.getByRole("combobox", { name: "Companies to screen" }), sector);
    await waitFor(() => expect(summary()).toHaveTextContent(new RegExp(`${inSector} of ${inSector} match`)));
  });

  it("saves a screen through a dialog (no window.prompt) and reports name errors", async () => {
    const prompt = vi.spyOn(window, "prompt");
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    fireEvent.click(screen.getByRole("button", { name: "Save screen" }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save screen" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/enter a name/i);
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "My quality list" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save screen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // A second save with the same name is refused with a message.
    fireEvent.click(screen.getByRole("button", { name: "Save screen" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "my quality list" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save screen" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/already exists/i);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // It appears in Saved screens, and loading restores the rules.
    openTab("Query");
    type("pe < 5");
    fireEvent.click(screen.getByRole("button", { name: "Saved screens" }));
    const list = await screen.findByRole("dialog");
    expect(within(list).getByText("My quality list")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Load My quality list" }));
    await waitFor(() => expect(queryBox().value).toBe("roce > 15"));
    expect(prompt).not.toHaveBeenCalled();
  });

  it("copies the link, and falls back to selectable text when the clipboard is blocked", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("q=roce");
    expect(await screen.findByText("Link copied")).toBeInTheDocument();

    writeText.mockRejectedValue(new Error("blocked"));
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Link to this screen") as HTMLInputElement;
    expect(input.value).toContain("q=roce");
    expect(input).toHaveAttribute("readonly");
  });

  it("exports CSV with the SAMPLE- filename prefix", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    const created: Blob[] = [];
    Object.defineProperty(URL, "createObjectURL", { value: (b: Blob) => { created.push(b); return "blob:test"; }, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
    let downloaded = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(downloaded).toMatch(/^SAMPLE-funda-screen-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(created).toHaveLength(1);
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(created[0]);
    });
    expect(text).toContain("# Funda Scanner screen export");
  });

  it("collects companies in the compare tray and links to Compare", async () => {
    await ready();
    const table = await screen.findByRole("table");
    const boxes = within(table).getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    expect(screen.getByRole("complementary", { name: "Compare tray" })).toHaveTextContent("Compare (1 of 4)");
    fireEvent.click(within(screen.getByRole("table")).getAllByRole("checkbox")[1]);
    const link = within(screen.getByRole("complementary", { name: "Compare tray" })).getByRole("link", { name: "Compare now" });
    expect(link.getAttribute("href")).toMatch(/^\/compare\?symbols=[^,]+,[^,]+$/);
  });

  it("opens column chooser and adds a column", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Search metrics"), { target: { value: "piotroski" } });
    fireEvent.click(within(dialog).getAllByRole("button", { name: /^Add column/ })[0]);
    expect(within(dialog).getByRole("button", { name: /Remove column/ })).toBeInTheDocument();
  });
});

describe("Screener: results-first template bar", () => {
  it("shows a live match count on every template chip, equal to the engine's count", async () => {
    await ready();
    for (const t of TEMPLATES) {
      const n = expectedCount(t.query);
      const label = `${t.title}, ${n} ${n === 1 ? "match" : "matches"}`;
      expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the applied template chip as pressed and keeps 'Details' reachable from the rules line", async () => {
    await ready();
    useTemplateCard("Quality compounders");
    const chip = await screen.findByRole("button", { name: /^Quality compounders, \d+ match/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const line = screen.getByTestId("rules-summary");
    expect(line).toHaveTextContent("from Quality compounders");
    fireEvent.click(within(line).getByRole("button", { name: "Details" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("The rules")).toBeInTheDocument();
  });

  it("'More about templates' opens the described gallery in a panel and Details stays reachable", async () => {
    await ready();
    const more = screen.getByRole("button", { name: "More about templates" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    for (const t of TEMPLATES) expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();
    expect(screen.getByText(TEMPLATES[0].idea)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Details of ${TEMPLATES[0].title}` }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(TEMPLATES[0].title);
  });
});

describe("Screener: active rule chips above the results", () => {
  it("lists one removable chip per rule and removing one updates the query and the count", async () => {
    const query = "roce > 15\ndebt_equity < 1";
    await ready("/screener?q=" + encodeURIComponent(query));
    const list = screen.getByRole("list", { name: "Active rules" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    const remove = within(list).getAllByRole("button", { name: /^Remove rule:/ })[0];
    fireEvent.click(remove);
    const n = expectedCount("debt_equity < 1");
    await waitFor(() => expect(summary()).toHaveTextContent(new RegExp(`${n} of 150 match`)));
    expect(within(screen.getByRole("list", { name: "Active rules" })).getAllByRole("listitem")).toHaveLength(1);
    openTab("Query");
    expect(queryBox().value).toBe("debt_equity < 1");
  });

  it("'Clear all rules' empties the query and shows the hint", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 15"));
    fireEvent.click(screen.getByRole("button", { name: "Clear all rules" }));
    await waitFor(() => expect(summary()).toHaveTextContent("150 of 150 match"));
    expect(screen.queryByRole("list", { name: "Active rules" })).toBeNull();
    expect(screen.getByTestId("rules-summary")).toHaveTextContent(/no rules yet/i);
  });
});

describe("Screener: column presets", () => {
  it("applies a preset, marks it pressed and encodes it in the URL like other columns", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    const dialog = await screen.findByRole("dialog");
    const valuation = within(dialog).getByRole("button", { name: "Valuation" });
    expect(within(dialog).getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(valuation);
    expect(valuation).toHaveAttribute("aria-pressed", "true");
    const header = store.def("ev_ebitda")?.short ?? "";
    expect(header).not.toBe("");
    await waitFor(() => expect(within(screen.getByRole("table", { hidden: true })).getByRole("columnheader", { name: new RegExp(header.replace("/", "\\/")), hidden: true })).toBeInTheDocument());
    await waitFor(() => expect(decodeURIComponent(screen.getByTestId("location").textContent ?? "")).toContain("cols=pb,ev_ebitda"));
    // Overview returns to the defaults.
    fireEvent.click(within(dialog).getByRole("button", { name: "Overview" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).not.toContain("cols="));
  });

  it("offers all six presets", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    const dialog = await screen.findByRole("dialog");
    for (const name of ["Overview", "Valuation", "Quality", "Growth", "Balance sheet", "Cash flow"]) {
      expect(within(dialog).getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

describe("Screener: data bars", () => {
  it("draws bars as aria-hidden decoration with no text, so a value is read once", async () => {
    await ready();
    const table = await screen.findByRole("table");
    const bars = table.querySelectorAll("[data-bar]");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of Array.from(bars)) {
      expect(bar).toHaveAttribute("aria-hidden", "true");
      expect(bar.textContent).toBe("");
      const pct = Number(bar.getAttribute("data-bar"));
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
    // A ROCE cell holds its value exactly once.
    const cell = table.querySelector(`[data-metric="roce"]`);
    expect(cell).not.toBeNull();
    const td = cell?.closest("td") as HTMLElement;
    expect(td.querySelectorAll('[data-metric="roce"]')).toHaveLength(1);
    expect(within(td).getAllByText(/%/)).toHaveLength(1);
    // The scale is explained in words.
    expect(screen.getByTestId("bar-legend")).toHaveTextContent(/ranks/i);
  });

  it("gives longer bars to higher values within the listed companies", async () => {
    await ready("/screener?q=" + encodeURIComponent("roce > 0"));
    const table = await screen.findByRole("table");
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const pairs = rows.map((r) => {
      const cell = r.querySelector('[data-metric="roce"]');
      const bar = cell?.closest("td")?.querySelector("[data-bar]");
      return cell && bar ? { text: parseFloat(cell.textContent ?? "NaN"), pct: Number(bar.getAttribute("data-bar")) } : null;
    }).filter((p): p is { text: number; pct: number } => p !== null && Number.isFinite(p.text));
    expect(pairs.length).toBeGreaterThan(5);
    const hi = pairs.reduce((a, b) => (b.text > a.text ? b : a));
    const lo = pairs.reduce((a, b) => (b.text < a.text ? b : a));
    expect(hi.pct).toBeGreaterThan(lo.pct);
  });

  it("shows null reasons as muted chips in words, not bare dashes", async () => {
    await ready();
    useTemplateCard("Lenders with clean books");
    const table = await screen.findByRole("table");
    await waitFor(() => expect(table.querySelectorAll("[data-null-reason]").length).toBeGreaterThan(0));
    for (const chip of Array.from(table.querySelectorAll("[data-null-reason]"))) expect((chip.textContent ?? "").trim().length).toBeGreaterThan(1);
  });

  it("cards on a narrow screen carry mini bars that are also aria-hidden", async () => {
    window.innerWidth = 390;
    await ready();
    await waitFor(() => expect(screen.queryByRole("table")).toBeNull());
    const bars = document.querySelectorAll("li[aria-label] [data-bar]");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of Array.from(bars)) expect(bar.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByText("(fictional)").length).toBeGreaterThan(0);
  });
});

describe("Screener: empty state and keyboard", () => {
  it("suggests the rule with the largest drop-one count and can remove it", async () => {
    const query = "roce > 5000\ndebt_equity < 1";
    await ready("/screener?q=" + encodeURIComponent(query));
    const run = runScreen(store, { query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    const best = run.funnel.reduce((a, b) => (b.dropOneMatches > a.dropOneMatches ? b : a));
    const tip = await screen.findByTestId("loosen-suggestion");
    expect(tip).toHaveTextContent(`Loosen rule ${best.clause + 1} first`);
    expect(tip).toHaveTextContent(String(best.dropOneMatches));
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN);
    fireEvent.click(screen.getByRole("button", { name: `Remove rule ${best.clause + 1} and list more companies` }));
    const n = expectedCount("debt_equity < 1");
    await waitFor(() => expect(summary()).toHaveTextContent(new RegExp(`${n} of 150 match`)));
    expect(screen.queryByText("No companies match these rules")).toBeNull();
  });

  it("'/' switches to the Query tab and focuses the editor", async () => {
    await ready();
    expect(screen.queryByRole("textbox", { name: "Query" })).toBeNull();
    fireEvent.keyDown(document.body, { key: "/" });
    await waitFor(() => expect(queryBox()).toHaveFocus());
    expect(queryBox()).toHaveAttribute("data-slash-focus");
    expect(tab("Query")).toHaveAttribute("aria-selected", "true");
  });

  it("announces the result count in a polite live region and keeps aria-sort on headers", async () => {
    await ready();
    const live = summary().querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent("150 of 150 match");
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").some((h) => h.getAttribute("aria-sort") !== null)).toBe(true);
  });
});
