import { describe, expect, it } from "vitest";
import type { Expr } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { compileQuery } from "./compile";
import { nameIndexFor } from "./names";
import { parseSource } from "./parser";

const store = createStore(createTinyDataset());
const index = nameIndexFor(store);
const parse = (src: string) => parseSource(src, index, { maxDepth: 20 });
const where = (src: string) => parse(src).ast?.where as Expr;
const codes = (src: string) =>
  parse(src).issues.filter((i) => i.level === "error").sort((a, b) => a.span.start - b.span.start).map((i) => i.code);

/** Fully bracketed structure, to check precedence. */
function shape(e: Expr): string {
  switch (e.k) {
    case "num": return String(e.value);
    case "str": return `"${e.value}"`;
    case "ref": return e.metric + (e.selector ? `[${e.selector.kind}${"offset" in e.selector ? e.selector.offset : ""}]` : "");
    case "text": return e.field;
    case "call": return `${e.fn}(${e.args.map(shape).join(",")}${e.window ? `,${e.window.n}y` : ""}${e.order ? `,${e.order}` : ""})`;
    case "neg": return `(-${shape(e.arg)})`;
    case "bin": return `(${shape(e.l)}${e.op}${shape(e.r)})`;
    case "cmp": return `(${shape(e.l)}${e.op}${shape(e.r)})`;
    case "between": return `(${shape(e.x)}${e.negated ? " not" : ""} between ${shape(e.lo)},${shape(e.hi)})`;
    case "in": return `(${shape(e.x)}${e.negated ? " not" : ""} in ${e.items.join("|")})`;
    case "and": return `and[${e.items.map(shape).join("; ")}]`;
    case "or": return `or[${e.items.map(shape).join("; ")}]`;
    case "not": return `not(${shape(e.arg)})`;
    case "is": return `is${e.negated ? "!" : ""}:${e.test}`;
    case "error": return "ERR";
  }
}

describe("precedence (§D.3)", () => {
  it("binds * and / tighter than + and -, left to right", () => {
    expect(shape(where("roe > 1 + 2 * 3"))).toBe("(roe>(1+(2*3)))");
    expect(shape(where("roe > 8 - 4 - 2"))).toBe("(roe>((8-4)-2))");
    expect(shape(where("roe > 8 / 4 / 2"))).toBe("(roe>((8/4)/2))");
    expect(shape(where("roe > (1 + 2) * 3"))).toBe("(roe>((1+2)*3))");
  });

  it("binds unary minus tighter than *, and selectors tighter than unary minus", () => {
    expect(shape(where("roe > -2 * 3"))).toBe("(roe>((-2)*3))");
    expect(shape(where("roe > -roe[prev]"))).toBe("(roe>(-roe[prev]))");
  });

  it("puts comparisons above NOT, NOT above AND, AND above OR", () => {
    expect(shape(where("NOT roe > 1 AND pe < 2 OR roce > 3"))).toBe("or[and[not((roe>1)); (pe<2)]; (roce>3)]");
    expect(shape(where("roe > 1 OR pe < 2 AND roce > 3"))).toBe("or[(roe>1); and[(pe<2); (roce>3)]]");
    expect(shape(where("NOT NOT roe > 1"))).toBe("not(not((roe>1)))");
    expect(shape(where("NOT (roe > 1 AND pe < 2)"))).toBe("not(and[(roe>1); (pe<2)])");
  });

  it("keeps the AND of BETWEEN for the range", () => {
    expect(shape(where("roe BETWEEN 15 AND 25 AND pe < 30"))).toBe("and[(roe between 15,25); (pe<30)]");
    expect(shape(where("roe NOT BETWEEN 1 + 1 AND 2 * 3"))).toBe("(roe not between (1+1),(2*3))");
  });

  it("treats a < b < c as an error with a BETWEEN fix", () => {
    const res = parse("10 < roce < 20");
    expect(codes("10 < roce < 20")).toEqual(["E_CHAINED_COMPARISON"]);
    expect(res.issues[0].suggestions[0].replacement).toBe("roce BETWEEN 10 AND 20");
    expect(parse("20 > roce > 10").issues[0].suggestions[0].replacement).toBe("roce BETWEEN 10 AND 20");
  });

  it("accepts == and <> as = and !=", () => {
    expect(shape(where("roe == 1 AND pe <> 2"))).toBe("and[(roe=1); (pe!=2)]");
  });
});

