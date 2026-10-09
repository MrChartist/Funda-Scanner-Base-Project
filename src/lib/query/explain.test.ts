import { describe, expect, it } from "vitest";
import type { MetricStore } from "@/lib/contracts";
import { TRI_FALSE, TRI_TRUE, TRI_UNKNOWN } from "@/lib/contracts";
import { createFixtureStore } from "@/test/fixtures/fixture-store";
import { historyStore, peerStore } from "@/test/fixtures/query/stores";
import { compileQuery } from "./compile";
import { evaluateQuery } from "./evaluate";
import { explainClause } from "./explain";

function explain(store: MetricStore, q: string, symbol: string, clause = 0) {
  const c = compileQuery(q, store);
  expect(c.ok).toBe(true);
  const rows = Int32Array.from({ length: store.size }, (_, i) => i);
  return explainClause(c, evaluateQuery(c, store, rows), clause, store.indexOf(symbol), store);
}

describe("explainClause", () => {
  const s = historyStore();

  it("explains a failed simple clause with the values and the gap", () => {
    const ex = explain(s, "roce > 15", "DIPPER");
    expect(ex).toMatchObject({ result: TRI_FALSE, lhs: 14.2, rhs: 15, gapText: "0.8 points short", reason: null });
    expect(ex.gap).toBeCloseTo(0.8 / 15);
    expect(ex.detail).toBe("ROCE 14.2% (FY26); needs above 15%");
    expect(ex.english).toBe("ROCE (latest FY) is above 15%");
  });

  it("explains a passing clause, a limit that is exceeded and an unknown clause", () => {
    expect(explain(s, "roce > 15", "STEADY")).toMatchObject({ result: TRI_TRUE, gap: null, gapText: null });
    const over = explain(s, "pe < 20", "TRANSIT");
    expect(over.gapText).toBe("5.0x above the limit");
    const unknown = explain(s, "roce > 15", "GAPPY");
    expect(unknown.result).toBe(TRI_UNKNOWN);
    expect(unknown.reason).toBe("missing_input");
    expect(unknown.detail).toContain("not checked: Not provided");
    const naf = explain(s, "roce > 15", "BANKX");
    expect(naf.reason).toBe("not_applicable_financial");
    expect(naf.detail).toContain("N/A for lenders");
  });

  it("says that no interest cost is treated as passing", () => {
    const ex = explain(s, "interest_coverage > 3", "DIPPER");
    expect(ex.result).toBe(TRI_TRUE);
    expect(ex.detail).toBe("Int. coverage: no interest cost, treated as passing; needs above 3x");
  });

  it("lists every year of a window clause, oldest first, with the failing years", () => {
    const ex = explain(s, "every(sales > 102, 5y)", "DIPPER");
    expect(ex.result).toBe(TRI_TRUE);
    expect(ex.periods?.map((p) => p.label)).toEqual(["FY22", "FY23", "FY24", "FY25", "FY26"]);
    expect(ex.periods?.map((p) => p.result)).toEqual([TRI_TRUE, TRI_TRUE, TRI_TRUE, TRI_TRUE, TRI_TRUE]);
    const fail = explain(s, "every(sales > 106, 5y)", "DIPPER");
    expect(fail.periods?.find((p) => p.label === "FY23")).toMatchObject({ value: 105, display: "₹105 Cr", result: TRI_FALSE });
    expect(fail.gapText).toBe("failed in 1 of 5 years (FY23: ₹105 Cr)");
    expect(fail.detail).toBe("Met in 4 of 5 years (FY22–FY26); FY23: ₹105 Cr");
    expect(explain(s, "every(sales > 50, 5y)", "STEADY").detail).toBe("Met in all 5 years (FY22–FY26)");
  });

  it("explains count() and streak() comparisons", () => {
    const c = explain(s, "count(pat > 0, 5y) >= 5", "DIPPER");
    expect(c).toMatchObject({ result: TRI_FALSE, lhs: 4, rhs: 5 });
    expect(c.detail).toBe("Met in 4 of 5 years (FY22–FY26); needs at least 5");
    expect(c.gapText).toBe("1 year short");
    const st = explain(s, "streak(dps > 0) >= 5", "DIPPER");
    expect(st).toMatchObject({ result: TRI_FALSE, lhs: 3 });
    expect(st.detail).toBe("In a row: 3 years; needs at least 5");
    expect(explain(s, "streak(dps > 0) >= 5", "STEADY").detail).toBe("In a row: 6 years (limit of data); needs at least 5");
  });

  it("explains BETWEEN with the distance to the range", () => {
    const ex = explain(s, "roce BETWEEN 15 AND 20", "STEADY");
    expect(ex).toMatchObject({ result: TRI_FALSE, lhs: 22, rhs: 20, gapText: "2.0 points above the range" });
    expect(explain(s, "roce BETWEEN 15 AND 20", "DIPPER").gapText).toBe("0.8 points below the range");
  });

  it("explains type, text and OR clauses", () => {
    expect(explain(s, "is lender", "BANKX").detail).toBe("Company type: Bank");
    expect(explain(s, 'sector = "Textiles"', "DIPPER").detail).toBe("Sector: Textiles");
    expect(explain(s, "roce > 20 OR pe < 12", "DIPPER").detail).toBe("ROCE 14.2% (FY26): fails; P/E 11.0x (TTM): passes");
  });

  it("fills the peer group for peer functions", () => {
    const p = peerStore();
    const ex = explain(p, "pe < sector_median(pe)", "CEM2");
    expect(ex.peer).toEqual({ groupLabel: "Cement · 6 companies in your data", scope: "sector", n: 6, median: 13 });
    expect(ex.detail).toBe("P/E 10.0x (TTM); needs below 13.0x (median of Cement · 6 companies in your data)");
    const fallback = explain(p, "pe < sector_median(pe)", "PHA1");
    expect(fallback.peer?.scope).toBe("class");
  });

  it("explains a company outside the evaluated rows by evaluating it", () => {
    const store = createFixtureStore({ companies: [{ symbol: "A", values: { roe: 10 } }, { symbol: "B", values: { roe: 30 } }] });
    const c = compileQuery("roe > 20", store);
    const ev = evaluateQuery(c, store, Int32Array.of(0));
    expect(explainClause(c, ev, 0, 1, store).result).toBe(TRI_TRUE);
    expect(explainClause(c, ev, 5, 1, store).detail).toBe("This rule does not exist.");
  });
});
