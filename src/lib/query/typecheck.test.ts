import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { compileQuery } from "./compile";
import { unitOf } from "./typecheck";

const store = createStore(createTinyDataset());
const errors = (q: string) => compileQuery(q, store).issues.filter((i) => i.level === "error").map((i) => i.code);
const issues = (q: string) => compileQuery(q, store).issues.map((i) => i.code);

describe("type checking", () => {
  it("requires conditions where conditions belong", () => {
    expect(errors("roce AND pe < 2")).toEqual(["E_TYPE_BOOL_EXPECTED"]);
    expect(errors("NOT roce")).toEqual(["E_TYPE_BOOL_EXPECTED"]);
    expect(errors("every(roce, 5y)")).toEqual(["E_TYPE_BOOL_EXPECTED"]);
    expect(errors("streak(dps) >= 3")).toEqual(["E_TYPE_BOOL_EXPECTED"]);
    expect(errors("roce + pe")).toEqual(["E_TYPE_BOOL_EXPECTED"]);
    expect(compileQuery("roce + pe", store).issues[0].message).toBe(
      "'roce + pe' is a number. Compare it with something, for example roce + pe > 15.",
    );
  });

  it("requires numbers where numbers belong", () => {
    expect(errors("(roe > 1) > 2")).toEqual(["E_TYPE_NUMBER_EXPECTED"]);
    expect(errors("avg(roe > 1, 5y) > 2")).toEqual(["E_TYPE_NUMBER_EXPECTED"]);
    expect(errors("pe < 1 SORT BY (roe > 2)")).toEqual(["E_TYPE_NUMBER_EXPECTED"]);
    expect(errors("roe + (pe < 1) > 2")).toEqual(["E_TYPE_NUMBER_EXPECTED"]);
  });

  it("keeps text and numbers apart", () => {
    expect(errors('sector = "Cement"')).toEqual([]);
    expect(errors('sector < "Cement"')).toEqual(["E_TEXT_COMPARISON"]);
    expect(errors("sector = 5")).toEqual(["E_TEXT_COMPARISON"]);
    expect(errors('roce = "high"')).toEqual(["E_TEXT_COMPARISON"]);
    expect(errors('roce IN ("a")')).toEqual(["E_TEXT_COMPARISON"]);
    expect(errors("sector BETWEEN 1 AND 2")).toEqual(["E_TEXT_COMPARISON"]);
    expect(errors("sector + 1 > 2")).toEqual(["E_TEXT_COMPARISON"]);
  });

  it("checks function inputs", () => {
    expect(errors("abs(roe, pe) > 1")).toEqual(["E_WRONG_ARG_COUNT"]);
    expect(errors("growth(sales) > 1")).toEqual(["E_WRONG_ARG_COUNT"]);
    expect(errors("has(roe, 5y)")).toEqual(["E_WRONG_ARG_COUNT"]);
    expect(errors("min(roe) > 1")).toEqual(["E_WINDOW_REQUIRED"]);
    expect(errors("min(roe, pe, roce) > 1")).toEqual([]);
    expect(errors("min(roe, 5y) > 1")).toEqual([]);
    expect(errors("pctl(roe, pe) > 1")).toEqual(["E_WRONG_ARG_COUNT"]);
    expect(errors("streak(dps > 0, 5y) > 1")).toEqual(["E_WRONG_ARG_COUNT"]);
    expect(errors("avg(roe, 1y) > 1")).toEqual(["E_WINDOW_RANGE"]);
    expect(errors("avg(roe, 15y) > 1")).toEqual([]);
    expect(errors("count(roe > 1) > 1")).toEqual(["E_WINDOW_REQUIRED"]);
    expect(errors("cagr(sales[fy-1], 5y) > 1")).toEqual(["E_SELECTOR_IN_WINDOW"]);
    expect(errors("cagr(sales[prev], 5y) > 1")).toEqual([]);
    expect(errors("cagr(sales * 2, 5y) > 1")).toEqual(["E_NOT_GROWTHABLE"]);
    expect(errors("pe < 1 SORT BY rank(rank(pe))")).toEqual(["E_RANK_OUTSIDE_SORT"]);
    expect(errors("pe < 1 SORT BY rank(pe, roe)")).toEqual(["E_WRONG_ARG_COUNT"]);
  });

  it("checks periods against each metric's history", () => {
    expect(errors("q_sales[fy-1] > 1")).toEqual(["E_BAD_SELECTOR"]);
    expect(errors("sales[q-1] > 1")).toEqual(["E_BAD_SELECTOR"]);
    expect(errors("sales[ttm-1] > 1")).toEqual([]);
    expect(errors("q_sales[q-4] > 1 AND promoter_holding[q-4] > 1 AND promoter_holding[prev] > 1")).toEqual([]);
    expect(errors("every(q_sales > 1, 3y)")).toEqual(["E_NO_HISTORY"]);
    expect(errors("every(red_flag_count > 1, 3y)")).toEqual(["E_NO_HISTORY"]);
    expect(compileQuery("red_flag_count[prev] > 1", store).issues[0].message).toBe(
      "Red flags is a single latest value with no stored history, so a period cannot be chosen for it.",
    );
    expect(errors("every(roce_avg_5y > 1, 3y) AND every(sales > sales[prev], 3y)")).toEqual([]);
    expect(errors("every(sales[ttm] > 1, 3y)")).toEqual(["E_SELECTOR_IN_WINDOW"]);
    expect(errors("count(every(sales > 1, 2y), 3y) > 1")).toEqual([]);
  });

  it("checks units of literals (§D.8)", () => {
    expect(errors("market_cap > 500cr AND market_cap < 2 lakh AND roe > 15% AND pe < 20x")).toEqual([]);
    expect(errors("market_cap > 15%")).toEqual(["E_UNIT_MISMATCH"]);
    expect(errors("roe > 500cr")).toEqual(["E_UNIT_MISMATCH"]);
    expect(errors("pe < 20%")).toEqual(["E_UNIT_MISMATCH"]);
    expect(errors("opm_stdev_5y < 2%")).toEqual([]);
    expect(errors("sector_pctl(roe) > 80%")).toEqual([]);
    expect(errors("roe BETWEEN 10x AND 20")).toEqual(["E_UNIT_MISMATCH"]);
    expect(errors("roe > roe[prev] + 2x")).toEqual(["E_UNIT_MISMATCH"]);
    expect(compileQuery("pe < 20%", store).issues[0].suggestions[0].replacement).toBe("0.2");
  });

  it("warns about likely fractions and mixed units", () => {
    expect(issues("dividend_yield > 0.5")).toContain("W_LIKELY_FRACTION");
    expect(issues("roe > 1.5")).not.toContain("W_LIKELY_FRACTION");
    expect(issues("debt_equity < 0.5")).not.toContain("W_LIKELY_FRACTION");
    expect(issues("sales + roe > 1")).toContain("W_MIXED_UNITS");
    expect(issues("sales * roe > 1")).not.toContain("W_MIXED_UNITS");
  });

  it("notes the default period of TTM-capable metrics once", () => {
    const q = compileQuery("sales > 1 AND sales < 9", store);
    expect(q.issues.filter((i) => i.code === "I_DEFAULT_PERIOD")).toHaveLength(1);
    expect(q.issues.find((i) => i.code === "I_DEFAULT_PERIOD")?.message).toBe(
      "Sales here means the latest financial year. Write sales[ttm] for the trailing twelve months.",
    );
    expect(issues("sales[fy] > 1")).not.toContain("I_DEFAULT_PERIOD");
  });

  it("infers units of expressions", () => {
    const parse = (q: string) => {
      const c = compileQuery(`${q} > 0`, store);
      const w = c.ast?.where;
      return w && w.k === "cmp" ? unitOf(w.l, store) : undefined;
    };
    expect(parse("0.7 * total_debt")).toBe("inr_cr");
    expect(parse("roe - 2")).toBe("pct");
    expect(parse("stdev(roe, 5y)")).toBe("pp");
    expect(parse("cagr(sales, 5y)")).toBe("pct");
    expect(parse("count(roe > 1, 5y)")).toBe("count");
    expect(parse("market_cap / sales")).toBeNull();
    expect(parse("sector_pctl(roe)")).toBe("pctl");
    expect(parse("industry_median(pe)")).toBe("x");
  });
});
