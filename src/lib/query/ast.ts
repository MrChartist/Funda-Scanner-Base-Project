// src/lib/query/ast.ts — shared tables and small helpers for the FSQL AST (WS4).
import type { Expr, FnName, PeerScope, Selector, Span, TypeTest } from "@/lib/contracts";

/** Every function, in the order used by the E_UNKNOWN_FUNCTION message (§D.9). */
export const FUNCTION_NAMES: readonly FnName[] = [
  "avg", "median", "min", "max", "sum", "stdev", "cagr", "every", "any", "count", "streak", "growth", "abs", "has",
  "pctl", "sector_pctl", "industry_pctl", "sector_median", "industry_median", "rank",
];

const FN_SET: ReadonlySet<string> = new Set(FUNCTION_NAMES);

export function isFnName(name: string): name is FnName {
  return FN_SET.has(name);
}

/** Window aggregates (second argument is a period). min and max are also scalar. */
export const AGGREGATE_FNS: ReadonlySet<FnName> = new Set<FnName>(["avg", "median", "min", "max", "sum", "stdev"]);
/** Boolean folds over a window. */
export const FOLD_FNS: ReadonlySet<FnName> = new Set<FnName>(["every", "any", "count"]);
/** Functions that read year by year (a window context for their first argument). */
export const YEARLY_FNS: ReadonlySet<FnName> = new Set<FnName>([
  "avg", "median", "min", "max", "sum", "stdev", "cagr", "every", "any", "count", "streak",
]);
/** Cross-sectional functions computed over the whole loaded dataset within the peer class. */
export const PEER_FNS: ReadonlySet<FnName> = new Set<FnName>([
  "pctl", "sector_pctl", "industry_pctl", "sector_median", "industry_median",
]);

export const PEER_SCOPE_OF: Readonly<Partial<Record<FnName, PeerScope>>> = {
  pctl: "class", sector_pctl: "sector", industry_pctl: "industry", sector_median: "sector", industry_median: "industry",
};

export const WINDOW_MIN = 2;
export const WINDOW_MAX = 15;

export const TYPE_TESTS: readonly TypeTest[] = [
  "bank", "nbfc", "insurer", "lender", "financial", "non_financial", "consolidated", "standalone",
];

export function isTypeTest(word: string): word is TypeTest {
  return (TYPE_TESTS as readonly string[]).includes(word);
}

export const TEXT_FIELDS = ["sector", "industry", "symbol", "name"] as const;

/** True when the call is a window form (min/max with a period, or any window-only function). */
export function isWindowCall(e: Expr): boolean {
  if (e.k !== "call") return false;
  if (e.fn === "min" || e.fn === "max") return e.window !== null;
  return YEARLY_FNS.has(e.fn);
}

/** Children of a node, in source order. */
export function children(e: Expr): Expr[] {
  switch (e.k) {
    case "call": return e.args;
    case "neg": return [e.arg];
    case "bin":
    case "cmp": return [e.l, e.r];
    case "between": return [e.x, e.lo, e.hi];
    case "in": return [e.x];
    case "and":
    case "or": return e.items;
    case "not": return [e.arg];
    default: return [];
  }
}

/** Depth-first walk (pre-order). Return false from the visitor to skip a subtree. */
export function walk(e: Expr, visit: (node: Expr, parents: readonly Expr[]) => boolean | void, parents: Expr[] = []): void {
  if (visit(e, parents) === false) return;
  parents.push(e);
  for (const c of children(e)) walk(c, visit, parents);
  parents.pop();
}

/** Metric ids referenced by a node, in order of first appearance. */
export function metricsOf(e: Expr | null, out: string[] = []): string[] {
  if (!e) return out;
  walk(e, (n) => {
    if (n.k === "ref" && !out.includes(n.metric)) out.push(n.metric);
  });
  return out;
}

export function containsError(e: Expr): boolean {
  let found = false;
  walk(e, (n) => {
    if (n.k === "error") found = true;
    return !found;
  });
  return found;
}

export function spanOf(a: Span, b: Span): Span {
  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}

/** Numeric literal value of `n` or `-n`, else null. */
export function literalValue(e: Expr): number | null {
  if (e.k === "num") return e.value;
  if (e.k === "neg" && e.arg.k === "num") return -e.arg.value;
  return null;
}

/** The literal node inside `n` or `-n`. */
export function literalNode(e: Expr): Extract<Expr, { k: "num" }> | null {
  if (e.k === "num") return e;
  if (e.k === "neg" && e.arg.k === "num") return e.arg;
  return null;
}

export function selectorEquals(a: Selector | null, b: Selector | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "prev" || b.kind === "prev") return true;
  return a.offset === (b as { offset: number }).offset;
}
