// src/lib/query/print.ts — canonical printer (§D.10). Metric ids, lower-case functions, upper-case
// keywords, explicit AND, one line, numbers scaled with suffixes removed, double-quoted strings.
// parse(print(ast)) equals ast apart from spans and the written form of names (print.test.ts).
import type { Expr, PrintQuery, QueryAst, Selector, SortItem } from "@/lib/contracts";

/** Plain decimal text for a number, never in exponent notation. */
export function printNumber(v: number): string {
  if (!Number.isFinite(v)) return "0";
  if (Object.is(v, -0)) return "0";
  let s = String(v);
  if (/e/i.test(s)) {
    s = Math.abs(v) >= 1 ? BigInt(Math.round(v)).toString() : v.toFixed(20).replace(/\.?0+$/, "");
  }
  return s;
}

export function printSelector(sel: Selector | null): string {
  if (!sel) return "";
  if (sel.kind === "prev") return "[prev]";
  return sel.offset === 0 ? `[${sel.kind}]` : `[${sel.kind}-${sel.offset}]`;
}

function printString(s: string): string {
  return s.includes('"') && !s.includes("'") ? `'${s}'` : `"${s.replace(/"/g, "")}"`;
}

/** Binding strength used to decide where parentheses are needed. */
export function precedence(e: Expr): number {
  switch (e.k) {
    case "or": return 1;
    case "and": return 2;
    case "not": return 3;
    case "cmp":
    case "between":
    case "in":
    case "is": return 4;
    case "bin": return e.op === "+" || e.op === "-" ? 5 : 6;
    case "neg": return 7;
    default: return 8;
  }
}

function wrap(e: Expr, min: number): string {
  const s = printExpr(e);
  return precedence(e) < min ? `(${s})` : s;
}

export function printExpr(e: Expr): string {
  switch (e.k) {
    case "num": return printNumber(e.value);
    case "str": return printString(e.value);
    case "ref": return `${e.metric}${printSelector(e.selector)}`;
    case "text": return e.field;
    case "call": {
      const parts = e.args.map(printExpr);
      if (e.window) parts.push(`${e.window.n}y`);
      if (e.order) parts.push(e.order.toUpperCase());
      return `${e.fn}(${parts.join(", ")})`;
    }
    case "neg": return `-${wrap(e.arg, 7)}`;
    case "bin": {
      const p = precedence(e);
      return `${wrap(e.l, p)} ${e.op} ${wrap(e.r, p + 1)}`;
    }
    case "cmp": return `${wrap(e.l, 5)} ${e.op} ${wrap(e.r, 5)}`;
    case "between":
      return `${wrap(e.x, 5)} ${e.negated ? "NOT " : ""}BETWEEN ${wrap(e.lo, 5)} AND ${wrap(e.hi, 5)}`;
    case "in": return `${wrap(e.x, 5)} ${e.negated ? "NOT " : ""}IN (${e.items.map(printString).join(", ")})`;
    case "and": return e.items.map((x) => wrap(x, 3)).join(" AND ");
    case "or": return e.items.map((x) => wrap(x, 2)).join(" OR ");
    case "not": return `NOT ${wrap(e.arg, 3)}`;
    case "is": return `IS ${e.negated ? "NOT " : ""}${e.test}`;
    case "error": return "?";
  }
}

/** A top-level clause as it must be written on its own line (an OR group keeps its brackets). */
export function printClause(e: Expr): string {
  return wrap(e, 3);
}

export function printSortItem(s: SortItem): string {
  return `${wrap(s.expr, 5)} ${s.dir.toUpperCase()}`;
}

/** "SORT BY … LIMIT n" (empty when the query has neither). */
export function printTail(ast: Pick<QueryAst, "sort" | "limit">): string {
  const parts: string[] = [];
  if (ast.sort.length > 0) parts.push(`SORT BY ${ast.sort.map(printSortItem).join(", ")}`);
  if (ast.limit !== null) parts.push(`LIMIT ${ast.limit}`);
  return parts.join(" ");
}

export const printQuery: PrintQuery = (ast) => {
  const parts: string[] = [];
  if (ast.where) parts.push(printExpr(ast.where));
  const tail = printTail(ast);
  if (tail) parts.push(tail);
  return parts.join(" ");
};
