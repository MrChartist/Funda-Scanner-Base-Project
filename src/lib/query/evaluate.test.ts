import { describe, expect, it, vi } from "vitest";
import type { MetricStore, Tri } from "@/lib/contracts";
import { NULL_REASONS, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN, VF } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { aggregateWindow } from "@/lib/metrics";
import { createFixtureStore } from "@/test/fixtures/fixture-store";
import { historyStore, peerStore } from "@/test/fixtures/query/stores";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { compileQuery } from "./compile";
import { evaluateNumericNode, evaluateQuery } from "./evaluate";
import { evaluateExpression } from "./index";

const T = TRI_TRUE;
const F = TRI_FALSE;
const U = TRI_UNKNOWN;
const code = (r: (typeof NULL_REASONS)[number]) => NULL_REASONS.indexOf(r);

function all(store: MetricStore): Int32Array {
  return Int32Array.from({ length: store.size }, (_, i) => i);
}

/** WHERE result for every company, in store order. */
function where(store: MetricStore, q: string): Tri[] {
  const c = compileQuery(q, store);
  expect(c.issues.filter((i) => i.level === "error")).toEqual([]);
  return Array.from(evaluateQuery(c, store, all(store)).whereTri) as Tri[];
}

function bySymbol(store: MetricStore, q: string): Record<string, Tri> {
  const tri = where(store, q);
  return Object.fromEntries(store.symbols.map((s, i) => [s, tri[i]]));
}

// roe ∈ {20, 5, null} × pe ∈ {20, 5, null}: clause A = roe > 10, clause B = pe > 10.
const TRI_VALUES: (number | null)[] = [20, 5, null];
const truthStore = createFixtureStore({
  companies: TRI_VALUES.flatMap((a, x) => TRI_VALUES.map((b, y) => ({ symbol: `K${x}${y}`, values: { roe: a, pe: b } }))),
});
const asTri = (v: number | null): Tri => (v === null ? U : v > 10 ? T : F);

describe("Kleene logic (§D.7)", () => {
  const pairs = TRI_VALUES.flatMap((a) => TRI_VALUES.map((b) => [asTri(a), asTri(b)] as const));
  const and = (a: Tri, b: Tri): Tri => (a === F || b === F ? F : a === U || b === U ? U : T);
  const or = (a: Tri, b: Tri): Tri => (a === T || b === T ? T : a === U || b === U ? U : F);
  const not = (a: Tri): Tri => (a === T ? F : a === F ? T : U);

  it("AND: FALSE wins, then UNKNOWN", () => {
    expect(where(truthStore, "roe > 10 AND pe > 10")).toEqual(pairs.map(([a, b]) => and(a, b)));
  });
  it("OR: TRUE wins, then UNKNOWN", () => {
    expect(where(truthStore, "roe > 10 OR pe > 10")).toEqual(pairs.map(([a, b]) => or(a, b)));
  });
  it("NOT UNKNOWN is UNKNOWN", () => {
    expect(where(truthStore, "NOT roe > 10")).toEqual(pairs.map(([a]) => not(a)));
    expect(where(truthStore, "NOT (roe > 10 OR pe > 10)")).toEqual(pairs.map(([a, b]) => not(or(a, b))));
  });
  it("has() is never UNKNOWN", () => {
    expect(where(truthStore, "has(roe)")).toEqual(pairs.map(([a]) => (a === U ? F : T)));
    expect(where(truthStore, "NOT has(pe)")).toEqual(pairs.map(([, b]) => (b === U ? T : F)));
  });
  it("matches only TRUE rows and carries the reason of an unknown clause", () => {
    const c = compileQuery("roe > 10 AND pe > 10", truthStore);
    const ev = evaluateQuery(c, truthStore, all(truthStore));
    const k20 = truthStore.indexOf("K20"); // roe is null
    expect(ev.clauseReason[0][k20]).toBe(code("missing_input"));
    expect(ev.clauseReason[0][0]).toBe(0);
    expect(ev.clauseLhs[0][0]).toBe(20);
    expect(ev.clauseRhs[0][0]).toBe(10);
    expect(Number.isNaN(ev.clauseLhs[0][k20])).toBe(true);
  });
});