describe("implicit AND (§D.2)", () => {
  it("turns a new line into AND at depth 0 and reports it", () => {
    const res = parse("roce > 15\npe < 20");
    expect(shape(res.ast?.where as Expr)).toBe("and[(roce>15); (pe<20)]");
    const and = res.ast?.where as Extract<Expr, { k: "and" }>;
    expect(and.implicit).toEqual([true]);
    expect(res.issues.map((i) => i.code)).toEqual(["I_IMPLICIT_AND"]);
  });

  it("does not insert AND inside brackets or calls", () => {
    expect(shape(where("(roce > 15\nOR pe < 20)"))).toBe("or[(roce>15); (pe<20)]");
    expect(codes("(roce > 15\npe < 20)")).toEqual(["E_UNEXPECTED_TOKEN"]);
    expect(shape(where("every(roce >\n15, 5y)"))).toBe("every((roce>15),5y)");
  });

  it("does not insert AND when the line ends with an operator or BETWEEN waits for AND", () => {
    expect(shape(where("roce >\n15"))).toBe("(roce>15)");
    expect(shape(where("roe BETWEEN 15\nAND 25"))).toBe("(roe between 15,25)");
    expect(shape(where("roce > 15 AND\npe < 20"))).toBe("and[(roce>15); (pe<20)]");
  });

  it("does not treat SORT BY or LIMIT on a new line as a condition", () => {
    const res = parse("pe < 20\nSORT BY roce DESC\nLIMIT 10");
    expect(shape(res.ast?.where as Expr)).toBe("(pe<20)");
    expect(res.ast?.sort.map((s) => [shape(s.expr), s.dir])).toEqual([["roce", "desc"]]);
    expect(res.ast?.limit).toBe(10);
  });

  it("keeps comments out of the parse", () => {
    expect(shape(where("# heading and more\nroce > 15 # and here\n# OR this\npe < 2"))).toBe("and[(roce>15); (pe<2)]");
  });
});

describe("contextual keywords", () => {
  it("reads IN only before a bracket and IS only at the start of a predicate", () => {
    expect(shape(where('sector IN ("Cement", "Pharma")'))).toBe("(sector in Cement|Pharma)");
    expect(shape(where('sector NOT IN ("Cement")'))).toBe("(sector not in Cement)");
    expect(shape(where("is lender AND IS NOT bank"))).toBe("and[is:lender; is!:bank]");
    expect(shape(where("NOT is lender"))).toBe("not(is:lender)");
    expect(codes("is green")).toEqual(["E_UNEXPECTED_TOKEN"]);
    expect(codes('sector IN (5)')).toEqual(["E_UNEXPECTED_TOKEN"]);
  });

  it("reads the text fields only as whole phrases", () => {
    expect(where('name = "Tinymill"').k).toBe("cmp");
    expect(shape(where('symbol != "TINYMFG"'))).toBe('(symbol!="TINYMFG")');
  });

  it("accepts ORDER BY and a leading WHERE as synonyms (info)", () => {
    const res = parse("WHERE pe < 20 ORDER BY roce");
    expect(res.issues.map((i) => i.code)).toEqual(["I_KEYWORD_SYNONYM", "I_KEYWORD_SYNONYM"]);
    expect(res.ast?.sort).toHaveLength(1);
  });

  it("rejects reserved words at the start of a clause, but allows rank(", () => {
    for (const w of ["LET", "FROM", "TOP", "SELECT", "GROUP", "RANK"]) expect(codes(`${w} x > 1`)).toEqual(["E_RESERVED_WORD"]);
    expect(parse("FROM x").issues[0].message).toBe("FROM is not used in queries. Use the Universe selector above the query.");
    expect(parse("RANK roce").issues[0].message).toBe("RANK is not a clause. Use SORT BY rank(x).");
    expect(codes("pe < 20 SORT BY rank(roce)")).toEqual([]);
  });

  it("merges p/e, d/e and ev/ebitda but keeps other slashes as division", () => {
    expect(shape(where("p/e < 25 AND d/e < 1 AND ev/ebitda < 12"))).toBe("and[(pe<25); (debt_equity<1); (ev_ebitda<12)]");
    expect(shape(where("market_cap/sales > 2"))).toBe("((market_cap/sales)>2)");
  });
});

