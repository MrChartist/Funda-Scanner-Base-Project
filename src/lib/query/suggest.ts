// src/lib/query/suggest.ts — autocomplete (P1): metrics, functions, keywords, selectors, periods
// and company types, chosen by the text before the cursor.
import type { CompletionItem, CompletionList, FnName, MetricDef, MetricStore, SuggestAt, Unit } from "@/lib/contracts";
import { FUNCTION_NAMES, TYPE_TESTS, YEARLY_FNS } from "./ast";
import { lex, type Token } from "./lexer";

const MAX_ITEMS = 30;
const COVERAGE_ITEMS = 12;

const UNIT_LABEL: Readonly<Record<Unit, string>> = {
  inr_cr: "₹ Cr", inr: "₹", pct: "%", pp: "pp", x: "x", days: "days", years: "years", count: "count", score: "score",
  crore_shares: "Cr shares", fy_year: "FY",
};

export const FUNCTION_DOCS: Readonly<Record<FnName, { label: string; detail: string }>> = {
  avg: { label: "avg(x, Ny)", detail: "Average over the last N financial years" },
  median: { label: "median(x, Ny)", detail: "Median over the last N financial years" },
  min: { label: "min(x, Ny) or min(a, b)", detail: "Lowest value over N years, or the smaller of two values" },
  max: { label: "max(x, Ny) or max(a, b)", detail: "Highest value over N years, or the larger of two values" },
  sum: { label: "sum(x, Ny)", detail: "Total over the last N financial years" },
  stdev: { label: "stdev(x, Ny)", detail: "Standard deviation over the last N financial years" },
  cagr: { label: "cagr(x, Ny)", detail: "Compound annual growth over N years (amounts and per-share values)" },
  every: { label: "every(condition, Ny)", detail: "True when the condition held in each of the last N years" },
  any: { label: "any(condition, Ny)", detail: "True when the condition held in at least one of the last N years" },
  count: { label: "count(condition, Ny)", detail: "Number of the last N years in which the condition held" },
  streak: { label: "streak(condition)", detail: "Consecutive years, up to the latest, in which the condition held" },
  growth: { label: "growth(a, b)", detail: "Percentage growth from b to a" },
  abs: { label: "abs(x)", detail: "Absolute value" },
  has: { label: "has(x)", detail: "True when the value is available" },
  pctl: { label: "pctl(x)", detail: "Percentile within the peer class, among companies in your data" },
  sector_pctl: { label: "sector_pctl(x)", detail: "Percentile within the sector, among companies in your data" },
  industry_pctl: { label: "industry_pctl(x)", detail: "Percentile within the industry, among companies in your data" },
  sector_median: { label: "sector_median(x)", detail: "Median of the sector, among companies in your data" },
  industry_median: { label: "industry_median(x)", detail: "Median of the industry, among companies in your data" },
  rank: { label: "rank(x)", detail: "Rank among the matching companies; only after SORT BY" },
};

const KEYWORDS: readonly { label: string; doc: string }[] = [
  { label: "AND", doc: "Both conditions must hold" },
  { label: "OR", doc: "Either condition may hold" },
  { label: "NOT", doc: "The condition must not hold" },
  { label: "BETWEEN", doc: "A range, for example roe BETWEEN 15 AND 25" },
  { label: "IN", doc: "One of a list of text values, for example sector IN (\"Cement\")" },
  { label: "IS", doc: "A company type test, for example IS lender" },
  { label: "SORT BY", doc: "Order the matches, for example SORT BY roce DESC" },
  { label: "LIMIT", doc: "Keep only the first N matches" },
  { label: "ASC", doc: "Lowest first" },
  { label: "DESC", doc: "Highest first" },
];

const COMPARISONS = [">", ">=", "<", "<=", "=", "!="];

const SELECTORS: readonly { insert: string; doc: string }[] = [
  { insert: "fy", doc: "Latest financial year" },
  { insert: "fy-1", doc: "One financial year before the latest" },
  { insert: "prev", doc: "One period before, in the metric's own frequency" },
  { insert: "ttm", doc: "Trailing twelve months" },
  { insert: "ttm-1", doc: "The twelve months before that" },
  { insert: "q", doc: "Latest quarter" },
  { insert: "q-1", doc: "One quarter before the latest" },
  { insert: "q-4", doc: "The same quarter a year earlier" },
];

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9_]/.test(c);
}

function canEndOperand(t: Token | undefined): boolean {
  if (!t) return false;
  if (t.kind === "ident") return !["and", "or", "not", "between", "is", "in", "by", "sort", "limit", "where"].includes(t.word);
  return t.kind === "num" || t.kind === "str" || t.kind === "backtick" || t.kind === "dur"
    || (t.kind === "op" && (t.text === ")" || t.text === "]"));
}

function metricScore(d: MetricDef, prefix: string): number | null {
  if (!prefix) return d.variant === null && d.level === "basic" ? 0 : d.variant === null ? 1 : 2;
  const id = d.id;
  const short = d.short.toLowerCase();
  const label = d.label.toLowerCase();
  if (id.startsWith(prefix)) return 0;
  if (short.startsWith(prefix) || label.startsWith(prefix)) return 1;
  if (d.aliases.some((a) => a.startsWith(prefix))) return 2;
  if (id.includes(prefix)) return 3;
  if (label.includes(prefix) || short.includes(prefix)) return 4;
  return null;
}

