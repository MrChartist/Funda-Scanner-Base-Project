// P0 stub behaviour (§B.11). Each owner updates or removes the cases for their module when the
// stub is replaced; the assertions marked "stub" describe only the temporary behaviour.
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen as rtl, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { STORAGE_KEYS, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN, type DataProvider, type ScreenUrlState, type StockRow } from "@/lib/contracts";
import {
  activateImportedDataset, clearImportedData, computeDataHealth, detectFileKind, getDataProvider, importFiles, loadDataset,
  setDataProvider, subscribeDataProvider,
} from "@/lib/data";
import { createStore } from "@/lib/engine";
import { CHECK_RULES, evaluateChecks, insightColumnProviders, summariseAreas } from "@/lib/insights";
import { CONCEPTS, GLOSSARY } from "@/lib/learn";
import { explainAltman, explainPiotroski, toStockRows } from "@/lib/metrics";
import {
  compileQuery, evaluateExpression, evaluateQuery, explainClause, fromChips, printQuery, suggestAt, toChips,
} from "@/lib/query";
import { generateSampleDataset, SAMPLE_SEED } from "@/lib/sample";
import { createSampleProvider } from "@/lib/sample/sample-provider";
import {
  decodeScreenUrl, deleteScreen, encodeScreenUrl, exportScreenLibrary, importScreenLibrary, loadSavedScreens, runScreen,
  saveScreen, screensPassedBy, screenToCsv, TEMPLATES, toCsvCell,
} from "@/lib/screen";
import { useCompany, useDataset } from "@/hooks/use-dataset";
import { createFixtureStore } from "./fixtures/fixture-store";
import { createTinyDataset } from "./fixtures/tiny-dataset";

const store = createStore(createTinyDataset());
const sym = (i: number) => store.symbols[i];
const all = Int32Array.from({ length: store.size }, (_, i) => i);

