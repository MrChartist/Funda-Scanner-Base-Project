// src/lib/insights/run.ts — evaluates the §C.9 rules for one company (evaluateChecks).
// Each rule is compiled once per store with the real FSQL engine and evaluated for every company in
// one pass; both are cached for the store's lifetime. A rule's result for company i is then a
// lookup. Messages are filled from explainClause, so they always quote the threshold and the
// values that were compared. Deterministic: no clock, no randomness.
import type {
  CheckOutcome, CheckResult, CheckRule, CompiledQuery, Evidence, EvaluateChecks, Expr, MetricDef, MetricId,
  MetricStore, NullReason, QueryEvaluation, Tri, TypeFamily,
} from "@/lib/contracts";
import { NULL_REASONS, TRI_FALSE, TRI_TRUE, TRI_UNKNOWN } from "@/lib/contracts";
import { formatMetric, formatUnitValue, nullReasonText } from "@/lib/format/metric-value";
import { compileQuery, evaluateNumericNode, evaluateQuery, explainClause, printExpr } from "@/lib/query";
import { quarterLabel } from "@/lib/time/civil";
import { CHECK_RULES } from "./checks";

// ── Compilation and evaluation cache ─────────────────────────────────────────

interface Compiled {
  compiled: CompiledQuery;
  /** Evaluated over every company (rows 0 … size − 1), so row index = store index. Null when the rule has errors. */
  evaluation: QueryEvaluation | null;
}

interface RulePlan extends Compiled {
  rule: CheckRule;
  /** Per top-level OR clause, each alternative compiled on its own (for messages with thresholds). */
  alternatives: Map<number, Compiled[]>;
}

const plans = new WeakMap<MetricStore, Map<string, RulePlan>>();

function allRows(store: MetricStore): Int32Array {
  return Int32Array.from({ length: store.size }, (_, i) => i);
}

function compileAndEvaluate(source: string, store: MetricStore): Compiled {
  const compiled = compileQuery(source, store);
  return { compiled, evaluation: compiled.ok ? evaluateQuery(compiled, store, allRows(store)) : null };
}

/** The compiled and evaluated rule for a store (cached per store and rule id). */
export function rulePlan(store: MetricStore, rule: CheckRule): RulePlan {
  let byRule = plans.get(store);
  if (!byRule) {
    byRule = new Map();
    plans.set(store, byRule);
  }
  let plan = byRule.get(rule.id);
  if (!plan || plan.rule !== rule) {
    plan = { rule, ...compileAndEvaluate(rule.query, store), alternatives: new Map() };
    byRule.set(rule.id, plan);
  }
  return plan;
}

// ── Results ───────────────────────────────────────────────────────────────────

export function appliesToFamily(rule: CheckRule, family: TypeFamily): boolean {
  return rule.appliesTo.includes(family);
}

function reasonFromCode(code: number): NullReason | null {
  const r = NULL_REASONS[code];
  return r && r !== "none" ? r : null;
}

/** Result of one rule for one company, with the reason when it could not be evaluated. */
export function ruleResult(store: MetricStore, rule: CheckRule, i: number): { result: CheckResult; reason: NullReason | null } {
  if (!appliesToFamily(rule, store.family(i))) return { result: "not_applicable", reason: null };
  const plan = rulePlan(store, rule);
  if (!plan.evaluation) return { result: "not_evaluated", reason: "missing_input" };
  const ev = plan.evaluation;
  const tri = ev.whereTri[i] as Tri;
  if (tri === TRI_TRUE) return { result: "met", reason: null };
  if (tri === TRI_FALSE) return { result: "not_met", reason: null };
  for (let c = 0; c < ev.clauseTri.length; c++) {
    if (ev.clauseTri[c][i] !== TRI_UNKNOWN) continue;
    const r = reasonFromCode(ev.clauseReason[c][i]);
    if (r) return { result: "not_evaluated", reason: r };
  }
  return { result: "not_evaluated", reason: "missing_input" };
}

// ── Messages ──────────────────────────────────────────────────────────────────

