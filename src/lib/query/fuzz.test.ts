// Robustness: seeded random token soup never makes compile, evaluate, explain, chips,
// suggestions or runScreen throw, and every issue span lies inside the source.
import { describe, expect, it } from "vitest";
import { runScreen } from "@/lib/screen";
import { historyStore } from "@/test/fixtures/query/stores";
import { compileQuery, evaluateQuery, explainClause, fromChips, suggestAt, toChips } from "./index";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECES = [
  "roce", "pe", "sales", "pat", "dps", "sector", "market_cap", "roce_avg_5y", "q_sales", "promoter_holding", "red_flag_count",
  "AND", "OR", "NOT", "BETWEEN", "IN", "IS", "lender", "SORT BY", "LIMIT", "ASC", "DESC", "WHERE", "ORDER BY",
  ">", ">=", "<", "<=", "=", "!=", "+", "-", "*", "/", "(", ")", "[", "]", ",", "fy", "fy-1", "prev", "ttm", "q-4",
  "every(", "any(", "count(", "streak(", "avg(", "cagr(", "growth(", "abs(", "has(", "min(", "max(", "rank(", "pctl(",
  "sector_median(", "industry_pctl(", "foo(", "5y", "3y", "8q", "15", "0.5", "1.5lakh", "500cr", "20%", "2x", "1,00,000",
  '"Cement"', "'IT'", "`Cash and bank balances`", "#c\n", "\n", "@", "&&", "last year", "average", "5 years",
];

describe("fuzz", () => {
  it("handles 600 random queries without throwing", () => {
    const s = historyStore();
    const rnd = mulberry32(7);
    const rows = Int32Array.from({ length: s.size }, (_, i) => i);
    let ok = 0;
    for (let k = 0; k < 600; k++) {
      const n = 1 + Math.floor(rnd() * 12);
      const src = Array.from({ length: n }, () => PIECES[Math.floor(rnd() * PIECES.length)]).join(rnd() < 0.8 ? " " : "");
      const c = compileQuery(src, s);
      for (const i of c.issues) {
        expect(i.span.start, src).toBeGreaterThanOrEqual(0);
        expect(i.span.end, src).toBeLessThanOrEqual(src.length);
        expect(i.span.start, src).toBeLessThanOrEqual(i.span.end);
      }
      const ev = evaluateQuery(c, s, rows);
      for (let cl = 0; cl < c.clauses.length; cl++) explainClause(c, ev, cl, k % s.size, s);
      fromChips(toChips(c));
      suggestAt(src, Math.floor(rnd() * (src.length + 1)), s);
      const run = runScreen(s, { query: src, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] }, c);
      if (c.ok) {
        ok++;
        expect(compileQuery(c.canonical, s).canonical, src).toBe(c.canonical);
        expect(run.matched.length).toBeLessThanOrEqual(s.size);
      }
    }
    expect(ok).toBeGreaterThan(0);
  });
});
