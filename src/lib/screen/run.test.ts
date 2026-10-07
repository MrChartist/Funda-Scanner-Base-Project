import { describe, expect, it, vi } from "vitest";
import type { MetricStore, RunScreenInput, ScreenContext } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { compileQuery } from "@/lib/query";
import { createFixtureStore } from "@/test/fixtures/fixture-store";
import { annualRows, historyStore } from "@/test/fixtures/query/stores";
import { DEFAULT_COLUMNS, runScreen, screensPassedBy } from "./index";

const ctx: ScreenContext = { watchlist: [], portfolio: [] };
const input = (query: string, extra: Partial<RunScreenInput> = {}): RunScreenInput => ({
  query, columns: null, sort: null, universe: { kind: "all" }, ...extra,
});
const syms = (store: MetricStore, xs: Int32Array | readonly number[]) => Array.from(xs, (i) => store.symbols[i]);

describe("runScreen: matches, funnel, near misses and skipped (§D.12)", () => {
  const s = historyStore();
  const run = runScreen(s, input("roce > 15\npe < 20\ndebt_equity < 0.5"), ctx);

  it("matches only rows where every clause is TRUE", () => {
    expect(run.ok).toBe(true);
    expect(syms(s, run.matched)).toEqual(["STEADY"]);
    expect(run.matchCount).toBe(1);
    expect(run.universe).toHaveLength(6);
    expect(run.clauseTri).toHaveLength(3);
    expect(run.sortValues).toBeNull();
    expect(run.durationMs).toBe(0);
  });

  it("counts pass, fail and unknown per clause, remaining in order, drop-one and the strictest clause", () => {
    expect(run.funnel.map((f) => [f.passed, f.failed, f.unknown, f.remainingAfter, f.dropOneMatches, f.strictest])).toEqual([
      [3, 1, 2, 3, 2, false],
      [3, 2, 1, 1, 2, true],
      [3, 2, 1, 1, 1, false],
    ]);
    expect(run.funnel[0]).toMatchObject({ clause: 0, text: "roce > 15", english: "ROCE (latest FY) is above 15%" });
  });

  it("lists near misses (exactly one failed clause), nearest first, with the gap", () => {
    expect(run.nearMisses.map((n) => [s.symbols[n.index], n.clause])).toEqual([["DIPPER", 0], ["SHORTY", 1]]);
    expect(run.nearMisses[0]).toMatchObject({ lhs: 14.2, rhs: 15, gapText: "ROCE 14.2% (FY26), needs above 15% (0.8 points short)" });
    expect(run.nearMisses[0].relGap).toBeCloseTo(0.8 / 15);
    expect(run.nearMisses[1].gapText).toBe("P/E 40.0x (TTM), needs below 20x (20.0x above the limit)");
  });

  it("groups the companies that could not be evaluated", () => {
    expect(run.skipped).toEqual([
      { reason: "not_applicable_financial", count: 1, family: "lender", metrics: ["roce"],
        message: "1 lender not evaluated: ROCE does not apply to banks and NBFCs" },
    ]);
  });

  it("reports missing data and short history in skipped groups", () => {
    const r = runScreen(s, input("roce > 1"), ctx);
    expect(r.skipped.find((g) => g.reason === "missing_input")?.message).toBe("1 company skipped: data not provided (ROCE)");
    const h = runScreen(s, input("avg(sales, 5y) > 1"), ctx);
    expect(h.skipped.find((g) => g.reason === "insufficient_history")?.message).toBe(
      "2 companies skipped: not enough history for Sales",
    );
    const t = runScreen(s, input("avg(sales, 3y) > 1"), ctx);
    expect(t.skipped.find((g) => g.reason === "transition_period")?.message).toMatch(/^1 company skipped: period not comparable/);
  });

  it("uses window gaps for near misses of every()", () => {
    const r = runScreen(s, input("every(sales > 106, 5y)"), ctx);
    const d = r.nearMisses.find((n) => s.symbols[n.index] === "DIPPER");
    expect(d?.gapText).toBe("failed in 1 of 5 years (FY23: ₹105 Cr)");
    expect(d?.relGap).toBeCloseTo(0.2);
  });

  it("keeps at most 50 near misses", () => {
    const many = createFixtureStore({ companies: Array.from({ length: 80 }, (_, k) => ({ symbol: `N${k}`, values: { roe: k } })) });
    const r = runScreen(many, input("roe > 100"), ctx);
    expect(r.nearMisses).toHaveLength(50);
    expect(many.symbols[r.nearMisses[0].index]).toBe("N79");
  });

  it("returns no matches (and no funnel) for a query with errors", () => {
    const r = runScreen(s, input("roce >> 15"), ctx);
    expect(r.ok).toBe(false);
    expect(r.matched).toHaveLength(0);
    expect(r.funnel).toEqual([]);
    expect(r.skipped).toEqual([]);
    expect(r.nearMisses).toEqual([]);
    expect(r.columns.map((c) => c.key)).toEqual([...DEFAULT_COLUMNS]);
  });

  it("matches the whole universe for an empty query, ordered by market cap", () => {
    const r = runScreen(s, input(""), ctx);
    expect(syms(s, r.matched)).toEqual(["STEADY", "BANKX", "DIPPER", "TRANSIT", "SHORTY", "GAPPY"]);
  });

  it("accepts a precompiled query", () => {
    const compiled = compileQuery("pe < 20", s);
    expect(runScreen(s, input("ignored"), ctx, compiled).compiled).toBe(compiled);
  });
});

