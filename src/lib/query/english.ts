// src/lib/query/english.ts — deterministic plain-English rendering (§D.10).
// Every rendering states the period of each metric and the scope of peer and rank functions.
import type { CmpOp, Expr, MetricDef, MetricStore, QueryAst, Selector, SortItem, TypeTest } from "@/lib/contracts";
import { formatUnitValue } from "@/lib/format/metric-value";
import { literalNode } from "./ast";
import { literalDecimals } from "./evaluate";
import { printExpr, printNumber } from "./print";
import { unitOf, type UnitTag } from "./typecheck";

export const END_NOTE = "Companies with missing data are not counted as matches.";
const IN_DATA = "(among companies in your data)";

const OP_WORD: Readonly<Record<CmpOp, string>> = {
  ">": "above", ">=": "at least", "<": "below", "<=": "at most", "=": "equal to", "!=": "not equal to",
};

const TYPE_PHRASE: Readonly<Record<TypeTest, [string, string]>> = {
  bank: ["the company is a bank", "the company is not a bank"],
  nbfc: ["the company is an NBFC", "the company is not an NBFC"],
  insurer: ["the company is an insurer", "the company is not an insurer"],
  lender: ["the company is a bank or NBFC", "the company is not a bank or NBFC"],
  financial: ["the company is a bank, NBFC or insurer", "the company is not a bank, NBFC or insurer"],
  non_financial: ["the company is a non-financial company", "the company is not a non-financial company"],
  consolidated: ["the figures are consolidated", "the figures are not consolidated"],
  standalone: ["the figures are standalone", "the figures are not standalone"],
};

export function capFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Lower-cases the first letter unless the first word is an abbreviation ("ROCE", "P/E"). */
export function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

