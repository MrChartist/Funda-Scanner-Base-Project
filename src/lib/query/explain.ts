// src/lib/query/explain.ts — "why it matched" for one clause and one company (§B.5 ClauseExplanation).
import type {
  ClauseExplanation, CmpOp, Expr, ExplainClause, MetricColumn, MetricStore, PeerScope, PeriodDetail, PeriodSel, Tri, TypeFamily,
} from "@/lib/contracts";
import { PEER_SCOPES, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN, VF } from "@/lib/contracts";
import { formatInrCrore, formatNumberIN } from "@/lib/format/indian";
import { formatUnitValue, nullReasonText } from "@/lib/format/metric-value";
import { literalNode, PEER_FNS, PEER_SCOPE_OF, walk } from "./ast";
import { capFirst, exprEnglish } from "./english";
import {
  CODE_NIC, decimalsOf, evaluateBoolNode, evaluateNumericNode, isPresent, literalDecimals, reasonOf,
} from "./evaluate";
import { printExpr, printNumber } from "./print";
import { unitOf, type UnitTag } from "./typecheck";

const OP_WORD: Readonly<Record<CmpOp, string>> = {
  ">": "above", ">=": "at least", "<": "below", "<=": "at most", "=": "equal to", "!=": "not equal to",
};

export const RESULT_WORD: Readonly<Record<Tri, string>> = { 0: "Fails", 1: "Passes", 2: "Not checked" };

const TYPE_LABEL: Readonly<Record<string, string>> = {
  non_financial: "Non-financial", other_financial: "Other financial (treated as non-financial)", bank: "Bank", nbfc: "NBFC",
  insurance: "Insurer",
};

function fmt(unit: UnitTag | null, decimals: number, v: number | null, flags = 0): string {
  if (v === null || !Number.isFinite(v)) return "—";
  if (unit === null || unit === "pctl") return formatNumberIN(v, Math.min(decimals, 2));
  return formatUnitValue(unit, decimals, v, flags);
}

function findRow(rows: Int32Array, i: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid] === i) return mid;
    if (rows[mid] < i) lo = mid + 1;
    else hi = mid - 1;
  }
  for (let k = 0; k < rows.length; k++) if (rows[k] === i) return k;
  return -1;
}

interface Side {
  value: number | null;
  flags: number;
  reasonCode: number;
  display: string;
  /** "ROCE 14.2% (FY26)" */
  text: string;
}

function windowYears(id: string): number {
  const m = /_(?:avg|min|stdev|cum)_(\d+)y$/.exec(id);
  if (m) return Number(m[1]);
  const c = /_cagr_(\d+)y$/.exec(id);
  return c ? Number(c[1]) + 1 : 0;
}

function periodText(e: Expr, store: MetricStore, i: number): string | null {
  if (e.k !== "ref") return null;
  const d = store.def(e.metric);
  if (!d) return null;
  const label = (sel: PeriodSel) => store.periodLabel(i, sel);
  const sel = e.selector;
  if (sel) {
    if (sel.kind === "prev") return label(d.history === "annual" ? { freq: "fy", offset: 1 } : { freq: "q", offset: 1 });
    return label({ freq: sel.kind, offset: sel.offset });
  }
  if (d.history === "annual") {
    const span = windowYears(d.id);
    if (span > 1) {
      const a = label({ freq: "fy", offset: span - 1 });
      const b = label({ freq: "fy", offset: 0 });
      return a && b ? `${a}–${b}` : b;
    }
    return label({ freq: "fy", offset: 0 });
  }
  if (d.history === "quarterly" || d.history === "shareholding") return d.history === "quarterly" ? label({ freq: "q", offset: 0 }) : null;
  return d.periodTag === "Latest" ? null : d.periodTag;
}