describe("null semantics", () => {
  const s = createFixtureStore({
    companies: [
      { symbol: "NIC", values: { interest_coverage: { v: null, reason: "no_interest_cost" }, roe: 15.04, pe: 0 } },
      { symbol: "LOW", values: { interest_coverage: 1.2, roe: 14.95, pe: 4 } },
      { symbol: "NAF", type: "bank", values: { roe: 12, pe: 2 } },
    ],
  });

  it("treats no interest cost as +∞ in comparisons only", () => {
    expect(bySymbol(s, "interest_coverage > 3")).toMatchObject({ NIC: T, LOW: F });
    expect(bySymbol(s, "interest_coverage >= 3")).toMatchObject({ NIC: T });
    expect(bySymbol(s, "interest_coverage < 3")).toMatchObject({ NIC: F, LOW: T });
    expect(bySymbol(s, "interest_coverage <= 3")).toMatchObject({ NIC: F });
    expect(bySymbol(s, "interest_coverage = 3")).toMatchObject({ NIC: F });
    expect(bySymbol(s, "interest_coverage != 3")).toMatchObject({ NIC: T });
    expect(bySymbol(s, "interest_coverage BETWEEN 1 AND 5")).toMatchObject({ NIC: F, LOW: T });
    // Arithmetic on it gives null, so the clause is not evaluated.
    expect(bySymbol(s, "interest_coverage * 2 > 3")).toMatchObject({ NIC: U, LOW: F });
    expect(bySymbol(s, "has(interest_coverage)")).toMatchObject({ NIC: F, LOW: T });
  });

  it("compares = at display precision (decimals of the metric or the literal)", () => {
    expect(bySymbol(s, "roe = 15")).toMatchObject({ NIC: T, LOW: T });
    expect(bySymbol(s, "roe = 15.0")).toMatchObject({ NIC: T, LOW: T });
    expect(bySymbol(s, "roe = 15.00")).toMatchObject({ NIC: F, LOW: F });
    expect(bySymbol(s, "roe = 15.04")).toMatchObject({ NIC: T, LOW: F });
    expect(bySymbol(s, "roe != 15")).toMatchObject({ NIC: F, LOW: F });
    // Between two expressions the tolerance is relative 1e-9.
    expect(bySymbol(s, "roe = roe + 0.0000001")).toMatchObject({ NIC: F });
    expect(bySymbol(s, "roe = roe * 1")).toMatchObject({ NIC: T });
  });

  it("propagates nulls through arithmetic with the left operand's reason; division by zero is not meaningful", () => {
    const naf = evaluateExpression("roce + pe", s).column;
    expect(naf?.reasons[2]).toBe(code("not_applicable_financial"));
    const div = evaluateExpression("roe / pe", s).column;
    expect(div?.reasons[0]).toBe(code("non_positive_denominator"));
    expect(div?.values[1]).toBeCloseTo(14.95 / 4);
    for (const v of div?.values ?? []) expect(v === Infinity || v === -Infinity).toBe(false);
  });

  it("makes metrics outside appliesTo UNKNOWN for lenders (N/A)", () => {
    const c = compileQuery("roce > 10", s);
    const ev = evaluateQuery(c, s, all(s));
    expect(ev.clauseTri[0][2]).toBe(U);
    expect(ev.clauseReason[0][2]).toBe(code("not_applicable_financial"));
    expect(c.issues.find((i) => i.code === "W_NOT_APPLICABLE_SOME")?.message).toBe(
      "ROCE does not apply to banks and NBFCs; 1 lender in your data will not be evaluated.",
    );
    expect(compileQuery("roce > 10 AND NOT is lender", s).issues.some((i) => i.code === "W_NOT_APPLICABLE_SOME")).toBe(false);
  });

  it("compares text case-insensitively and trimmed", () => {
    const t = createFixtureStore({ companies: [{ symbol: "A", sector: "Cement" }, { symbol: "B", sector: "Metals & Mining" }] });
    expect(where(t, 'sector = " cement "')).toEqual([T, F]);
    expect(where(t, 'sector != "CEMENT"')).toEqual([F, T]);
    expect(where(t, 'sector IN ("metals & mining", "IT")')).toEqual([F, T]);
    expect(where(t, 'sector NOT IN ("metals & mining")')).toEqual([T, F]);
    expect(where(t, 'symbol = "b"')).toEqual([F, T]);
  });

  it("tests company types and statement basis", () => {
    const tiny = createStore(createTinyDataset());
    const r = bySymbol(tiny, "is lender");
    expect(r).toMatchObject({ TINYBANK: T, TINYMFG: F });
    expect(bySymbol(tiny, "IS NOT non_financial").TINYBANK).toBe(T);
    expect(bySymbol(tiny, "is standalone")).toMatchObject({ TINYNEW: T, TINYMFG: F });
    expect(bySymbol(tiny, "is consolidated")).toMatchObject({ TINYNEW: F, TINYMFG: T });
    expect(bySymbol(tiny, "is financial").TINYBANK).toBe(T);
    expect(bySymbol(tiny, "is bank").TINYBANK).toBe(T);
  });
});

