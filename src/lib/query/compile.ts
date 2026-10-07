// src/lib/query/compile.ts — compileQuery: parse, resolve, type-check, then applicability and
// coverage warnings (§D.7), clause split, canonical text and English (§D.10).
import type {
  CompileQuery, CompiledClause, CompiledQuery, CompiledSort, Expr, MetricStore, QueryAst, QueryIssue, SimpleClause, TypeFamily,
} from "@/lib/contracts";
import { TRI_UNKNOWN } from "@/lib/contracts";
import { isWindowCall, literalValue, metricsOf, PEER_FNS, walk } from "./ast";
import { baseName, capFirst, clauseEnglish, exprEnglish, queryEnglish, sortEnglish } from "./english";
import { issue, MSG, sortIssues } from "./errors";
import {
  CODE_IH, CODE_NAF, CODE_TP, evaluateBoolNode, evaluateNumericNode, isPresent,
} from "./evaluate";
import { nameIndexFor } from "./names";
import { parseSource } from "./parser";
import { printClause, printExpr, printQuery, printSortItem } from "./print";
import { Checker } from "./typecheck";

export const DEFAULT_LIMITS = { maxClauses: 50, maxDepth: 20, maxLength: 4000 } as const;

/** Top-level AND conjuncts of WHERE (an OR group is one clause). */
export function topLevelClauses(where: Expr | null): Expr[] {
  if (!where) return [];
  return where.k === "and" ? where.items : [where];
}

/** `ref[sel]? op number` or `ref BETWEEN n AND n`, else null. */
export function simpleClauseOf(e: Expr): SimpleClause | null {
  if (e.k === "cmp" && e.l.k === "ref") {
    const v = literalValue(e.r);
    if (v === null) return null;
    return { metric: e.l.metric, selector: e.l.selector, op: e.op, value: v, value2: null };
  }
  if (e.k === "between" && !e.negated && e.x.k === "ref") {
    const lo = literalValue(e.lo);
    const hi = literalValue(e.hi);
    if (lo === null || hi === null) return null;
    return { metric: e.x.metric, selector: e.x.selector, op: "between", value: lo, value2: hi };
  }
  return null;
}

function hasRankCall(e: Expr): boolean {
  let found = false;
  walk(e, (x) => {
    if (x.k === "call" && x.fn === "rank") found = true;
    return !found;
  });
  return found;
}

const FAMILY_PHRASE: Readonly<Record<TypeFamily, string>> = {
  lender: "banks and NBFCs", insurance: "insurers", non_financial: "non-financial companies",
};
const FAMILY_NOUN: Readonly<Record<TypeFamily, [string, string]>> = {
  lender: ["lender", "lenders"], insurance: ["insurer", "insurers"], non_financial: ["non-financial company", "non-financial companies"],
};
const ALL_FAMILIES: readonly TypeFamily[] = ["non_financial", "lender", "insurance"];

/** Families that can still match, given top-level type clauses such as `NOT is lender`. */
function familiesInPlay(clauses: readonly Expr[]): Set<TypeFamily> {
  const allowed = new Set<TypeFamily>(ALL_FAMILIES);
  const keep = (fams: TypeFamily[]) => {
    for (const f of ALL_FAMILIES) if (!fams.includes(f)) allowed.delete(f);
  };
  const drop = (fams: TypeFamily[]) => fams.forEach((f) => allowed.delete(f));
  for (const c of clauses) {
    let e = c;
    let negated = false;
    if (e.k === "not" && e.arg.k === "is") {
      negated = true;
      e = e.arg;
    }
    if (e.k !== "is") continue;
    if (e.negated) negated = !negated;
    const fams: TypeFamily[] | null =
      e.test === "lender" || e.test === "bank" || e.test === "nbfc" ? ["lender"]
        : e.test === "insurer" ? ["insurance"]
        : e.test === "financial" ? ["lender", "insurance"]
        : e.test === "non_financial" ? ["non_financial"]
        : null;
    if (!fams) continue;
    if (negated) {
      // `NOT is bank` still lets NBFCs in, so only whole families are dropped.
      if (e.test === "lender" || e.test === "insurer" || e.test === "financial" || e.test === "non_financial") drop(fams);
    } else {
      keep(fams);
    }
  }
  return allowed;
}

function applicabilityWarnings(where: Expr, clauses: readonly Expr[], store: MetricStore): QueryIssue[] {
  const out: QueryIssue[] = [];
  const inPlay = familiesInPlay(clauses);
  const familyCount = new Map<TypeFamily, number>();
  for (let i = 0; i < store.size; i++) {
    const f = store.family(i);
    familyCount.set(f, (familyCount.get(f) ?? 0) + 1);
  }
  const seen = new Set<string>();
  walk(where, (e) => {
    if (e.k !== "ref") return;
    const d = store.def(e.metric);
    if (!d || seen.has(d.base)) return;
    seen.add(d.base);
    const base = store.def(d.base) ?? d;
    const missing = ALL_FAMILIES.filter((f) => !d.appliesTo.includes(f) && inPlay.has(f) && (familyCount.get(f) ?? 0) > 0);
    if (missing.length === 0) return;
    const families = missing.map((f) => FAMILY_PHRASE[f]).join(" or ");
    const counts = missing.map((f) => {
      const n = familyCount.get(f) ?? 0;
      return `${n} ${FAMILY_NOUN[f][n === 1 ? 0 : 1]}`;
    }).join(" and ");
    out.push(issue("W_NOT_APPLICABLE_SOME", MSG.notApplicable(capFirst(baseName(base)), families, counts), e.span));
  });
  return out;
}