function side(e: Expr, col: MetricColumn, i: number, store: MetricStore, source: string, family: TypeFamily): Side {
  const present = isPresent(col, i);
  const value = present ? col.values[i] : null;
  const unit = unitOf(e, store);
  const d = e.k === "ref" ? store.def(e.metric) : undefined;
  const decimals = d ? d.decimals : decimalsOf(e, store, source);
  const display = present ? fmt(unit, decimals, value, col.flags[i]) : "—";
  let text: string;
  if (d) {
    const p = periodText(e, store, i);
    const shown = present ? display : `— (${nullReasonText(reasonOf(col.reasons[i]) ?? "missing_input", family).short})`;
    text = `${d.short} ${shown}${p ? ` (${p})` : ""}`;
  } else {
    text = `${printExpr(e)}: ${present ? display : "—"}`;
  }
  return { value, flags: present ? col.flags[i] : 0, reasonCode: present ? 0 : col.reasons[i], display, text };
}

function diffText(unit: UnitTag | null, decimals: number, diff: number): string {
  const d = Math.abs(diff);
  switch (unit) {
    case "pct":
    case "pp": return `${formatNumberIN(d, decimals)} ${d === 1 ? "point" : "points"}`;
    case "inr_cr": return formatInrCrore(d, decimals);
    case "x": return `${formatNumberIN(d, Math.max(decimals, 1))}x`;
    case null:
    case "pctl": return formatNumberIN(d, Math.min(Math.max(decimals, 1), 2));
    default: return formatUnitValue(unit, decimals, d);
  }
}

function gapFor(op: CmpOp, lhs: number, rhs: number, unit: UnitTag | null, decimals: number): { gap: number; text: string } {
  const denom = Math.max(Math.abs(rhs), 1e-9);
  switch (op) {
    case ">":
    case ">=":
      return { gap: (rhs - lhs) / denom, text: `${diffText(unit, decimals, rhs - lhs)} short` };
    case "<":
    case "<=":
      return { gap: (lhs - rhs) / denom, text: `${diffText(unit, decimals, lhs - rhs)} above the limit` };
    case "=":
      return { gap: Math.abs(lhs - rhs) / denom, text: `${diffText(unit, decimals, lhs - rhs)} away` };
    case "!=":
      return { gap: 0, text: "equal to the value it must differ from" };
  }
}

function peerInfo(e: Expr, store: MetricStore, source: string, i: number): ClauseExplanation["peer"] {
  let call: Extract<Expr, { k: "call" }> | null = null;
  walk(e, (x) => {
    if (!call && x.k === "call" && PEER_FNS.has(x.fn)) call = x;
    return call === null;
  });
  if (!call) return null;
  const c = call as Extract<Expr, { k: "call" }>;
  const scope = PEER_SCOPE_OF[c.fn] as PeerScope;
  const arg = c.args[0];
  try {
    if (arg && arg.k === "ref" && !arg.selector) {
      const ps = store.peerStat(arg.metric, i, scope);
      return { groupLabel: ps.groupLabel, scope: ps.scope, n: ps.n, median: ps.median };
    }
    const g = store.groups(scope);
    const col = evaluateNumericNode(arg, store, source);
    const xs: number[] = [];
    for (let j = 0; j < store.size; j++) if (g.groupOf[j] === g.groupOf[i] && isPresent(col, j)) xs.push(col.values[j]);
    xs.sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    const median = xs.length >= 3 ? (xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2) : null;
    return { groupLabel: g.labels[g.groupOf[i]] ?? "", scope: PEER_SCOPES[g.effectiveScope[i]] ?? scope, n: xs.length, median };
  } catch {
    return null;
  }
}

interface FoldInfo {
  call: Extract<Expr, { k: "call" }>;
  periods: PeriodDetail[];
  met: number;
  failed: PeriodDetail[];
  unknown: number;
}

