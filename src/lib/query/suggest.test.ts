import { describe, expect, it } from "vitest";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { suggestAt } from "./suggest";

const store = createStore(createTinyDataset());
const at = (src: string, cursor = src.length) => suggestAt(src, cursor, store);
const inserts = (src: string, cursor?: number) => at(src, cursor).items.map((i) => i.insert);

describe("suggestAt (autocomplete)", () => {
  it("completes metric ids from a prefix and replaces the whole word", () => {
    const res = at("roce > 1 AND debt_eq");
    expect(res.span).toEqual({ start: 13, end: 20 });
    expect(res.items[0]).toMatchObject({ kind: "metric", insert: "debt_equity" });
    expect(res.items[0].detail).toMatch(/^x · Leverage & Liquidity/);
    const mid = at("roce > 1 AND debt_eq", 16);
    expect(mid.span).toEqual({ start: 13, end: 20 });
  });

  it("matches labels and aliases as well as ids", () => {
    expect(inserts("return on cap")).toContain("roce");
    expect(inserts("turnov")).toContain("sales");
  });

  it("offers functions with their signature", () => {
    const res = at("ev");
    expect(res.items.some((i) => i.kind === "function" && i.insert === "every(")).toBe(true);
    expect(at("pct").items.find((i) => i.insert === "pctl(")?.label).toBe("pctl(x)");
  });

  it("offers comparisons and keywords after a complete operand", () => {
    const items = inserts("roce ");
    expect(items.slice(0, 6)).toEqual([">", ">=", "<", "<=", "=", "!="]);
    expect(items).toContain("AND");
    expect(items).toContain("SORT BY");
    expect(inserts("roce > 15 A")).toContain("AND");
  });

  it("offers selectors inside brackets, periods in window functions and types after IS", () => {
    expect(inserts("sales[")).toEqual(["fy", "fy-1", "prev", "ttm", "ttm-1", "q", "q-1", "q-4"]);
    expect(inserts("sales[t")).toEqual(["ttm", "ttm-1"]);
    expect(inserts("avg(roce, ")).toEqual(expect.arrayContaining(["3y", "5y", "10y"]));
    expect(inserts("is ")).toContain("lender");
    expect(inserts("IS NOT n")).toEqual(["nbfc", "non_financial"]);
    expect(inserts("pe < 1 SORT BY rank(pe, ")).toEqual(expect.arrayContaining(["ASC", "DESC"]));
  });

  it("starts with basic metrics on an empty query and never throws", () => {
    const res = at("");
    expect(res.items.length).toBeGreaterThan(5);
    expect(res.items[0].kind).toBe("metric");
    for (const src of ["(", "[", "`ro", '"x', "roce >> ", "#", "1,00", "every(", ")"]) {
      for (let k = 0; k <= src.length; k++) expect(() => at(src, k)).not.toThrow();
    }
    expect(at("roce", 99).span).toEqual({ start: 0, end: 4 });
  });
});