describe("ordering, LIMIT and rank", () => {
  const s = historyStore();

  it("sorts by SORT BY items with nulls last in either direction, then market cap, then symbol", () => {
    const desc = runScreen(s, input("pe > 0 SORT BY roce DESC"), ctx);
    expect(syms(s, desc.matched)).toEqual(["SHORTY", "STEADY", "TRANSIT", "DIPPER", "BANKX"]);
    const asc = runScreen(s, input("pe > 0 SORT BY roce ASC"), ctx);
    expect(syms(s, asc.matched)).toEqual(["DIPPER", "TRANSIT", "STEADY", "SHORTY", "BANKX"]);
    expect(Array.from(asc.sortValues ?? []).slice(0, 4)).toEqual([14.2, 16, 22, 30]);
    expect(Number.isNaN(asc.sortValues?.[4])).toBe(true);
    const tie = runScreen(s, input("pe > 0 SORT BY dps DESC"), ctx);
    expect(syms(s, tie.matched)).toEqual(["BANKX", "STEADY", "DIPPER", "TRANSIT", "SHORTY"]);
  });

  it("applies LIMIT after sorting and warns", () => {
    const r = runScreen(s, input("pe > 0 SORT BY pe ASC LIMIT 2"), ctx);
    expect(syms(s, r.matched)).toEqual(["BANKX", "DIPPER"]);
    expect(r.matchCount).toBe(5);
    expect(r.warnings.find((w) => w.code === "W_LIMIT_APPLIED")).toEqual({
      code: "W_LIMIT_APPLIED", count: 3, message: "Showing the top 2 of 5 matches by your SORT BY.",
    });
    const plain = runScreen(s, input("pe > 0 LIMIT 1"), ctx);
    expect(plain.warnings.find((w) => w.code === "W_LIMIT_APPLIED")?.message).toBe("Showing the top 1 of 5 matches by market cap.");
  });

  it("re-sorts only the limited set for a header-click display sort", () => {
    const r = runScreen(s, input("pe > 0 SORT BY pe ASC LIMIT 3", { sort: { key: "pe", dir: "desc" } }), ctx);
    expect(syms(s, r.matched)).toEqual(["STEADY", "DIPPER", "BANKX"]);
    expect(Array.from(r.sortValues ?? [])).toEqual([18, 11, 9]);
    const byName = runScreen(s, input("pe > 0", { sort: { key: "name", dir: "asc" } }), ctx);
    expect(syms(s, byName.matched)).toEqual(["BANKX", "DIPPER", "SHORTY", "STEADY", "TRANSIT"]);
    const nullsLast = runScreen(s, input("", { sort: { key: "roce", dir: "asc" } }), ctx);
    expect(syms(s, nullsLast.matched).slice(-2)).toEqual(["BANKX", "GAPPY"]);
  });

  it("ranks among the matching companies only: adding a non-matching company changes nothing", () => {
    const q = "pe > 0 SORT BY rank(roce) + rank(pe, ASC) ASC";
    const a = runScreen(s, input(q), ctx);
    const bigger = historyStore([{ symbol: "OUTSIDE", values: { roce: 99, pe: -5, market_cap: 9000 } }]);
    const b = runScreen(bigger, input(q), ctx);
    expect(syms(bigger, b.matched)).toEqual(syms(s, a.matched));
    expect(Array.from(b.sortValues ?? [])).toEqual(Array.from(a.sortValues ?? []));
    // STEADY 2 + 3 = 5; SHORTY 1 + 5 = 6 and DIPPER 4 + 2 = 6 (tie: larger market cap first); TRANSIT 3 + 4 = 7.
    expect(syms(s, a.matched)).toEqual(["STEADY", "DIPPER", "SHORTY", "TRANSIT", "BANKX"]);
    expect(Array.from(a.sortValues ?? []).slice(0, 4)).toEqual([5, 6, 6, 7]);
    expect(a.warnings.find((w) => w.code === "W_RANK_MIXED_CLASSES")).toBeDefined();
  });

  it("averages tied ranks", () => {
    const t = createFixtureStore({ companies: [10, 20, 20, 30].map((v, k) => ({ symbol: `T${k}`, values: { roe: v, market_cap: 100 - k } })) });
    const r = runScreen(t, input("roe > 0 SORT BY rank(roe) ASC"), ctx);
    expect(Array.from(r.sortValues ?? [])).toEqual([1, 2.5, 2.5, 4]);
  });
});