function capFirst(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function endSentence(s: string): string {
  const t = s.trim();
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

const FAMILY_PLURAL: Readonly<Record<TypeFamily, string>> = {
  non_financial: "non-financial companies",
  lender: "lenders (banks, NBFCs and housing finance companies)",
  insurance: "insurers",
};

const FAMILY_SINGULAR: Readonly<Record<TypeFamily, string>> = {
  non_financial: "a non-financial company",
  lender: "a lender",
  insurance: "an insurer",
};

function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function notApplicableMessage(rule: CheckRule, family: TypeFamily): string {
  const what = rule.kind === "check" ? "check" : "red flag";
  return `Not applicable: this ${what} is designed for ${listText(rule.appliesTo.map((f) => FAMILY_PLURAL[f]))}, and this company is ${FAMILY_SINGULAR[family]}.`;
}

/** First metric referenced by an expression (for the unit of a computed side). */
function firstRef(e: Expr): Extract<Expr, { k: "ref" }> | null {
  switch (e.k) {
    case "ref": return e;
    case "neg": return firstRef(e.arg);
    case "bin": return firstRef(e.l) ?? firstRef(e.r);
    case "call": {
      for (const a of e.args) {
        const r = firstRef(a);
        if (r) return r;
      }
      return null;
    }
    default: return null;
  }
}

function isLiteral(e: Expr): boolean {
  return e.k === "num" || (e.k === "neg" && e.arg.k === "num");
}

function sideName(e: Expr, store: MetricStore): string {
  if (e.k === "ref" && !e.selector) return store.def(e.metric)?.short ?? e.metric;
  if (e.k === "call" && e.fn === "abs" && e.args[0]?.k === "ref" && !e.args[0].selector) {
    return `${store.def(e.args[0].metric)?.short ?? e.args[0].metric} (absolute value)`;
  }
  return printExpr(e);
}

function reasonShort(reason: NullReason | null, family: TypeFamily): string {
  return nullReasonText(reason ?? "missing_input", family).short;
}

/** Year-by-year text for every()/any()/count() clauses: "ROCE by year: FY22 11.3%, …; met in 4 of 5 years". */
function foldBody(plan: RulePlan, clauseIndex: number, i: number, store: MetricStore): string {
  const clause = plan.compiled.clauses[clauseIndex];
  const ev = plan.evaluation as QueryEvaluation;
  const ex = explainClause(plan.compiled, ev, clauseIndex, i, store);
  const periods = ex.periods ?? [];
  const e = clause.ast;
  const call = e.k === "call" ? e : e.k === "cmp" && e.l.k === "call" ? e.l : null;
  const inner = call ? call.args[0] : undefined;
  const family = store.family(i);
  let yearly: string;
  if (inner && inner.k === "cmp" && !isLiteral(inner.r) && inner.l.k !== "text" && inner.r.k !== "text") {
    // The limit changes every year (e.g. 0.2 × |PBT|): show both sides per year.
    const ref = firstRef(inner.l) ?? firstRef(inner.r);
    const def: MetricDef | undefined = ref ? store.def(ref.metric) : undefined;
    const n = periods.length;
    yearly = periods.map((p, j) => {
      const k = n - 1 - j; // periods are oldest first; offsets count back from the latest year
      const col = evaluateNumericNode(inner.r, store, plan.compiled.source, k);
      const v = col.reasons[i] === 0 && Number.isFinite(col.values[i]) ? col.values[i] : null;
      const rhs = v === null || !def ? "—" : formatUnitValue(def.unit, def.decimals, v);
      return `${p.label} ${p.display} against ${rhs}`;
    }).join(", ");
    yearly = `${sideName(inner.l, store)} against ${sideName(inner.r, store)}, by year: ${yearly}`;
  } else {
    const name = inner && inner.k === "cmp" && inner.l.k !== "text" ? sideName(inner.l, store)
      : inner && inner.k === "between" ? sideName(inner.x, store) : "Value";
    yearly = `${name} by year: ${periods.map((p) => `${p.label} ${p.display}`).join(", ")}`;
  }
  const met = periods.filter((p) => p.result === TRI_TRUE).length;
  let body = `${capFirst(clause.english)}. ${yearly}; met in ${met} of ${periods.length} ${periods.length === 1 ? "year" : "years"}`;
  if (ex.result === TRI_UNKNOWN) body += `; not checked: ${reasonShort(ex.reason, family)}`;
  return body;
}

function alternativesFor(plan: RulePlan, clauseIndex: number, store: MetricStore): Compiled[] {
  let alts = plan.alternatives.get(clauseIndex);
  if (!alts) {
    const e = plan.compiled.clauses[clauseIndex].ast;
    alts = e.k === "or" ? e.items.map((x) => compileAndEvaluate(printExpr(x), store)) : [];
    plan.alternatives.set(clauseIndex, alts);
  }
  return alts;
}

/** "Either: Pledge 31.0%; needs above 25%; or Pledge · change 1Y +6.0 pp; needs above +5 pp". */
function orBody(plan: RulePlan, clauseIndex: number, i: number, store: MetricStore): string {
  const parts = alternativesFor(plan, clauseIndex, store).map((alt) => {
    if (!alt.evaluation || alt.compiled.clauses.length === 0) return alt.compiled.source;
    return alt.compiled.clauses.map((_, c) => explainClause(alt.compiled, alt.evaluation as QueryEvaluation, c, i, store).detail).join("; ");
  });
  return `Either: ${parts.map((p, k) => (k === 0 ? p : `or ${p}`)).join("; ")}`;
}

function refsOf(e: Expr, out: Extract<Expr, { k: "ref" }>[] = []): Extract<Expr, { k: "ref" }>[] {
  switch (e.k) {
    case "ref": out.push(e); break;
    case "neg": case "not": refsOf(e.arg, out); break;
    case "bin": case "cmp": refsOf(e.l, out); refsOf(e.r, out); break;
    case "between": refsOf(e.x, out); refsOf(e.lo, out); refsOf(e.hi, out); break;
    case "call": for (const a of e.args) refsOf(a, out); break;
    case "and": case "or": for (const x of e.items) refsOf(x, out); break;
    default: break;
  }
  return out;
}

function refPeriod(ref: Extract<Expr, { k: "ref" }>, def: MetricDef, store: MetricStore, i: number): string | null {
  const sel = ref.selector;
  if (!sel) return evidencePeriod(def, store, i);
  if (sel.kind === "prev") return store.periodLabel(i, def.history === "annual" ? { freq: "fy", offset: 1 } : { freq: "q", offset: 1 });
  return store.periodLabel(i, { freq: sel.kind, offset: sel.offset });
}

/** "GNPA 2.48% (FY26) and GNPA 2.50% (FY25)": the metric values a computed comparison was built from. */
function inputsText(refs: readonly Extract<Expr, { k: "ref" }>[], plan: RulePlan, i: number, store: MetricStore): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const family = store.family(i);
  for (const ref of refs) {
    const key = printExpr(ref);
    const def = store.def(ref.metric);
    if (seen.has(key) || !def) continue;
    seen.add(key);
    const col = evaluateNumericNode(ref, store, plan.compiled.source);
    const present = col.reasons[i] === 0 && Number.isFinite(col.values[i]);
    const display = present ? formatUnitValue(def.unit, def.decimals, col.values[i], col.flags[i])
      : `— (${nullReasonText(reasonFromCode(col.reasons[i]) ?? "missing_input", family).short})`;
    const period = refPeriod(ref, def, store, i);
    parts.push(`${def.short} ${display}${period ? ` (${period})` : ""}`);
  }
  return listText(parts);
}

const PEER_FN = /^(?:pctl|sector_pctl|industry_pctl|sector_median|industry_median)$/;

function clauseBody(plan: RulePlan, clauseIndex: number, i: number, store: MetricStore): string {
  const ev = plan.evaluation as QueryEvaluation;
  const clause = plan.compiled.clauses[clauseIndex];
  const ex = explainClause(plan.compiled, ev, clauseIndex, i, store);
  if (ex.periods) return foldBody(plan, clauseIndex, i, store);
  const e = clause.ast;
  if (e.k === "or") return orBody(plan, clauseIndex, i, store);
  if (e.k !== "cmp" || e.l.k === "text" || e.r.k === "text") return capFirst(ex.detail);
  const lhsIsRef = e.l.k === "ref";
  const rhsIsPeer = e.r.k === "call" && PEER_FN.test(e.r.fn);
  if (lhsIsRef && (isLiteral(e.r) || rhsIsPeer)) return capFirst(ex.detail);
  // A computed comparison: say what was compared and list the inputs behind it.
  const lhsRef = lhsIsRef ? (e.l as Extract<Expr, { k: "ref" }>) : null;
  const refs = refsOf(e).filter((r) => !lhsRef || printExpr(r) !== printExpr(lhsRef));
  const inputs = inputsText(refs, plan, i, store);
  let body: string;
  if (lhsRef) {
    body = capFirst(ex.detail);
  } else {
    const ref = firstRef(e.l);
    const def = ref ? store.def(ref.metric) : undefined;
    const value = ex.lhs === null ? "—" : def ? formatUnitValue(def.unit, def.decimals, ex.lhs) : printExpr(e.l);
    body = `${capFirst(clause.english)}; actual ${value}`;
    if (ex.result === TRI_UNKNOWN) body += `; not checked: ${reasonShort(ex.reason, store.family(i))}`;
  }
  return inputs ? `${body}. Based on ${inputs}` : body;
}

/** The filled message for an applicable rule: every clause with its values and thresholds. */
export function ruleMessage(store: MetricStore, rule: CheckRule, i: number): string {
  const family = store.family(i);
  if (!appliesToFamily(rule, family)) return notApplicableMessage(rule, family);
  const plan = rulePlan(store, rule);
  if (!plan.evaluation) return `Not evaluated: the rule "${rule.query}" could not be compiled on this data.`;
  const bodies = plan.compiled.clauses.map((_, c) => endSentence(clauseBody(plan, c, i, store)));
  return bodies.join(" ");
}

// ── Evidence ──────────────────────────────────────────────────────────────────

const WINDOW_VARIANT = /^(?:avg|min|stdev|cum)_(\d+)y$/;
const CAGR_VARIANT = /^cagr_(\d+)y$/;

function annualSpan(def: MetricDef): number {
  if (def.variant) {
    const w = WINDOW_VARIANT.exec(def.variant);
    if (w) return Number(w[1]);
    const c = CAGR_VARIANT.exec(def.variant);
    if (c) return Number(c[1]) + 1;
    if (def.variant === "chg_1y") return 2;
    if (def.variant === "chg_3y") return 4;
    return 1;
  }
  const tag = /^(\d+)Y$/.exec(def.periodTag);
  return tag ? Number(tag[1]) : 1;
}

function latestShareholdingLabel(store: MetricStore, i: number): string | null {
  const c = store.company(i);
  let latest: string | null = null;
  for (const row of c.shareholding) if (latest === null || row.period_end > latest) latest = row.period_end;
  return latest === null ? null : quarterLabel(latest, c.fy_end_month);
}

/** Period text shown next to an evidence value: "FY26", "FY22–FY26", "TTM to Jun 2026", "Q1 FY27". */
export function evidencePeriod(def: MetricDef, store: MetricStore, i: number): string | null {
  const fy = (offset: number) => store.periodLabel(i, { freq: "fy", offset });
  switch (def.history) {
    case "annual": {
      if (def.variant === "prev") return fy(1);
      if (def.variant === "ttm") return store.periodLabel(i, { freq: "ttm", offset: 0 }) ?? fy(0);
      const span = annualSpan(def);
      if (span > 1) {
        const a = fy(span - 1);
        const b = fy(0);
        return a && b ? `${a}–${b}` : b;
      }
      return fy(0);
    }
    case "quarterly":
      return def.variant === "prev" ? store.periodLabel(i, { freq: "q", offset: 1 }) : store.periodLabel(i, { freq: "q", offset: 0 });
    case "shareholding": {
      const label = latestShareholdingLabel(store, i);
      if (!label) return null;
      return def.variant && def.variant.startsWith("chg_") ? `${def.periodTag} to ${label}` : label;
    }
    case "latest_only":
      if (def.periodTag === "TTM") return store.periodLabel(i, { freq: "ttm", offset: 0 }) ?? fy(0);
      return def.periodTag === "Latest" ? null : def.periodTag;
  }
}

export function evidenceFor(store: MetricStore, id: MetricId, i: number): Evidence | null {
  const def = store.def(id);
  if (!def) return null;
  const value = store.get(id, i);
  const display = value.v === null ? reasonShort(value.reason, store.family(i)) : formatMetric(def, value);
  return { metric: id, label: def.short, value, display, period: evidencePeriod(def, store, i) };
}

// ── evaluateChecks ────────────────────────────────────────────────────────────

export function outcomeFor(store: MetricStore, rule: CheckRule, i: number): CheckOutcome {
  const { result, reason } = ruleResult(store, rule, i);
  const evidence = result === "not_applicable" ? []
    : rule.evidence.map((id) => evidenceFor(store, id, i)).filter((x): x is Evidence => x !== null);
  return {
    ruleId: rule.id,
    kind: rule.kind,
    area: rule.area,
    result,
    title: rule.title,
    test: rule.test,
    query: rule.query,
    message: ruleMessage(store, rule, i),
    evidence,
    reason,
    section: rule.section,
    learn: rule.learn,
  };
}

/** Every check and red flag for company i, in CHECK_RULES order (empty for an unknown index). */
export const evaluateChecks: EvaluateChecks = (store, i) => {
  if (!Number.isInteger(i) || i < 0 || i >= store.size) return [];
  return CHECK_RULES.map((rule) => outcomeFor(store, rule, i));
};