describe("calls, selectors, sort and limit", () => {
  it("reads windows, orders and nested calls", () => {
    expect(shape(where("avg(roce, 5y) > max(roe, pe)"))).toBe("(avg(roce,5y)>max(roe,pe))");
    const s = parse("pe < 1 SORT BY rank(pe, ASC) + rank(roce) DESC, pe ASC LIMIT 5").ast;
    expect(s?.sort.map((x) => [shape(x.expr), x.dir])).toEqual([["(rank(pe,asc)+rank(roce))", "desc"], ["pe", "asc"]]);
    expect(s?.limit).toBe(5);
  });

  it("reads every selector form", () => {
    expect(shape(where("sales[fy] > sales[fy-3] AND net_profit[ttm-1] > 0 AND q_sales[q-4] > 0 AND sales[prev] > 0")))
      .toBe("and[(sales[fy0]>sales[fy3]); (net_profit[ttm1]>0); (q_sales[q4]>0); (sales[prev]>0)]");
    expect(codes("sales[fy+1] > 0")).toEqual(["E_BAD_SELECTOR"]);
    expect(codes("sales[year] > 0")).toEqual(["E_BAD_SELECTOR"]);
    expect(codes("abs(sales)[prev] > 0")).toEqual(["E_BAD_SELECTOR"]);
  });

  it("validates LIMIT", () => {
    expect(codes("pe < 1 LIMIT 1001")).toEqual(["E_LIMIT_RANGE"]);
    expect(codes("pe < 1 LIMIT 2.5")).toEqual(["E_LIMIT_RANGE"]);
    expect(codes("pe < 1 LIMIT")).toEqual(["E_UNEXPECTED_END"]);
    expect(parse("pe < 1 LIMIT 1000").ast?.limit).toBe(1000);
    expect(codes("pe < 1 LIMIT 5 roce")).toEqual(["E_UNEXPECTED_TOKEN"]);
  });

  it("allows a query with only SORT BY", () => {
    const res = parse("SORT BY roce DESC LIMIT 3");
    expect(res.ast?.where).toBeNull();
    expect(res.issues).toEqual([]);
  });

  it("uses a period only as the last input of a call", () => {
    expect(codes("roce > 5y")).toEqual(["E_UNEXPECTED_TOKEN"]);
    expect(codes("avg(5y, roce) > 1")).toEqual(["E_UNEXPECTED_TOKEN"]);
    expect(codes("avg(roce, 5y, 3y) > 1")).toEqual(["E_UNEXPECTED_TOKEN"]);
    expect(codes("avg(roce, ASC) > 1")).toEqual(["E_UNEXPECTED_TOKEN"]);
  });
});

describe("error recovery (§D.9)", () => {
  it("reports several errors in one pass and keeps the good clauses", () => {
    const res = parse("roce >> 15 AND debt_equty < 0.5 AND pe < 20");
    expect(res.issues.map((i) => i.code)).toEqual(["E_UNEXPECTED_TOKEN", "E_UNKNOWN_METRIC"]);
    expect(shape(res.ast?.where as Expr)).toBe("and[ERR; (ERR<0.5); (pe<20)]");
  });

  it("recovers at new lines and at OR", () => {
    expect(codes("roce >> 1\npe < 2\nfoo(1) > 2 OR roe @ 1")).toEqual(["E_UNEXPECTED_TOKEN", "E_UNKNOWN_FUNCTION", "E_UNEXPECTED_CHAR"]);
  });

  it("reports a stray closing bracket once", () => {
    expect(codes("roce > 15) AND pe < 20")).toEqual(["E_UNBALANCED_PAREN"]);
    expect(parse("roce > 15)").issues[0].message).toBe("This ')' has no matching '('.");
  });

  it("reports an unclosed bracket in a call", () => {
    expect(codes("avg(roce, 5y > 1")).toEqual(["E_UNBALANCED_PAREN", "E_UNEXPECTED_TOKEN"]);
    expect(codes("abs(roce")).toEqual(["E_UNBALANCED_PAREN"]);
  });

  it("stops with E_TOO_COMPLEX when nesting is too deep, without a stack overflow", () => {
    const deep = `${"(".repeat(30)}roce > 1${")".repeat(30)}`;
    expect(codes(deep)).toEqual(["E_TOO_COMPLEX"]);
    expect(codes(`roce > ${"-".repeat(5000)}1`)).toEqual(["E_TOO_COMPLEX"]);
  });

  it("limits length and clause count through compile options", () => {
    expect(compileQuery("x".repeat(4001), store).issues[0].code).toBe("E_TOO_COMPLEX");
    const many = Array.from({ length: 51 }, (_, k) => `roce > ${k}`).join(" AND ");
    expect(compileQuery(many, store).issues.some((i) => i.code === "E_TOO_COMPLEX")).toBe(true);
    expect(compileQuery("roce > 1 AND pe < 2 AND roe > 3", store, { maxClauses: 2 }).ok).toBe(false);
  });

  it("never throws on arbitrary input", () => {
    const junk = ["", " ", ")", "(", "[", "]", ",", "AND", "OR OR", "NOT", "IS", "BETWEEN", "SORT", "SORT BY", "LIMIT x",
      "\"", "`", "a[", "a[fy-", "avg(", "avg(,", "1 1 1", "- - -", "roe > > >", "roce BETWEEN 1", "sector IN (", "is not",
      "every(", "rank(", "`roce`[q-", "#", "\n\n\n", "roce\n\n> 1"];
    for (const q of junk) expect(() => compileQuery(q, store)).not.toThrow();
  });
});