describe("windows and folds (§D.6)", () => {
  const s = historyStore();

  it("averages over N years with the shared aggregateWindow, UNKNOWN when history is short", () => {
    const col = evaluateExpression("avg(sales, 3y)", s).column;
    const i = s.indexOf("STEADY");
    expect(col?.values[i]).toBeCloseTo((161 + 146 + 133) / 3);
    const shorty = s.indexOf("SHORTY");
    expect(evaluateExpression("avg(sales, 5y)", s).column?.reasons[shorty]).toBe(code("insufficient_history"));
    expect(bySymbol(s, "avg(sales, 5y) > 1").SHORTY).toBe(U);
    // Same function the store uses for variants.
    const cols = [0, 1, 2].map((k) => s.columnAt("sales", { freq: "fy", offset: k }));
    expect(Array.from(aggregateWindow("avg", cols, "x").values)[i]).toBeCloseTo(col?.values[i] ?? 0);
  });

  it("marks windows across a transition year as not comparable", () => {
    const t = s.indexOf("TRANSIT");
    expect(evaluateExpression("avg(sales, 3y)", s).column?.reasons[t]).toBe(code("transition_period"));
    expect(evaluateExpression("avg(sales, 2y)", s).column?.reasons[t]).toBe(0);
    expect(evaluateExpression("cagr(sales, 3y)", s).column?.reasons[t]).toBe(code("transition_period"));
  });

  it("computes CAGR from the window ends; null when an end is not positive", () => {
    const col = evaluateExpression("cagr(sales, 5y)", s).column;
    expect(col?.values[s.indexOf("STEADY")]).toBeCloseTo((Math.pow(161 / 100, 1 / 5) - 1) * 100);
    const g = evaluateExpression("cagr(pat, 4y)", s).column;
    expect(g?.reasons[s.indexOf("DIPPER")]).toBe(code("non_positive_denominator"));
  });

  it("every: FALSE beats UNKNOWN; short history is UNKNOWN", () => {
    const r = bySymbol(s, "every(sales > sales[prev], 5y)");
    // GAPPY has a hole in FY24, so two of its years cannot be compared.
    expect(r).toMatchObject({ STEADY: T, DIPPER: F, SHORTY: U, TRANSIT: T, GAPPY: U });
    expect(bySymbol(s, "every(sales > 0, 5y)")).toMatchObject({ STEADY: T, SHORTY: U, GAPPY: U });
  });

  it("any is the dual of every", () => {
    expect(bySymbol(s, "any(pat < 0, 5y)")).toMatchObject({ STEADY: F, DIPPER: T, SHORTY: U });
    expect(bySymbol(s, "any(pat > 6, 3y)")).toMatchObject({ SHORTY: T });
  });

  it("count: null unless every year can be evaluated", () => {
    const col = evaluateExpression("count(sales > sales[prev], 5y)", s).column;
    expect(col?.values[s.indexOf("STEADY")]).toBe(5);
    expect(col?.values[s.indexOf("DIPPER")]).toBe(4);
    expect(col?.reasons[s.indexOf("SHORTY")]).toBe(code("insufficient_history"));
    expect(bySymbol(s, "count(pat > 0, 5y) >= 4")).toMatchObject({ STEADY: T, DIPPER: T, SHORTY: U });
  });

  it("streak counts back from the latest year and flags the limit of data", () => {
    const col = evaluateExpression("streak(dps > 0)", s).column;
    const steady = s.indexOf("STEADY");
    expect(col?.values[steady]).toBe(6);
    expect((col?.flags[steady] ?? 0) & VF.LimitOfData).toBe(VF.LimitOfData);
    const dipper = s.indexOf("DIPPER");
    expect(col?.values[dipper]).toBe(3);
    expect((col?.flags[dipper] ?? 0) & VF.LimitOfData).toBe(0);
    expect(col?.values[s.indexOf("GAPPY")]).toBe(0);
  });

  it("reads [prev] relative to the window's year", () => {
    const col = evaluateExpression("sum(sales - sales[prev], 3y)", s).column;
    expect(col?.values[s.indexOf("STEADY")]).toBeCloseTo(161 - 121);
  });

  it("reads absolute selectors and returns IH beyond the history, never an error", () => {
    const col = evaluateExpression("sales[fy-3]", s).column;
    expect(col?.values[s.indexOf("STEADY")]).toBe(121);
    expect(evaluateExpression("sales[fy-9]", s).column?.reasons[s.indexOf("STEADY")]).toBe(code("insufficient_history"));
  });

  it("evaluates scalar functions element-wise", () => {
    const i = s.indexOf("STEADY");
    expect(evaluateExpression("max(sales, pat * 20)", s).column?.values[i]).toBe(300);
    expect(evaluateExpression("min(sales, pat * 20)", s).column?.values[i]).toBe(161);
    expect(evaluateExpression("abs(-sales)", s).column?.values[i]).toBe(161);
    expect(evaluateExpression("growth(sales, sales[prev])", s).column?.values[i]).toBeCloseTo((161 / 146 - 1) * 100);
    const g = evaluateExpression("growth(pat, pat[fy-4])", s).column;
    expect(g?.reasons[s.indexOf("DIPPER")]).toBe(code("non_positive_denominator"));
    expect((g?.flags[s.indexOf("DIPPER")] ?? 0) & VF.Turnaround).toBe(VF.Turnaround);
  });
});

