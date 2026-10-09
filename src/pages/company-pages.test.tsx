// RTL tests for the Company and Compare pages (spec E.8 acceptance), plus export and copy rules.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataProvider, FundamentalsDataset } from "@/lib/contracts";
import { COMPANY_SECTION_IDS } from "@/lib/contracts";
import { setDataProvider } from "@/lib/data";
import { createStore } from "@/lib/engine";
import { generateSampleDataset } from "@/lib/sample";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { buildPrintDocument, companyCsvFilename, companyToCsv } from "@/lib/export-utils";
import { percentChange, remapHash } from "@/lib/views/company-view";
import { parseSymbols } from "@/components/compare/compare-view";
import CompanyDetail from "@/pages/CompanyDetail";
import Compare from "@/pages/Compare";

const FORBIDDEN = /\b(buy|sell|strong buy|avoid|fraud|multibagger|target price|guaranteed|sure shot|will go bankrupt)\b/i;

let sample: FundamentalsDataset;
beforeAll(() => {
  sample = generateSampleDataset();
});

function providerFor(ds: FundamentalsDataset, id: string): DataProvider {
  return { id, name: ds.meta.name, isDemo: ds.meta.isSynthetic, revision: 0, getDataset: async () => ds };
}

function Where() {
  const l = useLocation();
  return <output data-testid="where">{`${l.pathname}${l.search}${l.hash}`}</output>;
}

function renderAt(url: string, ds: FundamentalsDataset = sample, id = "sample-test") {
  setDataProvider(providerFor(ds, id));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/company/:symbol" element={<CompanyDetail />} />
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  setDataProvider(createSampleProvider());
});