const ACRONYM = /^[A-Z0-9/'".&-]+$/;

/** Name of a base metric in running text: the short form for abbreviations, else the label. */
export function baseName(d: MetricDef): string {
  return ACRONYM.test(d.short) ? d.short : lowerFirst(d.label);
}

function years(n: number): string {
  return n === 1 ? "financial year" : `${n} financial years`;
}

/** Name of any metric, including variants, without a period phrase for base metrics. */
export function metricName(d: MetricDef, store: MetricStore): string {
  if (d.variant === null) return baseName(d);
  const base = store.def(d.base);
  const b = base ? baseName(base) : d.base;
  const n = Number(/_(\d+)y$/.exec(d.id)?.[1] ?? "0");
  switch (d.variant) {
    case "prev": return `${b} in the previous ${d.history === "annual" ? "financial year" : "quarter"}`;
    case "ttm": return `${b} (TTM)`;
    case "avg_3y": case "avg_5y": case "avg_10y": return `${b} averaged over the last ${years(n)}`;
    case "min_5y": return `the lowest ${b} in the last ${years(n)}`;
    case "stdev_5y": return `the variation (standard deviation) of ${b} over the last ${years(n)}`;
    case "cagr_3y": case "cagr_5y": case "cagr_10y": return `${b} growth (CAGR) over the last ${years(n)}`;
    case "cum_3y": case "cum_5y": case "cum_10y": return `total ${b} over the last ${years(n)}`;
    case "chg_1q": return `the change in ${b} over the last quarter`;
    case "chg_1y": return `the change in ${b} over the last year`;
    case "chg_3y": return `the change in ${b} over the last 3 years`;
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function selectorPhrase(sel: Selector, d: MetricDef, inWindow: boolean): string {
  switch (sel.kind) {
    case "fy": return sel.offset === 0 ? "(latest FY)" : `(${plural(sel.offset, "financial year", "financial years")} before the latest)`;
    case "ttm": return sel.offset === 0 ? "(TTM)" : `(the TTM period ${plural(sel.offset, "year", "years")} earlier)`;
    case "q": return sel.offset === 0 ? "(latest quarter)" : `(${plural(sel.offset, "quarter", "quarters")} before the latest)`;
    case "prev":
      if (d.history !== "annual") return "(previous quarter)";
      return inWindow ? "(the year before)" : "(previous financial year)";
  }
}

function defaultPeriod(d: MetricDef): string {
  if (d.variant !== null) return "";
  switch (d.periodTag) {
    case "FY": return "(latest FY)";
    case "TTM": return "(TTM)";
    case "Latest qtr": return "(latest quarter)";
    default: return "";
  }
}

interface Ctx {
  store: MetricStore;
  source: string;
  inWindow: boolean;
  /** Omit period phrases (inside peer functions: "the median P/E of its industry"). */
  plain: boolean;
}

function refText(e: Extract<Expr, { k: "ref" }>, ctx: Ctx): string {
  const d = ctx.store.def(e.metric);
  if (!d) return e.metric;
  const name = metricName(d, ctx.store);
  if (e.selector) return `${name} ${selectorPhrase(e.selector, d, ctx.inWindow)}`;
  if (ctx.inWindow || ctx.plain) return name;
  const p = defaultPeriod(d);
  return p ? `${name} ${p}` : name;
}

/** A literal in the unit of the other side ("15%", "0.5x", "₹500 Cr"). */
function literalText(e: Expr, unit: UnitTag | null, ctx: Ctx, pointsForPct = false): string {
  const node = literalNode(e);
  if (!node) return numText(e, ctx);
  const v = e.k === "neg" ? -node.value : node.value;
  const d = literalDecimals(e, ctx.source);
  if (pointsForPct && (unit === "pct" || unit === "pp")) return `${printNumber(v)} percentage ${Math.abs(v) === 1 ? "point" : "points"}`;
  if (unit === null || unit === "pctl" || unit === "fy_year") return printNumber(v);
  return formatUnitValue(unit, unit === "inr_cr" ? Math.min(d, 2) : d, v);
}

function windowText(n: number): string {
  return `over the last ${years(n)}`;
}

function scopeWord(fn: string): string {
  return fn.startsWith("sector") ? "its sector" : fn.startsWith("industry") ? "its industry" : "its peer class";
}

export function numText(e: Expr, ctx: Ctx): string {
  switch (e.k) {
    case "num": return printNumber(e.value);
    case "ref": return refText(e, ctx);
    case "text": return `the ${e.field}`;
    case "str": return `"${e.value}"`;
    case "neg": return e.arg.k === "num" ? `-${printNumber(e.arg.value)}` : `minus ${numText(e.arg, ctx)}`;
    case "bin": {
      const lu = unitOf(e.l, ctx.store);
      const ru = unitOf(e.r, ctx.store);
      const side = (x: Expr, other: UnitTag | null) =>
        literalNode(x) ? (e.op === "+" || e.op === "-" ? literalText(x, other, ctx, true) : literalText(x, null, ctx)) : numText(x, ctx);
      const l = side(e.l, ru);
      const r = side(e.r, lu);
      switch (e.op) {
        case "+": return `${l} plus ${r}`;
        case "-": return `${l} minus ${r}`;
        case "*": return `${l} times ${r}`;
        case "/": return `${l} divided by ${r}`;
      }
      break;
    }
    case "call": {
      const inner = { ...ctx, inWindow: e.window !== null || e.fn === "streak" ? true : ctx.inWindow };
      const a0 = e.args[0];
      const n = e.window?.n ?? 0;
      // A call with the wrong inputs (already reported as an error) is shown as written.
      if (!a0 || (e.fn === "growth" && !e.args[1])) return printExpr(e);
      switch (e.fn) {
        case "abs": return `the absolute value of ${numText(a0, ctx)}`;
        case "min":
        case "max":
          if (e.window) return `the ${e.fn === "min" ? "lowest" : "highest"} ${numText(a0, inner)} in the last ${years(n)}`;
          return `the ${e.fn === "min" ? "smaller" : "larger"} of ${e.args.map((a) => numText(a, ctx)).join(" and ")}`;
        case "growth": return `the growth from ${numText(e.args[1], ctx)} to ${numText(a0, ctx)}`;
        case "avg": return `the average of ${numText(a0, inner)} ${windowText(n)}`;
        case "median": return `the median of ${numText(a0, inner)} ${windowText(n)}`;
        case "sum": return `the total of ${numText(a0, inner)} ${windowText(n)}`;
        case "stdev": return `the standard deviation of ${numText(a0, inner)} ${windowText(n)}`;
        case "cagr": return `the ${n}-year CAGR of ${numText(a0, inner)}`;
        case "count": return `the number of the last ${years(n)} in which ${condText(a0, inner, true)}`;
        case "streak": return `the number of consecutive financial years, up to the latest, in which ${condText(a0, inner, true)}`;
        case "pctl":
        case "sector_pctl":
        case "industry_pctl":
          return `the percentile of ${numText(a0, { ...ctx, plain: true })} within ${scopeWord(e.fn)} ${IN_DATA}`;
        case "sector_median":
        case "industry_median":
          return `the median ${numText(a0, { ...ctx, plain: true })} of ${scopeWord(e.fn)} ${IN_DATA}`;
        case "rank":
          return `the rank of ${numText(a0, ctx)} among the matching companies (1 = ${e.order === "asc" ? "lowest" : "highest"})`;
        case "has": return `whether ${numText(a0, ctx)} is available`;
        case "every":
        case "any": return condText(e, ctx, false);
      }
      break;
    }
    default: return condText(e, ctx, false);
  }
  return "";
}

function countPhrase(op: CmpOp, k: string): string {
  switch (op) {
    case ">=": return `at least ${k}`;
    case ">": return `more than ${k}`;
    case "<=": return `at most ${k}`;
    case "<": return `fewer than ${k}`;
    case "=": return `exactly ${k}`;
    case "!=": return `other than ${k}`;
  }
}

function joinOr(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

/** A boolean expression as a clause ("ROCE is above 15%"); `past` uses "was" for yearly folds. */
export function condText(e: Expr, ctx: Ctx, past: boolean): string {
  const be = past ? "was" : "is";
  switch (e.k) {
    case "cmp": {
      if (e.l.k === "text" || e.r.k === "text") {
        const field = e.l.k === "text" ? e.l.field : (e.r as Extract<Expr, { k: "text" }>).field;
        const other = e.l.k === "text" ? e.r : e.l;
        const value = other.k === "str" ? other.value : numText(other, ctx);
        return `the ${field} ${be}${e.op === "!=" ? " not" : ""} ${value}`;
      }
      // count(c, Ny) op k  →  "in at least k of the last N financial years, c"
      if (e.l.k === "call" && e.l.fn === "count" && e.l.window && e.l.args[0] && literalNode(e.r)) {
        const k = printNumber(literalNode(e.r)?.value ?? 0);
        const inner = { ...ctx, inWindow: true };
        return `in ${countPhrase(e.op, k)} of the last ${years(e.l.window.n)}, ${condText(e.l.args[0], inner, true)}`;
      }
      if (e.l.k === "call" && e.l.fn === "streak" && e.l.args[0] && literalNode(e.r)) {
        const k = printNumber(literalNode(e.r)?.value ?? 0);
        const inner = { ...ctx, inWindow: true };
        return `${condText(e.l.args[0], inner, true)} in ${countPhrase(e.op, k)} consecutive financial years up to the latest`;
      }
      if (e.l.k === "call" && e.l.fn.endsWith("pctl") && e.l.args[0] && literalNode(e.r)) {
        const k = printNumber(literalNode(e.r)?.value ?? 0);
        return `${numText(e.l.args[0], { ...ctx, plain: true })} ${be} ${OP_WORD[e.op]} the ${ordinal(k)} percentile within ${scopeWord(e.l.fn)} ${IN_DATA}`;
      }
      const lu = unitOf(e.l, ctx.store);
      const ru = unitOf(e.r, ctx.store);
      const l = literalNode(e.l) ? literalText(e.l, ru, ctx) : numText(e.l, ctx);
      const r = literalNode(e.r) ? literalText(e.r, lu, ctx) : numText(e.r, ctx);
      return `${l} ${be} ${OP_WORD[e.op]} ${r}`;
    }
    case "between": {
      const u = unitOf(e.x, ctx.store);
      const lo = literalNode(e.lo) ? literalText(e.lo, u, ctx) : numText(e.lo, ctx);
      const hi = literalNode(e.hi) ? literalText(e.hi, u, ctx) : numText(e.hi, ctx);
      return `${numText(e.x, ctx)} ${be}${e.negated ? " not" : ""} between ${lo} and ${hi}`;
    }
    case "in": {
      const field = e.x.k === "text" ? `the ${e.x.field}` : numText(e.x, ctx);
      if (e.items.length === 1) return `${field} ${be}${e.negated ? " not" : ""} ${e.items[0]}`;
      return `${field} ${be} ${e.negated ? "none" : "one"} of ${joinOr(e.items)}`;
    }
    case "is": return TYPE_PHRASE[e.test][e.negated ? 1 : 0];
    case "not": {
      const a = e.arg;
      if (a.k === "is") return TYPE_PHRASE[a.test][a.negated ? 0 : 1];
      if (a.k === "call" && a.fn === "has" && a.args[0]) return `${numText(a.args[0], ctx)} ${be} not available`;
      return `it ${be} not the case that ${condText(a, ctx, past)}`;
    }
    case "and": return e.items.map((x) => condText(x, ctx, past)).join(" and ");
    case "or": {
      const parts = e.items.map((x) => condText(x, ctx, past));
      return parts.length === 2 ? `either ${parts[0]} or ${parts[1]}` : `at least one of these holds: ${parts.join("; ")}`;
    }
    case "call": {
      const inner = { ...ctx, inWindow: true };
      const n = e.window?.n ?? 0;
      if (!e.args[0]) return printExpr(e);
      if (e.fn === "has") return `${numText(e.args[0], ctx)} ${be} available`;
      if (e.fn === "every") return `${condText(e.args[0], inner, true)} in each of the last ${years(n)}`;
      if (e.fn === "any") return `${condText(e.args[0], inner, true)} in at least one of the last ${years(n)}`;
      return numText(e, ctx);
    }
    case "error": return "(an incomplete condition)";
    default: return numText(e, ctx);
  }
}

function ordinal(k: string): string {
  const n = Number(k);
  if (!Number.isInteger(n)) return k;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function makeCtx(store: MetricStore, source: string): Ctx {
  return { store, source, inWindow: false, plain: false };
}

/** One clause in plain English, capitalised ("ROCE was above 15% in each of the last 5 financial years"). */
export function clauseEnglish(e: Expr, store: MetricStore, source: string): string {
  return capFirst(condText(e, makeCtx(store, source), false));
}

export function exprEnglish(e: Expr, store: MetricStore, source: string): string {
  return numText(e, makeCtx(store, source));
}

function rankLeaves(e: Expr, out: Expr[]): boolean {
  if (e.k === "call" && e.fn === "rank") {
    out.push(e);
    return true;
  }
  if (e.k === "bin" && e.op === "+") return rankLeaves(e.l, out) && rankLeaves(e.r, out);
  return false;
}

export function sortEnglish(s: SortItem, store: MetricStore, source: string): string {
  const ctx = makeCtx(store, source);
  const leaves: Expr[] = [];
  if (rankLeaves(s.expr, leaves) && leaves.length > 1) {
    const names = leaves.map((x) => (x.k === "call" && x.args[0] ? numText(x.args[0], { ...ctx, plain: true }) : printExpr(x)));
    const parts = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return `the sum of their ranks on ${parts} among the matching companies (${s.dir === "asc" ? "lowest" : "highest"} sum first)`;
  }
  return `${numText(s.expr, ctx)} (${s.dir === "asc" ? "lowest" : "highest"} first)`;
}

/** The whole query in plain English, always ending with the missing-data note. */
export function queryEnglish(ast: QueryAst | null, clauses: readonly Expr[], store: MetricStore, source: string): string {
  const ctx = makeCtx(store, source);
  let text = clauses.length === 0
    ? "All companies in the selected universe"
    : `Companies where ${clauses.map((c) => lowerFirst(condText(c, ctx, false))).join(", and ")}`;
  if (ast && ast.sort.length > 0) {
    text += `, ordered by ${ast.sort.map((s) => sortEnglish(s, store, source)).join(", then by ")}`;
  }
  if (ast && ast.limit !== null) text += `, keeping the top ${ast.limit}`;
  return `${text}. ${END_NOTE}`;
}