describe("query stub", () => {
  it("compiles `id op number` clauses joined by AND or new lines", () => {
    const q = compileQuery("roce > 15 AND pe <= 25\nmarket_cap > 100", store);
    expect(q.ok).toBe(true);
    expect(q.clauses.map((c) => c.text)).toEqual(["roce > 15", "pe <= 25", "market_cap > 100"]);
    expect(q.canonical).toBe("roce > 15 AND pe <= 25 AND market_cap > 100");
    expect(q.metrics).toEqual(["roce", "pe", "market_cap"]);
    expect(q.clauses[0].simple).toEqual({ metric: "roce", selector: null, op: ">", value: 15, value2: null });
    expect(q.english).toMatch(/Companies with missing data are not counted as matches\.$/);
    expect(q.ast && printQuery(q.ast)).toBe("roce > 15 AND pe <= 25 AND market_cap > 100");
  });

  it("treats an empty query as matching everything", () => {
    const q = compileQuery("   ", store);
    expect(q.ok).toBe(true);
    expect(q.clauses).toEqual([]);
    expect(Array.from(evaluateQuery(q, store, all).whereTri)).toEqual(new Array(store.size).fill(TRI_TRUE));
  });

  it("reports unknown metrics and anything else as errors", () => {
    expect(compileQuery("debt_equty < 0.5", store).issues[0].code).toBe("E_UNKNOWN_METRIC");
    const q = compileQuery("roce >> 15 AND every(roce > 15, 5y)", store);
    expect(q.ok).toBe(false);
    expect(q.issues.map((i) => i.code)).toEqual(["E_UNEXPECTED_TOKEN", "E_UNEXPECTED_TOKEN"]);
    expect(q.issues[1].span.start).toBe("roce >> 15 AND ".length);
    expect(Array.from(evaluateQuery(q, store, all).whereTri).every((t) => t === TRI_UNKNOWN)).toBe(true);
  });

  it("evaluates with Kleene logic, null reasons and the NIC exception", () => {
    const q = compileQuery("roce > 15", store);
    const ev = evaluateQuery(q, store, all);
    expect(ev.clauseTri[0][store.indexOf("TINYSNAP")]).toBe(TRI_TRUE);
    expect(ev.clauseTri[0][store.indexOf("TINYBANK")]).toBe(TRI_UNKNOWN);
    expect(ev.clauseReason[0][store.indexOf("TINYBANK")]).toBe(5); // not_applicable_financial
    const f = createFixtureStore({ companies: [{ symbol: "A", values: { interest_coverage: { v: null, reason: "no_interest_cost" }, roe: 15.04 } }] });
    const one = Int32Array.of(0);
    expect(evaluateQuery(compileQuery("interest_coverage > 3", f), f, one).whereTri[0]).toBe(TRI_TRUE);
    expect(evaluateQuery(compileQuery("interest_coverage < 3", f), f, one).whereTri[0]).toBe(TRI_FALSE);
    expect(evaluateQuery(compileQuery("roe = 15", f), f, one).whereTri[0]).toBe(TRI_TRUE); // display precision
    expect(evaluateQuery(compileQuery("roe = 15.0", f), f, one).whereTri[0]).toBe(TRI_TRUE);
    expect(evaluateQuery(compileQuery("roe = 15.00", f), f, one).whereTri[0]).toBe(TRI_FALSE);
  });

  it("explains a failed simple clause with its gap", () => {
    const f = createFixtureStore({ companies: [{ symbol: "A", values: { roce: 14.2 } }] });
    const q = compileQuery("roce > 15", f);
    const ev = evaluateQuery(q, f, Int32Array.of(0));
    const ex = explainClause(q, ev, 0, 0, f);
    expect(ex).toMatchObject({ result: TRI_FALSE, lhs: 14.2, rhs: 15, gapText: "0.8 points short" });
    expect(ex.detail).toBe("ROCE · 14.2%; needs above 15.0%");
  });

  it("round-trips chips, evaluates single-metric expressions and suggests ids", () => {
    const q = compileQuery("roce > 15\npe < 20", store);
    const chips = toChips(q);
    expect(chips.chips).toHaveLength(2);
    expect(fromChips(chips)).toBe("roce > 15\npe < 20");
    expect(fromChips({ chips: [{ kind: "type", id: "t", test: "lender", negated: true }], tail: "LIMIT 5" })).toBe("IS NOT lender\nLIMIT 5");
    expect(evaluateExpression("total_assets", store).column?.id).toBe("total_assets");
    expect(evaluateExpression("total_assets / 2", store).column).toBeNull();
    const s = suggestAt("roce > 1 AND debt_eq", 20, store);
    expect(s.span).toEqual({ start: 13, end: 20 });
    expect(s.items.map((i) => i.insert)).toContain("debt_equity");
  });
});

