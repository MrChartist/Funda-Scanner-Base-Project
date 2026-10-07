import { describe, expect, it } from "vitest";
import type { CmpOp, Expr, FnName, QueryAst, Selector, TypeTest } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { allMetricDefs } from "@/lib/metrics";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { FUNCTION_NAMES, TYPE_TESTS } from "./ast";
import { compileQuery } from "./compile";
import { nameIndexFor } from "./names";
import { parseSource } from "./parser";
import { printNumber, printQuery } from "./print";

const store = createStore(createTinyDataset());
const index = nameIndexFor(store);

/** Seeded PRNG (mulberry32) so the property test is reproducible. */
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

const IDS = allMetricDefs().map((d) => d.id);
const SPAN = { start: 0, end: 0 };
const CMP: CmpOp[] = [">", ">=", "<", "<=", "=", "!="];
const WORDS = ["Cement", "IT services", "Metals & Mining", "Banks", "o'clock", "A"];

function generator(seed: number) {
  const rnd = mulberry32(seed);
  const int = (n: number) => Math.floor(rnd() * n);
  const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)];

  const selector = (): Selector | null => {
    const r = int(6);
    if (r === 0) return { kind: "prev" };
    if (r === 1) return { kind: pick(["fy", "ttm", "q"] as const), offset: int(6) };
    return null;
  };
  const num = (): Expr => {
    const r = int(4);
    const value = r === 0 ? int(1000) : r === 1 ? int(100000) / 100 : r === 2 ? rnd() * 50 : int(3);
    return { k: "num", value, suffix: null, span: SPAN };
  };

  function numeric(depth: number): Expr {
    const r = depth <= 0 ? int(3) : int(9);
    switch (r) {
      case 0: return num();
      case 1:
      case 2: {
        const metric = pick(IDS);
        return { k: "ref", metric, written: metric, selector: selector(), span: SPAN };
      }
      case 3: return { k: "neg", arg: numeric(depth - 1), span: SPAN };
      case 4:
      case 5: return { k: "bin", op: pick(["+", "-", "*", "/"] as const), l: numeric(depth - 1), r: numeric(depth - 1), span: SPAN };
      case 6: return { k: "text", field: pick(["sector", "industry", "symbol", "name"] as const), span: SPAN };
      default: {
        const fn: FnName = pick(FUNCTION_NAMES);
        const n = int(3);
        const args = Array.from({ length: n }, () => (int(3) === 0 ? boolean(depth - 1) : numeric(depth - 1)));
        const window = int(2) === 0 ? { n: 1 + int(15), unit: "y" as const } : null;
        const order = fn === "rank" && int(2) === 0 ? pick(["asc", "desc"] as const) : null;
        return { k: "call", fn, args, window, order, span: SPAN };
      }
    }
  }

  function boolean(depth: number): Expr {
    const r = depth <= 0 ? int(3) : int(10);
    switch (r) {
      case 0: return { k: "cmp", op: pick(CMP), l: numeric(depth - 1), r: numeric(depth - 1), span: SPAN };
      case 1: return { k: "is", test: pick(TYPE_TESTS) as TypeTest, negated: int(2) === 0, span: SPAN };
      case 2: return { k: "in", x: numeric(0), items: Array.from({ length: 1 + int(3) }, () => pick(WORDS)), negated: int(2) === 0, span: SPAN };
      case 3: return { k: "between", x: numeric(depth - 1), lo: numeric(depth - 1), hi: numeric(depth - 1), negated: int(2) === 0, span: SPAN };
      case 4: return { k: "not", arg: boolean(depth - 1), span: SPAN };
      case 5:
      case 6: {
        const items = Array.from({ length: 2 + int(3) }, () => boolean(depth - 1));
        return { k: "and", items, implicit: items.slice(1).map(() => false), span: SPAN };
      }
      case 7:
      case 8: return { k: "or", items: Array.from({ length: 2 + int(2) }, () => boolean(depth - 1)), span: SPAN };
      default: return numeric(depth - 1);
    }
  }

  return (): QueryAst => ({
    where: int(8) === 0 ? null : boolean(3),
    sort: int(3) === 0 ? Array.from({ length: 1 + int(2) }, () => ({ expr: numeric(2), dir: pick(["asc", "desc"] as const), span: SPAN })) : [],
    limit: int(3) === 0 ? 1 + int(1000) : null,
    span: SPAN,
  });
}

/** AST without spans and written names (the printer canonicalises both). */
function strip(x: unknown): unknown {
  return JSON.parse(JSON.stringify(x, (k, v) => (k === "span" || k === "written" ? undefined : v)));
}

describe("canonical printer (§D.10)", () => {
  it("round-trips 2,000 seeded random ASTs: parse(print(ast)) equals ast", () => {
    const gen = generator(20261007);
    for (let k = 0; k < 2000; k++) {
      const ast = gen();
      const text = printQuery(ast);
      const parsed = parseSource(text, index, { maxDepth: 60 });
      const errors = parsed.issues.filter((i) => i.level === "error");
      if (errors.length > 0 || !parsed.ast) throw new Error(`#${k}: ${text}\n${JSON.stringify(errors)}`);
      expect(strip(parsed.ast), `#${k}: ${text}`).toEqual(strip(ast));
      expect(printQuery(parsed.ast)).toBe(text);
    }
  });

  it("prints ids, lower-case functions, upper-case keywords, explicit AND, one line", () => {
    const q = compileQuery(
      "Return on capital employed > 15%\n# note\nAVG(roe, 5 years) >= 15.50 or not IS lender\nsort by RANK(pe, asc) limit 30",
      store,
    );
    // AND (including the implicit AND of a new line) binds tighter than OR.
    expect(q.canonical).toBe("roce > 15 AND avg(roe, 5y) >= 15.5 OR NOT IS lender SORT BY rank(pe, ASC) DESC LIMIT 30");
    expect(compileQuery("sector = 'Cement'", store).canonical).toBe('sector = "Cement"');
    expect(compileQuery("x BETWEEN 1 AND 2", store).canonical).toBe("");
  });

  it("prints numbers without exponents and without suffixes", () => {
    expect(printNumber(150000)).toBe("150000");
    expect(printNumber(0.0000001)).toBe("0.0000001");
    expect(printNumber(1e21)).toBe("1000000000000000000000");
    expect(printNumber(-0)).toBe("0");
    expect(compileQuery("market_cap > 20k", store).canonical).toBe("market_cap > 20000");
  });

  it("keeps the brackets that the tree needs", () => {
    const cases: [string, string][] = [
      ["roe > (1 + 2) * 3", "roe > (1 + 2) * 3"],
      ["roe > 1 - (2 - 3)", "roe > 1 - (2 - 3)"],
      ["roe > (1 - 2) - 3", "roe > 1 - 2 - 3"],
      ["roe > -(1 + 2)", "roe > -(1 + 2)"],
      ["(roe > 1 AND pe < 2) AND roce > 3", "(roe > 1 AND pe < 2) AND roce > 3"],
      ["roe > 1 AND (pe < 2 OR roce > 3)", "roe > 1 AND (pe < 2 OR roce > 3)"],
      ["NOT (roe > 1 OR pe < 2)", "NOT (roe > 1 OR pe < 2)"],
    ];
    for (const [src, out] of cases) expect(compileQuery(src, store).canonical).toBe(out);
  });
});