function foldPeriods(call: Extract<Expr, { k: "call" }>, store: MetricStore, source: string, i: number): FoldInfo {
  const inner = call.args[0];
  const slots = store.slots(i, "fy");
  const N = call.window ? call.window.n : Math.max(1, Math.min(slots, 20));
  const periods: PeriodDetail[] = [];
  const lhsExpr = inner && inner.k === "cmp" && inner.l.k !== "text" ? inner.l : inner && inner.k === "between" ? inner.x : null;
  const unit = lhsExpr ? unitOf(lhsExpr, store) : null;
  const decimals = lhsExpr ? decimalsOf(lhsExpr, store, source) : 2;
  for (let k = 0; k < N; k++) {
    const b = evaluateBoolNode(inner, store, source, k);
    let value: number | null = null;
    if (lhsExpr) {
      const col = evaluateNumericNode(lhsExpr, store, source, k);
      value = isPresent(col, i) ? col.values[i] : null;
    }
    const label = store.periodLabel(i, { freq: "fy", offset: k }) ?? (k === 0 ? "Latest FY" : `${k} FY before latest`);
    periods.push({ label, value, display: fmt(unit, decimals, value), result: b.t[i] as Tri });
  }
  periods.reverse(); // oldest first
  const failed = periods.filter((p) => p.result === TRI_FALSE);
  return {
    call, periods, met: periods.filter((p) => p.result === TRI_TRUE).length, failed,
    unknown: periods.filter((p) => p.result === TRI_UNKNOWN).length,
  };
}

function rangeOf(periods: readonly PeriodDetail[]): string {
  if (periods.length === 0) return "";
  const a = periods[0].label;
  const b = periods[periods.length - 1].label;
  return a === b ? a : `${a}–${b}`;
}

function listFailed(failed: readonly PeriodDetail[]): string {
  return failed.slice(0, 3).map((p) => `${p.label}: ${p.display}`).join(", ") + (failed.length > 3 ? ", …" : "");
}