describe("screen stub", () => {
  beforeEach(() => localStorage.clear());

  it("matches and orders by market cap, then applies a display sort with nulls last", () => {
    const run = runScreen(store, { query: "market_cap > 1000", columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    expect(run.ok).toBe(true);
    expect(Array.from(run.matched).map(sym)).toEqual(["TINYSOFT", "TINYSNAP", "TINYMFG", "TINYBANK"]);
    expect(run.matchCount).toBe(4);
    expect(run.funnel).toEqual([]);
    expect(run.columns.map((c) => c.key)).toEqual(["market_cap", "pe", "roce", "roe", "debt_equity", "sales_cagr_3y", "dividend_yield"]);
    expect(run.medians.market_cap).toBe((5000 + 4200) / 2);
    const sorted = runScreen(store, { query: "market_cap > 1000", columns: [{ kind: "metric", id: "total_assets" }], sort: { key: "pe", dir: "asc" }, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    expect(sym(sorted.matched[0])).toBe("TINYSNAP");
    expect(sorted.columns.at(-1)?.key).toBe("total_assets");
  });

  it("resolves universes and warns about unknown symbols", () => {
    const run = runScreen(store, { query: "", columns: null, sort: null, universe: { kind: "watchlist" } }, { watchlist: ["tinymfg", "RELIANCE"], portfolio: [] });
    expect(Array.from(run.universe).map(sym)).toEqual(["TINYMFG"]);
    expect(run.warnings[0]).toMatchObject({ code: "W_UNKNOWN_SYMBOLS", count: 1 });
    const sector = runScreen(store, { query: "", columns: null, sort: null, universe: { kind: "sector", sector: "banks" } }, { watchlist: [], portfolio: [] });
    expect(Array.from(sector.matched).map(sym)).toEqual(["TINYBANK"]);
  });

  it("keeps TEMPLATES empty until WS4 (stub)", () => {
    expect(TEMPLATES).toEqual([]);
  });

  it("round-trips URL state, including Unicode and legacy ?sector=", () => {
    const state: ScreenUrlState = {
      v: 1, query: "roce > 15\npe < 20 # ₹ and “quotes”", columns: [{ kind: "metric", id: "roce_avg_5y" }],
      sort: { key: "roce", dir: "desc" }, universe: { kind: "sector", sector: "Metals & Mining" }, templateId: "quality", page: 2, pageSize: 50,
    };
    expect(decodeScreenUrl(new URLSearchParams(encodeScreenUrl(state).toString()))).toEqual(state);
    expect(decodeScreenUrl(new URLSearchParams("sector=Cement")).universe).toEqual({ kind: "sector", sector: "Cement" });
    expect(decodeScreenUrl(new URLSearchParams("ps=7&p=-1"))).toMatchObject({ page: 1, pageSize: 25, universe: { kind: "all" }, columns: null });
  });

  it("saves, lists, updates and deletes screens", () => {
    const a = saveScreen({ name: "Mine", description: "", query: "roce > 15", columns: [], sort: null, universe: { kind: "all" }, templateId: null });
    expect(a.v).toBe(2);
    expect(loadSavedScreens()).toHaveLength(1);
    const b = saveScreen({ ...a, query: "roce > 20" });
    expect(b.id).toBe(a.id);
    expect(b.createdAt).toBe(a.createdAt);
    expect(loadSavedScreens()[0].query).toBe("roce > 20");
    deleteScreen(a.id);
    expect(loadSavedScreens()).toEqual([]);
  });

  it("reads v0 FilterCondition[] screens and backs them up before overwriting", () => {
    const v0 = JSON.stringify([{ metric: "price_book", operator: "lt", value: 3 }, { metric: "roe", operator: "between", value: 15, value2: 25 }]);
    localStorage.setItem(STORAGE_KEYS.screens, v0);
    const screens = loadSavedScreens();
    expect(screens[0].query).toBe("pb < 3\nroe BETWEEN 15 AND 25");
    saveScreen({ name: "New", description: "", query: "pe < 20", columns: [], sort: null, universe: { kind: "all" }, templateId: null });
    expect(localStorage.getItem(`${STORAGE_KEYS.screens}.v0-backup`)).toBe(v0);
  });

  it("exports and imports the screen library, renaming clashes", () => {
    saveScreen({ name: "Quality", description: "", query: "roce > 15", columns: [], sort: null, universe: { kind: "all" }, templateId: null });
    const lib = exportScreenLibrary();
    expect(lib.kind).toBe("funda-scanner-screens");
    const res = importScreenLibrary(JSON.stringify(lib));
    expect(res).toEqual({ added: 1, renamed: 1, errors: [] });
    expect(loadSavedScreens().map((s) => s.name)).toEqual(["Quality", "Quality (2)"]);
    expect(importScreenLibrary("not json").errors).toHaveLength(1);
    expect(importScreenLibrary("{}").errors[0]).toMatch(/not a Funda Scanner screen library/);
  });

  it("guards CSV cells against injection and labels exports", () => {
    expect(toCsvCell("=CMD()")).toBe("'=CMD()");
    expect(toCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(toCsvCell(-5.2)).toBe("-5.2");
    expect(toCsvCell("-5.2")).toBe("'-5.2");
    expect(toCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsvCell(null)).toBe("");
    expect(toCsvCell(Number.NaN)).toBe("");
    const run = runScreen(store, { query: "market_cap > 1000", columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    const csv = screenToCsv(run, store);
    expect(csv.startsWith("\uFEFF# Funda Scanner screen export")).toBe(true);
    expect(csv).toContain("# Synthetic: yes (fictional companies)");
    expect(csv).toContain("# As of: not provided");
    expect(csv.split("\r\n").filter((l) => l.startsWith("TINY"))).toHaveLength(4);
    expect(csv).toContain(",true\r\n");
  });

  it("reports which screens a company passes", () => {
    const res = screensPassedBy(store, store.indexOf("TINYSNAP"), [
      { id: "a", name: "Cheap", query: "pe < 25" },
      { id: "b", name: "Very cheap", query: "pe < 10" },
      { id: "c", name: "Needs ROCE history", query: "roce_avg_5y > 15" },
      { id: "d", name: "Broken", query: "pe <" },
    ]);
    expect(res.map((r) => r.passed)).toEqual([true, false, null, null]);
  });
});

describe("metrics stub extras", () => {
  it("toStockRows produces legacy rows with NaN for missing values", () => {
    const rows = toStockRows(store);
    const snap = rows.find((r) => r.symbol === "TINYSNAP") as StockRow;
    expect(snap).toMatchObject({ pe: 22.4, price_book: 3.1, market_cap: 5000, price: 250, roce: 17.8 });
    const mfg = rows.find((r) => r.symbol === "TINYMFG") as StockRow;
    expect(mfg.market_cap).toBe(4200);
    expect(Number.isNaN(mfg.pe)).toBe(true);
  });

  it("score explainers report nothing evaluated yet (stub)", () => {
    const p = explainPiotroski(store, store.indexOf("TINYMFG"));
    expect(p).toMatchObject({ scoreId: "piotroski_f", evaluable: 0, total: 9, value: { v: null, reason: "too_few_inputs" } });
    expect(explainAltman(store, store.indexOf("TINYBANK")).value.reason).toBe("not_applicable_financial");
  });
});

describe("insights, learn and sample stubs", () => {
  it("are empty but well-formed", () => {
    expect(CHECK_RULES).toEqual([]);
    expect(evaluateChecks(store, 0)).toEqual([]);
    expect(summariseAreas(store, 0)).toEqual([]);
    expect(insightColumnProviders).toEqual([]);
    expect(GLOSSARY).toEqual({});
    expect(CONCEPTS).toEqual([]);
  });

  it("the sample is the fictional tiny dataset, deterministic and undated", async () => {
    expect(SAMPLE_SEED).toBe(24301);
    const a = generateSampleDataset();
    expect(a).toEqual(generateSampleDataset({ seed: SAMPLE_SEED }));
    expect(a.meta.isSynthetic).toBe(true);
    expect(a.meta.asOf).toBeNull();
    const p = createSampleProvider();
    expect(p.isDemo).toBe(true);
    expect((await p.getDataset?.())?.companies).toHaveLength(6);
  });
});

describe("data stub", () => {
  it("registers providers and rejects ones without a loader", async () => {
    let calls = 0;
    const off = subscribeDataProvider(() => calls++);
    const v0: DataProvider = { id: "csv", name: "My CSV", isDemo: false, getUniverse: async () => [] };
    setDataProvider(v0);
    expect(getDataProvider()).toBe(v0);
    expect(() => setDataProvider({ id: "x", name: "x", isDemo: false })).toThrow(/getDataset\(\) or getUniverse\(\)/);
    off();
    await clearImportedData();
    expect(calls).toBe(1);
    expect(getDataProvider().id).toBe("sample");
  });

  it("adapts v0 rows into a snapshot-only dataset", async () => {
    const row: StockRow = {
      symbol: "alpha", name: "Alpha Software Ltd (fictional)", sector: "IT", industry: "Software", market_cap: 1000, price: 50,
      pe: 20, eps: 2.5, price_book: Number.NaN, roe: 18, roce: 22, debt_equity: 0.1, debt_ebitda: 0.3, dividend_yield: 1,
      sales_growth: 12, profit_growth: 15, fcf_yield: 4,
    };
    const ds = await loadDataset({ id: "v0", name: "Legacy", isDemo: false, getUniverse: async () => [row] });
    const c = ds.companies[0];
    expect(c.symbol).toBe("ALPHA");
    expect(c.market).toMatchObject({ price: 50, market_cap_supplied: 1000, price_date: null });
    expect(c.snapshot).toEqual({ pe: 20, eps: 2.5, roe: 18, roce: 22, debt_equity: 0.1, debt_ebitda: 0.3, dividend_yield: 1, sales_growth: 12, profit_growth: 15, fcf_yield: 4 });
    expect(c.annual).toEqual([]);
    const s = createStore(ds);
    expect(s.get("roce", 0).v).toBe(22);
    expect(s.get("market_cap", 0)).toMatchObject({ v: 1000, flags: 32 }); // supplied market cap, flagged Provided
  });

  it("detects file kinds", () => {
    expect(detectFileKind("x.json", JSON.stringify(createTinyDataset()))).toBe("canonical_json");
    expect(detectFileKind("x.json", "[]")).toBe("snapshot");
    expect(detectFileKind("x.json", "{bad")).toBe("unknown");
    expect(detectFileKind("a.csv", "# comment\nsymbol,fiscal_year,revenue\n")).toBe("annual");
    expect(detectFileKind("q.csv", "symbol,period_end,revenue\n")).toBe("quarterly");
    expect(detectFileKind("s.csv", "symbol,period_end,promoter_pct\n")).toBe("shareholding");
    expect(detectFileKind("f.csv", "\uFEFFsymbol,name,sector,pe,roce\n")).toBe("snapshot");
    expect(detectFileKind("c.csv", "symbol,name,sector,isin\n")).toBe("companies");
    expect(detectFileKind("z.csv", "foo,bar\n")).toBe("unknown");
  });

  it("imports canonical JSON and activates it with a real import time", async () => {
    const out = await importFiles([{ name: "data.json", text: JSON.stringify(createTinyDataset()) }]);
    expect(out.report.ok).toBe(true);
    expect(out.report.companies).toBe(6);
    expect(out.dataset?.companies).toHaveLength(6);
    const bad = await importFiles([{ name: "a.csv", text: "symbol,fiscal_year\nA,2026\n" }]);
    expect(bad.dataset).toBeNull();
    expect(bad.report.ok).toBe(false);
    expect(await activateImportedDataset(out)).toEqual({ persisted: "memory" });
    const p = getDataProvider();
    expect(p.id).toBe("imported");
    const ds = await p.getDataset?.();
    expect(ds?.meta.isSynthetic).toBe(false);
    expect(ds?.meta.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await clearImportedData();
  });

  it("summarises data health", () => {
    const h = computeDataHealth(store, store.indexOf("TINYNEW"));
    expect(h.years).toEqual({ first: 2023, last: 2026, count: 3, gaps: [2024] });
    expect(h.quarters).toEqual({ count: 3, last: "2026-06-30" });
    expect(h.snapshotOnly).toBe(false);
    expect(computeDataHealth(store, store.indexOf("TINYSNAP")).snapshotOnly).toBe(true);
    expect(computeDataHealth(store, store.indexOf("TINYBANK")).typeInferred).toBe(true);
    expect(computeDataHealth(store, store.indexOf("TINYMFG")).assumedZero).toEqual([]);
  });
});

describe("use-dataset hook stub", () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  function Probe({ symbol }: { symbol: string }) {
    const ds = useDataset();
    const company = useCompany(symbol);
    return (
      <p>
        {ds.status}:{ds.status === "ready" ? ds.store.size : "-"}:{company.status}
      </p>
    );
  }

  it("loads the sample provider and resolves companies", async () => {
    await clearImportedData();
    render(<Probe symbol="tinymfg" />, { wrapper });
    expect(rtl.getByText(/^loading/)).toBeInTheDocument();
    await waitFor(() => expect(rtl.getByText("ready:6:ready")).toBeInTheDocument());
  });

  it("reports an unknown symbol as not found", async () => {
    render(<Probe symbol="RELIANCE" />, { wrapper });
    await waitFor(() => expect(rtl.getByText("ready:6:not_found")).toBeInTheDocument());
  });
});