describe("Company page", () => {
  it("shows the sample company as fictional, with sector, type, basis and a price date note", async () => {
    renderAt("/company/VARNEXINFO");
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Varnex Infotech Ltd (fictional)");
    expect(h1.parentElement).toHaveTextContent("IT services");
    expect(h1.parentElement).toHaveTextContent("VARNEXINFO");
    expect(screen.getByText("Non-financial company")).toBeInTheDocument();
    expect(screen.getByText("Consolidated figures")).toBeInTheDocument();
    expect(screen.getByText("price date not provided")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Follow/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compare/ })).toHaveAttribute("href", "/compare?symbols=VARNEXINFO");
    // No invented identifiers.
    expect(screen.queryByText(/BSE code|Registrar|Website/i)).toBeNull();
  });

  it("shows NAF chips and lender metrics for a bank", async () => {
    renderAt("/company/ASHUVABANK");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("N/A for lenders").length).toBeGreaterThan(0);
    const summary = document.getElementById("summary") as HTMLElement;
    expect(within(summary).getByText("Gross NPA ratio")).toBeInTheDocument();
    expect(within(summary).getByText("Provision coverage")).toBeInTheDocument();
    expect(within(summary).getByText("Measures that do not apply to lenders")).toBeInTheDocument();
    expect(screen.getByText("Bank")).toBeInTheDocument();
  });

  it("renders not-found for a symbol outside the data, with no fallback company", async () => {
    renderAt("/company/NOPE");
    expect(await screen.findByText("'NOPE' is not in the data you are viewing")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(document.getElementById("summary")).toBeNull();
  });

  it("opens the Why-score drawer with all nine Piotroski tests", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const scores = document.getElementById("scores") as HTMLElement;
    fireEvent.click(within(scores).getAllByRole("button", { name: "Why this score?" })[0]);
    const dialog = await screen.findByRole("dialog");
    const list = within(dialog).getByRole("list", { name: "The nine Piotroski tests" });
    const items = Array.from(list.querySelectorAll(":scope > li"));
    expect(items).toHaveLength(9);
    expect(items.map((li) => li.getAttribute("data-criterion"))).toEqual(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"]);
    expect(within(dialog).getByText(/Rule-based observations on the data you loaded/)).toBeInTheDocument();
  });

  it("explains the Altman score with its caveat", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const scores = document.getElementById("scores") as HTMLElement;
    fireEvent.click(within(scores).getAllByRole("button", { name: "Why this score?" })[1]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(/A distress screen, not a prediction of default/).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("list", { name: "The Altman terms" })).toBeInTheDocument();
    expect(screen.queryByText(/overall score/i)).toBeNull();
  });

  it("lists 'Not evaluated (data not provided)' entries for a company with a short history", async () => {
    renderAt("/company/VEXARISOFT");
    await screen.findByRole("heading", { level: 1 });
    const checks = document.getElementById("checks") as HTMLElement;
    const group = within(checks).getByRole("region", { name: "Not evaluated (data not provided)" });
    expect(within(group).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(within(checks).getByText("Worth checking", { exact: false })).toBeInTheDocument();
    expect(within(checks).getByText(/Rule-based observations on the data you loaded\. Not a recommendation\./)).toBeInTheDocument();
  });

  it("shows 'x of y checks passed' per area and expands to the checks", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const summary = document.getElementById("summary") as HTMLElement;
    const counts = within(summary).getAllByText(/\d+ of \d+ checks? passed/);
    expect(counts.length).toBeGreaterThan(0);
    const toggle = within(summary).getAllByRole("button", { expanded: false })[0];
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(summary).getAllByText(/^Rule: /).length).toBeGreaterThan(0);
  });

  it("has every section id in the DOM and in the section navigation", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    for (const id of COMPANY_SECTION_IDS) {
      expect(document.getElementById(id), `section #${id}`).not.toBeNull();
    }
    const nav = screen.getByRole("navigation", { name: "Sections of this page" });
    expect(within(nav).getAllByRole("link")).toHaveLength(COMPANY_SECTION_IDS.length);
  });

  it("keeps every section id for a bank, too", async () => {
    renderAt("/company/ASHUVABANK");
    await screen.findByRole("heading", { level: 1 });
    for (const id of COMPANY_SECTION_IDS) expect(document.getElementById(id), `section #${id}`).not.toBeNull();
  });

  it("says annual statements were not provided for a snapshot-only company", async () => {
    renderAt("/company/TINYSNAP", createTinyDataset(), "tiny-test");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("Annual statements were not provided in your file.").length).toBeGreaterThan(0);
    expect(screen.getByText(/values supplied in your file/)).toBeInTheDocument();
    for (const id of COMPANY_SECTION_IDS) expect(document.getElementById(id), `section #${id}`).not.toBeNull();
  });

  it("shows the provenance note instead of a freshness label", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByTestId("provenance-note")).toHaveTextContent(/FY26 · consolidated · derived from your statements/);
    expect(screen.queryByText(/minutes? ago|hours? ago|updated/i)).toBeNull();
  });

  it("remaps old hashes to the new section ids", async () => {
    renderAt("/company/VARNEXINFO#pros-cons");
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/company/VARNEXINFO#checks"));
  });

  it("shows an industry median row under ratios when enough peers exist", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const ratios = document.getElementById("ratios") as HTMLElement;
    expect(within(ratios).getAllByText("Industry median").length).toBeGreaterThan(0);
  });

  it("lists templates this company passes or does not pass", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const screens = document.getElementById("screens") as HTMLElement;
    expect(within(screens).getByText("Quality compounders")).toBeInTheDocument();
    expect(within(screens).getByText(/You have not saved any screens yet/)).toBeInTheDocument();
  });

  it("shows a peer table with a median row", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    const peers = document.getElementById("peers") as HTMLElement;
    expect(within(peers).getByText("Median of the group")).toBeInTheDocument();
    expect(within(peers).getByText("(this company)")).toBeInTheDocument();
  });

  it("uses no forbidden words in the visible text", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN);
  });

  it("follows a company and stores it in the v2 watchlist format", async () => {
    renderAt("/company/VARNEXINFO");
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Follow/ }));
    expect(screen.getByRole("button", { name: /Following/ })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("funda-followed") ?? "null")).toEqual({ v: 2, data: { symbols: ["VARNEXINFO"] } });
  });
});

