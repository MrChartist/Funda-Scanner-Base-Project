import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/engine";
import { allMetricDefs } from "@/lib/metrics";
import { compileQuery } from "@/lib/query";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { TEMPLATES, templateById } from "./templates";

const store = createStore(createTinyDataset());
const IDS = new Set(allMetricDefs().map((d) => d.id));
const FORBIDDEN = /\b(buy|sell|strong buy|avoid|fraud|multibagger|target price|guaranteed|sure shot|will go bankrupt)\b/i;

function strings(x: unknown): string[] {
  if (typeof x === "string") return [x];
  if (Array.isArray(x)) return x.flatMap(strings);
  if (x && typeof x === "object") return Object.values(x).flatMap(strings);
  return [];
}

describe("templates (§D.13)", () => {
  it("ships the seven templates in order with the specified titles and levels", () => {
    expect(TEMPLATES.map((t) => [t.id, t.title, t.level])).toEqual([
      ["quality", "Quality compounders", "Beginner"],
      ["value", "Value with a safety check", "Intermediate"],
      ["growth", "Steady growers", "Beginner"],
      ["dividend", "Reliable dividend payers", "Beginner"],
      ["turnaround", "Turnaround watch", "Intermediate"],
      ["lenders", "Lenders with clean books", "Intermediate"],
      ["ey_roc_rank", "Earnings yield and return on capital rank", "Intermediate"],
    ]);
    expect(templateById("lenders")?.title).toBe("Lenders with clean books");
    expect(templateById("nope")).toBeUndefined();
    expect(templateById(null)).toBeUndefined();
  });

  for (const t of TEMPLATES) {
    it(`${t.id}: compiles, has one note per clause and uses only catalogue ids`, () => {
      const c = compileQuery(t.query, store);
      expect(c.issues.filter((i) => i.level === "error")).toEqual([]);
      expect(c.clauses).toHaveLength(t.clauseNotes.length);
      // One condition per line.
      expect(t.query.split("\n").length).toBe(c.clauses.length + (c.sort.length > 0 ? 1 : 0) + (c.limit !== null ? 1 : 0));
      for (const id of c.metrics) expect(IDS.has(id), id).toBe(true);
      for (const id of t.columns) expect(IDS.has(id), id).toBe(true);
      if (t.sort) expect(IDS.has(t.sort.key), t.sort.key).toBe(true);
      expect(t.query).not.toMatch(/coalesce/i);
      expect(t.idea.length).toBeGreaterThan(40);
      expect(t.misses.length).toBeGreaterThan(0);
      expect(t.notFor.length).toBeGreaterThan(0);
      expect(t.tryChanging.length).toBeGreaterThan(10);
      if (t.inspiredBy) expect(t.inspiredBy).not.toMatch(/https?:|www\.|\.com|\.in\b/i);
      for (const text of strings(t)) expect(FORBIDDEN.test(text), text).toBe(false);
    });
  }

  it("matches the specified queries", () => {
    expect(templateById("quality")?.query).toBe("every(roce > 15, 5y)\ndebt_equity < 0.5\ncum_cfo_to_pat_5y > 0.8\nsales_cagr_5y > 10");
    expect(templateById("ey_roc_rank")?.query).toBe(
      "is non_financial\nmarket_cap > 500\nearnings_yield > 0\nroic > 0\nSORT BY rank(earnings_yield) + rank(roic) ASC\nLIMIT 20",
    );
    expect(templateById("ey_roc_rank")?.inspiredBy).toBe("Greenblatt, J. (2005), The Little Book That Beats the Market");
    const rank = compileQuery(templateById("ey_roc_rank")?.query ?? "", store);
    expect(rank.limit).toBe(20);
    expect(rank.sort[0]).toMatchObject({ dir: "asc", usesRank: true });
  });
});