describe("universe", () => {
  const s = historyStore();

  it("resolves watchlist and portfolio symbols, case-insensitively, and warns about unknown ones", () => {
    const r = runScreen(s, input("", { universe: { kind: "watchlist" } }), { watchlist: ["steady", "RELIANCE", "STEADY", "nope"], portfolio: [] });
    expect(syms(s, r.universe)).toEqual(["STEADY"]);
    expect(r.warnings[0]).toEqual({ code: "W_UNKNOWN_SYMBOLS", count: 2, message: "2 symbols are not in the data you are viewing." });
    const p = runScreen(s, input("", { universe: { kind: "portfolio" } }), { watchlist: [], portfolio: ["BANKX"] });
    expect(syms(s, p.universe)).toEqual(["BANKX"]);
  });

  it("filters by sector, industry or a symbol list", () => {
    expect(syms(s, runScreen(s, input("", { universe: { kind: "sector", sector: " textiles " } }), ctx).universe)).toEqual(["DIPPER"]);
    expect(syms(s, runScreen(s, input("", { universe: { kind: "industry", industry: "BANKS" } }), ctx).universe)).toEqual(["BANKX"]);
    expect(syms(s, runScreen(s, input("", { universe: { kind: "symbols", symbols: ["SHORTY", "DIPPER"] } }), ctx).universe))
      .toEqual(["DIPPER", "SHORTY"]);
  });

  it("evaluates only the universe; peer statistics still use the whole dataset", () => {
    const r = runScreen(s, input("pe < sector_median(pe)", { universe: { kind: "symbols", symbols: ["STEADY"] } }), ctx);
    expect(r.universe).toHaveLength(1);
    expect(r.clauseTri[0]).toHaveLength(1);
  });
});