describe("Compare page", () => {
  it("compares dataset companies, lists unknown symbols as 'Not in your data' and adds an Industry median column", async () => {
    renderAt("/compare?symbols=VARNEXINFO,QUELORSOFT,ZZZNOPE");
    await screen.findByRole("heading", { name: "Compare companies" });
    const table = await screen.findByRole("table", { name: /Companies compared side by side/ });
    expect(within(table).getByText("Industry median")).toBeInTheDocument();
    expect(within(table).getByText("Leads on")).toBeInTheDocument();
    expect(within(table).getAllByText(/\d+ of \d+ figures/).length).toBe(2);
    expect(screen.getByText("Not in your data")).toBeInTheDocument();
    expect(screen.getByText("ZZZNOPE")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Varnex Infotech Ltd (fictional)" })).toBeInTheDocument();
  });

  it("keeps to four companies and says which were not shown", async () => {
    renderAt("/compare?symbols=VARNEXINFO,QUELORSOFT,TALITHDIGI,MORUVATECH,ZENETHINFO");
    const table = await screen.findByRole("table", { name: /Companies compared side by side/ });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(1 + 4 + 1);
    expect(screen.getByText(/Not shown: ZENETHINFO/)).toBeInTheDocument();
  });

  it("offers a table alternative to the indexed chart and has no price overlay", async () => {
    renderAt("/compare?symbols=VARNEXINFO,QUELORSOFT");
    await screen.findByRole("table", { name: /Companies compared side by side/ });
    expect(screen.getAllByText("Show the same figures as a table")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: /Sales, indexed/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Net profit, indexed/ })).toBeInTheDocument();
    expect(screen.queryByText(/price (chart|overlay|performance)/i)).toBeNull();
  });

  it("refuses to add a company that is not in the data", async () => {
    renderAt("/compare?symbols=VARNEXINFO");
    await screen.findByRole("table", { name: /Companies compared side by side/ });
    fireEvent.change(screen.getByLabelText("Add a company"), { target: { value: "RELIANCE" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("'RELIANCE' is not in the data you are viewing.");
    expect(screen.getByTestId("where")).toHaveTextContent("/compare?symbols=VARNEXINFO");
  });

  it("adds and removes companies through the URL", async () => {
    renderAt("/compare?symbols=VARNEXINFO");
    await screen.findByRole("table", { name: /Companies compared side by side/ });
    fireEvent.change(screen.getByLabelText("Add a company"), { target: { value: "quelorsoft" } });
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("symbols=VARNEXINFO%2CQUELORSOFT"));
    fireEvent.click(screen.getByRole("button", { name: /Remove Varnex Infotech Ltd/ }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("symbols=QUELORSOFT"));
  });

  it("shows lender figures when a bank is selected", async () => {
    renderAt("/compare?symbols=ASHUVABANK,BELETHBANK");
    const table = await screen.findByRole("table", { name: /Companies compared side by side/ });
    expect(within(table).getByText("Gross NPA ratio")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN);
  });
});

describe("view helpers", () => {
  it("remaps old hashes", () => {
    expect(remapHash("#pros-cons")).toBe("checks");
    expect(remapHash("financials")).toBe("pnl");
    expect(remapHash("#peers")).toBe("peers");
    expect(remapHash("#nonsense")).toBeNull();
    expect(remapHash("")).toBeNull();
  });

  it("works out percentage change with the usual null rules", () => {
    const val = (v: number | null) => ({ v, reason: v === null ? ("missing_input" as const) : null, flags: 0 });
    expect(percentChange(val(110), val(100)).v).toBeCloseTo(10);
    expect(percentChange(val(10), val(-5))).toMatchObject({ v: null, reason: "non_positive_denominator" });
    expect(percentChange(val(null), val(5)).reason).toBe("missing_input");
  });

  it("parses compare symbols against the dataset only", () => {
    const store = createStore(sample);
    const p = parseSymbols(" varnexinfo ,VARNEXINFO,NOPE,quelorsoft", store);
    expect(p.indices.map((i) => store.symbols[i])).toEqual(["VARNEXINFO", "QUELORSOFT"]);
    expect(p.unknown).toEqual(["NOPE"]);
  });
});

describe("exports", () => {
  function hostile(): FundamentalsDataset {
    const ds = structuredClone(sample);
    ds.companies[0].name = '=HYPERLINK("http://x","Click"),Evil <img src=x onerror=alert(1)>';
    return ds;
  }

  it("writes an escaped, labelled CSV with a provenance header and the SAMPLE- prefix", () => {
    const store = createStore(hostile());
    const csv = companyToCsv(store, 0);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("# Funda Scanner company export");
    expect(lines.slice(0, 10).every((l) => l.startsWith("# "))).toBe(true);
    expect(csv).toMatch(/# Synthetic: yes \(fictional companies\)/);
    expect(csv).toMatch(/# As of: not provided/);
    const header = lines.find((l) => !l.startsWith("#")) ?? "";
    expect(header).toBe("symbol,name,section,figure,metric_id,period,unit,value,is_synthetic");
    // The formula-like name is neutralised and quoted; every data row ends with the synthetic flag.
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""Click""),Evil <img src=x onerror=alert(1)> (fictional)"`);
    const dataLines = lines.filter((l) => l && !l.startsWith("#")).slice(1);
    expect(dataLines.length).toBeGreaterThan(50);
    expect(dataLines.every((l) => l.endsWith(",true"))).toBe(true);
    expect(companyCsvFilename(store, 0)).toMatch(/^SAMPLE-funda-company-.+\.csv$/);
  });

  it("builds the print view with DOM nodes only: markup in a name stays text", () => {
    const store = createStore(hostile());
    const doc = document.implementation.createHTMLDocument("print");
    buildPrintDocument(doc, store, 0);
    expect(doc.body.querySelector("img")).toBeNull();
    expect(doc.body.querySelector("h1")?.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(doc.querySelectorAll("table").length).toBeGreaterThan(3);
    expect(doc.body.textContent).toContain("Rule-based observations on the data you loaded. Not a recommendation.");
    expect(doc.body.textContent ?? "").not.toMatch(FORBIDDEN);
  });
});

describe("source rules for the files WS6 owns", () => {
  const root = join(__dirname, "..");
  const files = [
    "pages/CompanyDetail.tsx", "pages/Compare.tsx", "lib/export-utils.ts", "lib/views/company-view.ts",
    "components/compare/CompareTable.tsx", "components/compare/CompareHistory.tsx", "components/compare/CompanyPicker.tsx",
    "components/compare/compare-view.ts", "components/company/AtAGlance.tsx", "components/company/StrengthsAndChecks.tsx",
    "components/company/ScoresSection.tsx", "components/company/WhyScoreDrawer.tsx", "components/company/ScreensPassed.tsx",
    "components/company/KeyMetrics.tsx", "components/company/FinancialStatements.tsx", "components/company/QuarterlyResults.tsx",
    "components/company/RatioTrendAnalysis.tsx", "components/company/ShareholdingPattern.tsx", "components/company/DividendAnalysis.tsx",
    "components/company/PeerComparison.tsx", "components/company/CompanyHeader.tsx", "components/company/PeriodTable.tsx",
    "components/company/ProvenanceNote.tsx", "components/company/CashFlowQuality.tsx", "components/company/TrendChart.tsx",
  ];
  it.each(files)("%s formats numbers through the shared formatters and builds no HTML strings", (f) => {
    const src = readFileSync(join(root, f), "utf8");
    expect(src).not.toMatch(/\.toFixed\(/);
    expect(src).not.toMatch(/document\.write/);
    expect(src).not.toMatch(/innerHTML|outerHTML|dangerouslySetInnerHTML/);
    expect(src).not.toMatch(/mock-data/);
  });
});