export const explainClause: ExplainClause = (query, evaluation, clauseIndex, i, store) => {
  const clause = query.clauses[clauseIndex];
  const family = store.family(i);
  const base: ClauseExplanation = {
    clause: clauseIndex, result: TRI_UNKNOWN, english: clause ? clause.english : "", detail: "", lhs: null, rhs: null,
    periods: null, peer: null, reason: null, gap: null, gapText: null,
  };
  if (!clause) return { ...base, detail: "This rule does not exist." };
  const source = query.source;
  const row = findRow(evaluation.rows, i);
  let result: Tri;
  let reasonCode: number;
  if (row >= 0 && clauseIndex < evaluation.clauseTri.length) {
    result = evaluation.clauseTri[clauseIndex][row] as Tri;
    reasonCode = evaluation.clauseReason[clauseIndex][row];
  } else if (!query.ok) {
    result = TRI_UNKNOWN;
    reasonCode = 0;
  } else {
    const b = evaluateBoolNode(clause.ast, store, source);
    result = b.t[i] as Tri;
    reasonCode = b.r[i];
  }
  const out: ClauseExplanation = { ...base, result, reason: result === TRI_UNKNOWN ? reasonOf(reasonCode) ?? (query.ok ? "missing_input" : null) : null };
  if (!query.ok) return { ...out, detail: "The query has an error, so this rule was not checked." };
  const e = clause.ast;
  out.peer = peerInfo(e, store, source, i);
  const unknownText = () => {
    const r = out.reason ?? "missing_input";
    return `not checked: ${nullReasonText(r, family).short}`;
  };

  // Yearly folds: every(), any(), and count()/streak() compared with a number.
  const foldCall = e.k === "call" && (e.fn === "every" || e.fn === "any") ? e
    : e.k === "cmp" && e.l.k === "call" && (e.l.fn === "count" || e.l.fn === "streak") ? e.l : null;
  if (foldCall) {
    const f = foldPeriods(foldCall, store, source, i);
    out.periods = f.periods;
    const n = f.periods.length;
    const range = rangeOf(f.periods);
    if (foldCall.fn === "every") {
      if (result === TRI_TRUE) out.detail = `Met in all ${n} years (${range})`;
      else if (result === TRI_FALSE) {
        out.detail = `Met in ${f.met} of ${n} years (${range}); ${listFailed(f.failed)}`;
        out.gapText = `failed in ${f.failed.length} of ${n} years (${listFailed(f.failed)})`;
        out.gap = f.failed.length / Math.max(n, 1);
      } else out.detail = `Met in ${f.met} of ${n} years (${range}); ${unknownText()}`;
    } else if (foldCall.fn === "any") {
      if (result === TRI_TRUE) out.detail = `Met in ${f.met} of ${n} years (${range})`;
      else if (result === TRI_FALSE) {
        out.detail = `Not met in any of the ${n} years (${range})`;
        out.gapText = `not met in any of the last ${n} years`;
        out.gap = 1;
      } else out.detail = `Not met in the years with data (${range}); ${unknownText()}`;
    } else if (e.k === "cmp") {
      const lhsCol = evaluateNumericNode(e.l, store, source);
      const rhsCol = evaluateNumericNode(e.r, store, source);
      const lhs = isPresent(lhsCol, i) ? lhsCol.values[i] : null;
      const rhs = isPresent(rhsCol, i) ? rhsCol.values[i] : null;
      out.lhs = lhs;
      out.rhs = rhs;
      const what = foldCall.fn === "count" ? "Met in" : "In a row:";
      const unitWord = (v: number) => (v === 1 ? "year" : "years");
      if (lhs === null) out.detail = `${capFirst(unknownText())}`;
      else out.detail = foldCall.fn === "count"
        ? `${what} ${printNumber(lhs)} of ${n} years (${range}); needs ${OP_WORD[e.op]} ${rhs === null ? "—" : printNumber(rhs)}`
        : `${what} ${printNumber(lhs)} ${unitWord(lhs)}${(lhsCol.flags[i] & VF.LimitOfData) !== 0 ? " (limit of data)" : ""}; needs ${OP_WORD[e.op]} ${rhs === null ? "—" : printNumber(rhs)}`;
      if (result === TRI_FALSE && lhs !== null && rhs !== null) {
        out.gap = gapFor(e.op, lhs, rhs, "count", 0).gap;
        // Year counts are whole numbers: "> 4" needs 5, "< 4" allows at most 3.
        const need = e.op === ">" ? rhs + 1 - lhs : e.op === ">=" ? rhs - lhs : e.op === "<" ? lhs - rhs + 1 : e.op === "<=" ? lhs - rhs : Math.abs(lhs - rhs);
        const years = `${printNumber(Math.max(need, 0))} ${unitWord(Math.max(need, 0))}`;
        out.gapText = e.op === ">" || e.op === ">=" ? `${years} short` : e.op === "<" || e.op === "<=" ? `${years} too many` : `${years} away`;
      }
    }
    return out;
  }

  if (e.k === "cmp" && e.l.k !== "text" && e.r.k !== "text") {
    const lCol = evaluateNumericNode(e.l, store, source);
    const rCol = evaluateNumericNode(e.r, store, source);
    const l = side(e.l, lCol, i, store, source, family);
    const r = side(e.r, rCol, i, store, source, family);
    out.lhs = l.value;
    out.rhs = r.value;
    const unit = unitOf(e.l, store) ?? unitOf(e.r, store);
    const lit = literalNode(e.r);
    const decimals = decimalsOf(e.l, store, source);
    let need: string;
    if (lit && r.value !== null) need = fmt(unit, Math.max(literalDecimals(e.r, source), 0), r.value);
    else if (out.peer && e.r.k === "call" && PEER_FNS.has(e.r.fn)) need = `${r.display} (${e.r.fn.endsWith("median") ? "median" : "percentile"} of ${out.peer.groupLabel})`;
    else need = r.text;
    if (l.reasonCode === CODE_NIC && e.l.k === "ref" && result !== TRI_UNKNOWN) {
      out.detail = `${store.def(e.l.metric)?.short ?? e.l.metric}: no interest cost, treated as ${result === TRI_TRUE ? "passing" : "failing"}; needs ${OP_WORD[e.op]} ${need}`;
      return out;
    }
    out.detail = `${l.text}; needs ${OP_WORD[e.op]} ${need}`;
    if (result === TRI_UNKNOWN) out.detail += `; ${unknownText()}`;
    if (result === TRI_FALSE && l.value !== null && r.value !== null) {
      const g = gapFor(e.op, l.value, r.value, unit, decimals);
      out.gap = g.gap;
      out.gapText = g.text;
    }
    return out;
  }

  if (e.k === "between") {
    const xCol = evaluateNumericNode(e.x, store, source);
    const loCol = evaluateNumericNode(e.lo, store, source);
    const hiCol = evaluateNumericNode(e.hi, store, source);
    const x = side(e.x, xCol, i, store, source, family);
    const lo = isPresent(loCol, i) ? loCol.values[i] : null;
    const hi = isPresent(hiCol, i) ? hiCol.values[i] : null;
    const unit = unitOf(e.x, store);
    const decimals = decimalsOf(e.x, store, source);
    out.lhs = x.value;
    out.rhs = x.value !== null && hi !== null && x.value > hi ? hi : lo;
    const loText = lo === null ? "—" : fmt(unit, literalDecimals(e.lo, source), lo);
    const hiText = hi === null ? "—" : fmt(unit, literalDecimals(e.hi, source), hi);
    out.detail = `${x.text}; needs ${e.negated ? "outside" : "between"} ${loText} and ${hiText}`;
    if (result === TRI_UNKNOWN) out.detail += `; ${unknownText()}`;
    if (result === TRI_FALSE && x.value !== null && lo !== null && hi !== null) {
      if (e.negated) {
        out.gap = 0;
        out.gapText = "inside the excluded range";
      } else if (x.value < lo) {
        out.gap = (lo - x.value) / Math.max(Math.abs(lo), 1e-9);
        out.gapText = `${diffText(unit, decimals, lo - x.value)} below the range`;
      } else {
        out.gap = (x.value - hi) / Math.max(Math.abs(hi), 1e-9);
        out.gapText = `${diffText(unit, decimals, x.value - hi)} above the range`;
      }
    }
    return out;
  }

  const describe = (x: Expr): string => {
    if (x.k === "is" || (x.k === "not" && x.arg.k === "is")) {
      const t = x.k === "is" ? x.test : (x.arg as Extract<Expr, { k: "is" }>).test;
      if (t === "consolidated" || t === "standalone") return `Statement basis: ${store.company(i).statement_basis}`;
      const ct = store.companyType(i);
      return `Company type: ${TYPE_LABEL[ct.type] ?? ct.type}${ct.inferred ? " (inferred from sector)" : ""}`;
    }
    if ((x.k === "cmp" && (x.l.k === "text" || x.r.k === "text")) || (x.k === "in" && x.x.k === "text")) {
      const field = x.k === "in" ? (x.x as Extract<Expr, { k: "text" }>).field : x.l.k === "text" ? x.l.field : (x.r as Extract<Expr, { k: "text" }>).field;
      const v = field === "sector" ? store.sector(i) : field === "industry" ? store.industry(i) : field === "symbol" ? store.symbols[i] : store.company(i).name;
      return `${capFirst(field)}: ${v}`;
    }
    if (x.k === "cmp") {
      const col = evaluateNumericNode(x.l, store, source);
      return side(x.l, col, i, store, source, family).text;
    }
    if (x.k === "call" && x.fn === "has") {
      const col = evaluateNumericNode(x.args[0], store, source);
      return side(x.args[0], col, i, store, source, family).text;
    }
    return capFirst(exprEnglish(x, store, source));
  };

  if (e.k === "or" || e.k === "and") {
    out.detail = e.items.map((x) => {
      const b = evaluateBoolNode(x, store, source);
      return `${describe(x)}: ${RESULT_WORD[b.t[i] as Tri].toLowerCase()}`;
    }).join("; ");
    return out;
  }
  out.detail = describe(e);
  if (result === TRI_UNKNOWN) out.detail += `; ${unknownText()}`;
  return out;
};