describe("columns, medians and warnings", () => {
  it("shows defaults, then query metrics (marked), then user columns, with medians over the matches", () => {
    const s = historyStore();
    const r = runScreen(s, input("sales > 0 AND roce > 0 AND interest_coverage > 0", {
      columns: [{ kind: "metric", id: "total_assets" }, { kind: "expr", expr: "sales / total_assets", label: "Sales to assets" }, { kind: "metric", id: "nope" }],
    }), ctx);
    expect(r.columns.map((c) => [c.key, c.fromQuery])).toEqual([
      ...DEFAULT_COLUMNS.map((id) => [id, false]),
      ["sales", true], ["interest_coverage", true], ["total_assets", false], ["expr:1", false],
    ]);
    // DIPPER has no interest cost, which passes "interest_coverage > 0".
    expect(syms(s, r.matched)).toEqual(["STEADY", "DIPPER", "TRANSIT", "SHORTY"]);
    expect(r.medians.roce).toBe(19);
    expect(r.medians.sales).toBe(135);
    expect(r.medians["expr:1"]).toBeCloseTo((70 / 100 + 140 / 150) / 2);
    expect(r.columns.find((c) => c.key === "expr:1")).toMatchObject({ label: "Sales to assets", metricId: null, periodTag: "Formula" });
  });

  it("adds at most 8 columns from the query", () => {
    const s = historyStore();
    const ids = ["sales", "pat", "dps", "total_assets", "cfo", "capex", "pbt", "tax_expense", "depreciation", "other_income"];
    const r = runScreen(s, input(ids.map((id) => `has(${id})`).join(" OR ")), ctx);
    expect(r.columns.filter((c) => c.fromQuery)).toHaveLength(8);
  });

  it("warns about TTM fallback, stale data and snapshot-only rows", () => {
    const s = createFixtureStore({
      companies: [
        { symbol: "FALL", values: { pe: { v: 10, flags: VF.FyFallback } }, annual: annualRows({ revenue: [1, 2] }) },
        { symbol: "OLD", values: { pe: 12 }, annual: annualRows({ revenue: [1, 2] }, { lastFy: 2025 }) },
        { symbol: "NEW", values: { pe: 14 }, annual: annualRows({ revenue: [1, 2] }) },
        { symbol: "SNAP", values: { pe: 16 } },
      ],
    });
    const r = runScreen(s, input("pe > 0"), ctx);
    const byCode = Object.fromEntries(r.warnings.map((w) => [w.code, w]));
    expect(byCode.W_TTM_FALLBACK).toEqual({
      code: "W_TTM_FALLBACK", count: 1,
      message: "1 company uses the latest financial year in place of TTM because four recent quarters were not available.",
    });
    expect(byCode.W_STALE_DATA).toEqual({
      code: "W_STALE_DATA", count: 1,
      message: "1 company has figures that end before FY26, the latest year for most companies in your data.",
    });
    expect(byCode.W_SNAPSHOT_ONLY).toEqual({
      code: "W_SNAPSHOT_ONLY", count: 1,
      message: "1 company has no yearly statements in your data, so rules that need history cannot be checked for it.",
    });
  });

  it("re-running with a changed threshold makes no store column calls", () => {
    const s = historyStore();
    runScreen(s, input("roce > 15\navg(sales, 3y) > 100\npe < sector_median(pe) SORT BY roce DESC"), ctx);
    const col = vi.spyOn(s, "column");
    const at = vi.spyOn(s, "columnAt");
    runScreen(s, input("roce > 12\navg(sales, 3y) > 110\npe < sector_median(pe) SORT BY roce DESC"), ctx);
    expect(col).not.toHaveBeenCalled();
    expect(at).not.toHaveBeenCalled();
  });

  it("returns serialisable output", () => {
    const s = historyStore();
    const r = runScreen(s, input("roce > 15"), ctx);
    expect(() => JSON.stringify({ ...r, compiled: { ...r.compiled, ast: r.compiled.ast } })).not.toThrow();
  });
});

describe("screensPassedBy", () => {
  it("reports pass, fail and not evaluated, and honours LIMIT over the whole dataset", () => {
    const s = historyStore();
    const res = screensPassedBy(s, s.indexOf("DIPPER"), [
      { id: "a", name: "Cheap", query: "pe < 20" },
      { id: "b", name: "Quality", query: "roce > 15" },
      { id: "c", name: "Broken", query: "pe <" },
      { id: "d", name: "Cheapest two", query: "pe > 0 SORT BY pe ASC LIMIT 2" },
      { id: "e", name: "Cheapest one", query: "pe > 0 SORT BY pe ASC LIMIT 1" },
    ]);
    expect(res.map((r) => r.passed)).toEqual([true, false, null, true, false]);
    expect(screensPassedBy(s, s.indexOf("GAPPY"), [{ id: "x", name: "x", query: "roce > 1" }])[0].passed).toBeNull();
  });
});