/** Coverage of top-level metric references and window functions (§D.7). */
function coverageWarnings(where: Expr, store: MetricStore, source: string): QueryIssue[] {
  const out: QueryIssue[] = [];
  const seen = new Set<string>();
  const nodes: Expr[] = [];
  walk(where, (e) => {
    if (e.k === "call" && PEER_FNS.has(e.fn)) return false;
    if (e.k === "ref" || isWindowCall(e)) {
      const key = printExpr(e);
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push(e);
      }
      return false;
    }
    return true;
  });
  for (const e of nodes) {
    let applicable = 0;
    let nonNull = 0;
    let history = 0;
    const isBool = e.k === "call" && (e.fn === "every" || e.fn === "any");
    if (isBool) {
      const b = evaluateBoolNode(e, store, source);
      for (let i = 0; i < store.size; i++) {
        if (b.t[i] === TRI_UNKNOWN && b.r[i] === CODE_NAF) continue;
        applicable++;
        if (b.t[i] !== TRI_UNKNOWN) nonNull++;
        else if (b.r[i] === CODE_IH || b.r[i] === CODE_TP) history++;
      }
    } else {
      const col = evaluateNumericNode(e, store, source);
      for (let i = 0; i < store.size; i++) {
        if (!isPresent(col, i) && col.reasons[i] === CODE_NAF) continue;
        applicable++;
        if (isPresent(col, i)) nonNull++;
        else if (col.reasons[i] === CODE_IH || col.reasons[i] === CODE_TP) history++;
      }
    }
    if (applicable === 0) continue;
    const name = e.k === "ref" ? exprEnglish(e, store, source) : printExpr(e);
    const text = printExpr(e);
    if (nonNull === 0) {
      const msg = e.k === "ref" ? MSG.noCoverageRef(name)
        : history * 2 >= applicable ? MSG.noCoverageHistory(text) : MSG.noCoverageExpr(text);
      out.push(issue("W_NO_COVERAGE", msg, e.span));
    } else if (nonNull * 2 < applicable) {
      out.push(issue("W_LOW_COVERAGE", MSG.lowCoverage(e.k === "ref" ? name : text, nonNull, applicable), e.span));
    }
  }
  return out;
}

function failed(source: string, issues: QueryIssue[]): CompiledQuery {
  return {
    ok: false, source, canonical: "", ast: null, clauses: [], sort: [], limit: null, metrics: [], issues: sortIssues(issues),
    english: "",
  };
}

export const compileQuery: CompileQuery = (source, store, options) => {
  const maxLength = options?.maxLength ?? DEFAULT_LIMITS.maxLength;
  const maxClauses = options?.maxClauses ?? DEFAULT_LIMITS.maxClauses;
  const maxDepth = options?.maxDepth ?? DEFAULT_LIMITS.maxDepth;
  if (source.length > maxLength) {
    return failed(source, [issue("E_TOO_COMPLEX", MSG.tooLong(maxLength), { start: maxLength, end: source.length })]);
  }
  const index = nameIndexFor(store);
  const parsed = parseSource(source, index, { maxDepth, store });
  const issues = [...parsed.issues];
  const ast: QueryAst | null = parsed.ast;
  if (!ast) return failed(source, issues);
  const checker = new Checker(store, source);
  checker.checkQuery(ast);
  issues.push(...checker.issues);
  const clauseExprs = topLevelClauses(ast.where);
  if (clauseExprs.length > maxClauses) {
    issues.push(issue("E_TOO_COMPLEX", MSG.tooManyClauses(maxClauses), clauseExprs[maxClauses].span));
  }
  const ok = !issues.some((x) => x.level === "error");
  if (ok && ast.where) {
    issues.push(...applicabilityWarnings(ast.where, clauseExprs, store));
    issues.push(...coverageWarnings(ast.where, store, source));
  }
  const clauses: CompiledClause[] = clauseExprs.map((e, index) => ({
    index,
    ast: e,
    span: e.span,
    text: printClause(e),
    english: clauseEnglish(e, store, source),
    metrics: metricsOf(e),
    simple: simpleClauseOf(e),
  }));
  const sort: CompiledSort[] = ast.sort.map((s) => ({
    ast: s.expr,
    dir: s.dir,
    text: printSortItem(s),
    english: sortEnglish(s, store, source),
    usesRank: hasRankCall(s.expr),
  }));
  const metrics = metricsOf(ast.where);
  for (const s of ast.sort) metricsOf(s.expr, metrics);
  return {
    ok,
    source,
    canonical: ok ? printQuery(ast) : "",
    ast,
    clauses,
    sort,
    limit: ast.limit,
    metrics,
    issues: sortIssues(issues),
    english: queryEnglish(ast, clauseExprs, store, source),
  };
};