describe("peer functions (whole dataset, within the peer class)", () => {
  const s = peerStore();

  it("uses the sector group when it is big enough and falls back to the class otherwise", () => {
    const med = evaluateExpression("sector_median(pe)", s).column;
    expect(med?.values[s.indexOf("CEM1")]).toBe(13); // median of 8,10,12,14,16,30
    // Pharma has 2 members: falls back to the non-financial class (8 companies).
    expect(med?.values[s.indexOf("PHA1")]).toBe(15);
    // The bank is alone in its class: too few peers.
    expect(med?.reasons[s.indexOf("LEND1")]).toBe(code("too_few_peers"));
  });

  it("computes ascending percentiles with the minimum count", () => {
    const p = evaluateExpression("sector_pctl(pe)", s).column;
    expect(p?.values[s.indexOf("CEM1")]).toBe(0);
    expect(p?.values[s.indexOf("CEM6")]).toBe(100);
    expect(p?.reasons[s.indexOf("LEND1")]).toBe(code("too_few_peers"));
    expect(bySymbol(s, "pe < sector_median(pe)")).toMatchObject({ CEM1: T, CEM6: F, LEND1: U });
  });

  it("does not depend on the universe", () => {
    const c = compileQuery("pe < sector_median(pe)", s);
    const one = evaluateQuery(c, s, Int32Array.of(s.indexOf("CEM2")));
    expect(one.whereTri[0]).toBe(T);
  });
});

describe("memoised columns (§D.7 caching)", () => {
  it("re-running with a changed threshold makes no store column calls", () => {
    const s = historyStore();
    const rows = all(s);
    evaluateQuery(compileQuery("avg(sales, 3y) > 100 AND roce > 15 AND pe < sector_median(pe)", s), s, rows);
    const col = vi.spyOn(s, "column");
    const at = vi.spyOn(s, "columnAt");
    const c2 = compileQuery("avg(sales, 3y) > 120 AND roce > 12 AND pe < sector_median(pe)", s);
    evaluateQuery(c2, s, rows);
    expect(col).not.toHaveBeenCalled();
    expect(at).not.toHaveBeenCalled();
  });

  it("returns the same column object for the same node and period", () => {
    const s = historyStore();
    const a = evaluateNumericNode({ k: "ref", metric: "sales", written: "sales", selector: null, span: { start: 0, end: 5 } }, s, "sales");
    const b = evaluateNumericNode({ k: "ref", metric: "sales", written: "Sales", selector: null, span: { start: 3, end: 9 } }, s, "");
    expect(a).toBe(b);
  });
});

describe("evaluation of an erroneous query", () => {
  it("returns UNKNOWN everywhere and never matches", () => {
    const s = historyStore();
    const c = compileQuery("roce >> 1", s);
    const ev = evaluateQuery(c, s, all(s));
    expect(Array.from(ev.whereTri).every((t) => t === U)).toBe(true);
  });

  it("matches everything when WHERE is empty", () => {
    const s = historyStore();
    const ev = evaluateQuery(compileQuery("SORT BY pe", s), s, all(s));
    expect(ev.clauseTri).toEqual([]);
    expect(Array.from(ev.whereTri).every((t) => t === T)).toBe(true);
  });
});
