// Golden suite (§D.11): every listed query parses, or fails exactly as listed.
import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/engine";
import { generateSampleDataset } from "@/lib/sample";
import { createFixtureStore } from "@/test/fixtures/fixture-store";
import { INVALID_QUERIES, VALID_QUERIES } from "@/test/fixtures/query/golden-queries";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { compileQuery, evaluateQuery } from "./index";

const tiny = createStore(createTinyDataset());

/** Every company has a value for every metric used below, so no coverage warning fires. */
const full = createFixtureStore({
  companies: ["A", "B", "C", "D", "E", "F"].map((s, k) => ({
    symbol: s,
    values: { roe: 10 + k, roce: 12 + k, pe: 15 + k, debt_equity: 0.2 * k, market_cap: 1000 * (k + 1) },
  })),
});

const errorsOf = (q: string, store = tiny) => compileQuery(q, store).issues.filter((i) => i.level === "error");

describe("golden queries that must parse", () => {
  for (const q of VALID_QUERIES) {
    it(`parses: ${q.split("\n").join(" / ")}`, () => {
      const compiled = compileQuery(q, tiny);
      expect(compiled.issues.filter((i) => i.level === "error")).toEqual([]);
      expect(compiled.ok).toBe(true);
      expect(compiled.ast).not.toBeNull();
      expect(compiled.english).toMatch(/Companies with missing data are not counted as matches\.$/);
      // The canonical text compiles to the same canonical text.
      const again = compileQuery(compiled.canonical, tiny);
      expect(again.ok).toBe(true);
      expect(again.canonical).toBe(compiled.canonical);
    });
  }
});

describe("golden queries on the bundled sample", () => {
  it("compile with no errors and evaluate", () => {
    const sample = createStore(generateSampleDataset());
    const rows = Int32Array.from({ length: sample.size }, (_, i) => i);
    for (const q of VALID_QUERIES) {
      const compiled = compileQuery(q, sample);
      expect(compiled.issues.filter((i) => i.level === "error"), q).toEqual([]);
      expect(() => evaluateQuery(compiled, sample, rows)).not.toThrow();
    }
  });
});

describe("golden queries that must fail", () => {
  for (const g of INVALID_QUERIES) {
    it(`${g.query} → ${g.errors.join(", ") || "no errors"}`, () => {
      const store = g.onlyIssues ? full : tiny;
      const compiled = compileQuery(g.query, store);
      const errors = compiled.issues.filter((i) => i.level === "error");
      expect(errors.map((e) => e.code)).toEqual(g.errors);
      expect(compiled.ok).toBe(g.errors.length === 0);
      if (g.onlyIssues) expect(compiled.issues.map((i) => i.code)).toEqual(g.onlyIssues);
      if (g.suggestion) expect(errors[0].suggestions.map((s) => s.replacement)).toContain(g.suggestion);
      for (const e of errors) {
        expect(e.span.start).toBeGreaterThanOrEqual(0);
        expect(e.span.end).toBeLessThanOrEqual(g.query.length);
        expect(e.span.end).toBeGreaterThanOrEqual(e.span.start);
        expect(e.message.length).toBeGreaterThan(10);
      }
    });
  }

  it("uses the exact message templates of §D.9", () => {
    expect(errorsOf("roce >")[0].message).toBe("The query ends too early. A value is expected after '>'.");
    expect(errorsOf("roce > 15 AND (pe < 20")[0].message).toBe("This '(' has no matching ')'.");
    expect(errorsOf("roce")[0].message).toBe("'ROCE' is a number. Compare it with something, for example ROCE > 15.");
    expect(errorsOf("foo(roce) > 1")[0].message).toBe(
      "Unknown function 'foo'. Available: avg, median, min, max, sum, stdev, cagr, every, any, count, streak, growth, abs, has, pctl, sector_pctl, industry_pctl, sector_median, industry_median, rank.",
    );
    expect(errorsOf("avg(roce, 5y, 3) > 1")[0].message).toBe("avg() needs two inputs: a metric and a period, for example avg(roce, 5y).");
    expect(errorsOf("pe < 20 LIMIT 0")[0].message).toBe("LIMIT must be between 1 and 1000.");
    expect(errorsOf("roce @ 5")[0].message).toBe("The character '@' cannot be used in a query.");
    expect(errorsOf("debt_equty < 0.5")[0].message).toBe('Unknown metric "debt_equty". Did you mean Debt to equity (debt_equity)?');
    expect(errorsOf("sales last year > 100")[0].message).toBe(
      "'last year' is ambiguous here. Write sales[fy] for the latest financial year or sales[prev] for the year before.",
    );
    expect(errorsOf("pe[fy-1] < 20")[0].message).toBe(
      "P/E has no yearly history because past prices are not stored. Use earnings growth or ROCE instead.",
    );
    expect(errorsOf("every(roce[fy-1] > 15, 5y)")[0].message).toBe("Inside every(), metrics are read year by year; remove [fy-1].");
    expect(errorsOf("cagr(roce, 5y) > 5")[0].message).toBe(
      "CAGR suits amounts and per-share values, not ratios such as ROCE. Compare roce with roce[fy-5] instead.",
    );
    expect(errorsOf("debt_equity < 50%")[0].message).toBe("Debt to equity is a multiple (x), not a percentage. Write 0.5, not 50%.");
    expect(errorsOf("market_cap > 1,00,000")[0].message).toBe(
      "Commas cannot be used inside numbers in a query. Write 100000, 1_00_000 or 1 lakh.",
    );
    const fraction = compileQuery("roe > 0.15", full).issues[0];
    expect(fraction.message).toBe("ROE is stored in percent. Did you mean 15 instead of 0.15?");
    expect(fraction.suggestions[0].replacement).toBe("15");
  });

  it("reports both errors of `roce >> 15 AND debt_equty < 0.5` at their positions", () => {
    const q = "roce >> 15 AND debt_equty < 0.5";
    const errors = errorsOf(q);
    expect(errors[0].span.start).toBe(q.indexOf(">>") + 1);
    expect(errors[1].span).toEqual({ start: q.indexOf("debt_equty"), end: q.indexOf("debt_equty") + "debt_equty".length });
  });
});