function metricItems(store: MetricStore, prefix: string): CompletionItem[] {
  const scored: { d: MetricDef; s: number }[] = [];
  for (const d of store.defs()) {
    const s = metricScore(d, prefix);
    if (s !== null) scored.push({ d, s });
  }
  scored.sort((a, b) => a.s - b.s
    || (a.d.variant === null ? 0 : 1) - (b.d.variant === null ? 0 : 1)
    || (a.d.level === "basic" ? 0 : 1) - (b.d.level === "basic" ? 0 : 1)
    || a.d.id.length - b.d.id.length
    || (a.d.id < b.d.id ? -1 : 1));
  return scored.slice(0, MAX_ITEMS).map(({ d }, k) => {
    let detail = `${UNIT_LABEL[d.unit]} · ${d.category}`;
    if (k < COVERAGE_ITEMS) {
      try {
        const cov = store.coverage(d.id);
        if (cov.applicable > 0) detail += ` · ${Math.round((100 * cov.nonNull) / cov.applicable)}% of companies have data`;
      } catch {
        /* coverage is optional */
      }
    }
    return { kind: "metric", label: d.short, insert: d.id, detail, doc: d.tooltip || null };
  });
}

function functionItems(prefix: string): CompletionItem[] {
  return FUNCTION_NAMES.filter((f) => f.startsWith(prefix)).map((f) => ({
    kind: "function", label: FUNCTION_DOCS[f].label, insert: `${f}(`, detail: FUNCTION_DOCS[f].detail, doc: null,
  }));
}

function keywordItems(prefix: string, words: readonly string[] | null = null): CompletionItem[] {
  return KEYWORDS.filter((k) => (!words || words.includes(k.label)) && k.label.toLowerCase().startsWith(prefix))
    .map((k) => ({ kind: "keyword", label: k.label, insert: k.label, detail: k.doc, doc: null }));
}

export const suggestAt: SuggestAt = (source, cursorArg, store): CompletionList => {
  const cursor = Math.max(0, Math.min(source.length, Math.floor(cursorArg)));
  let start = cursor;
  while (start > 0 && isWordChar(source[start - 1])) start--;
  let end = cursor;
  while (end < source.length && isWordChar(source[end])) end++;
  const span = { start, end };
  const prefix = source.slice(start, cursor).toLowerCase();
  const toks = lex(source.slice(0, start)).tokens.filter((t) => t.kind !== "eof");
  const last = toks[toks.length - 1];

  // Inside a selector: [fy-1], [prev], …
  if (last && last.kind === "op" && last.text === "[") {
    return {
      span,
      items: SELECTORS.filter((s) => s.insert.startsWith(prefix))
        .map((s) => ({ kind: "selector", label: `[${s.insert}]`, insert: s.insert, detail: s.doc, doc: null })),
    };
  }
  // After IS or IS NOT: company types.
  const isCtx = last && last.kind === "ident" && (last.word === "is" || (last.word === "not" && toks[toks.length - 2]?.word === "is"));
  if (isCtx) {
    return {
      span,
      items: TYPE_TESTS.filter((t) => t.startsWith(prefix))
        .map((t) => ({ kind: "type_test", label: t, insert: t, detail: "Company type", doc: null })),
    };
  }
  // Second input of a window function: a period.
  const stack: (string | null)[] = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.kind === "op" && t.text === "(") stack.push(toks[k - 1]?.kind === "ident" ? toks[k - 1].word : null);
    else if (t.kind === "op" && t.text === ")") stack.pop();
  }
  const open = stack[stack.length - 1];
  const items: CompletionItem[] = [];
  if (last && last.kind === "op" && last.text === "," && open && YEARLY_FNS.has(open as FnName)) {
    for (const n of [3, 5, 10]) {
      const w = `${n}y`;
      if (w.startsWith(prefix)) items.push({ kind: "window", label: w, insert: w, detail: `Last ${n} financial years`, doc: null });
    }
  }
  if (open === "rank" && last && last.kind === "op" && last.text === ",") items.push(...keywordItems(prefix, ["ASC", "DESC"]));
  // After a complete operand: comparisons and keywords (and metrics, for a phrase still being typed).
  if (canEndOperand(last)) {
    if (prefix === "") {
      for (const op of COMPARISONS) items.push({ kind: "keyword", label: op, insert: op, detail: "Comparison", doc: null });
      items.push(...keywordItems("", ["AND", "OR", "NOT", "BETWEEN", "IN", "SORT BY", "LIMIT", "ASC", "DESC"]));
      return { span, items };
    }
    items.push(...keywordItems(prefix, ["AND", "OR", "NOT", "BETWEEN", "IN", "SORT BY", "LIMIT", "ASC", "DESC"]));
    items.push(...metricItems(store, prefix).slice(0, MAX_ITEMS - items.length));
    return { span, items };
  }
  items.push(...metricItems(store, prefix));
  items.push(...functionItems(prefix));
  items.push(...keywordItems(prefix, ["NOT", "IS"]));
  return { span, items: items.slice(0, MAX_ITEMS + 10) };
};
