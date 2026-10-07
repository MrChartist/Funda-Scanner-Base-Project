// src/lib/contracts/query.ts — FSQL (Funda Scanner Query Language) v1
import type { MetricColumn, MetricId, MetricStore, NullReason, PeerScope } from "./metrics";

/** Character offsets into the source text, end exclusive. */
export interface Span {
  start: number;
  end: number;
}

export type CmpOp = ">" | ">=" | "<" | "<=" | "=" | "!=";
export type ArithOp = "+" | "-" | "*" | "/";
/** Attached number suffixes. k ×1,000; lakh ×1,00,000; %, x and cr are cosmetic (unit-checked). */
export type NumSuffix = "%" | "x" | "cr" | "k" | "lakh";

export type Selector =
  | { kind: "fy"; offset: number }    // [fy], [fy-3]
  | { kind: "ttm"; offset: number }   // [ttm], [ttm-1]
  | { kind: "q"; offset: number }     // [q], [q-4]  (quarterly and shareholding metrics)
  | { kind: "prev" };                 // [prev]: one period before, in the reference's own frequency/context

export interface Window {
  n: number;
  unit: "y";                          // "q" windows are reserved for R1 (E_QUARTER_WINDOW)
}

export type FnName =
  // scalar
  | "abs" | "min" | "max" | "growth" | "has"
  // window (second argument is a Window)
  | "avg" | "median" | "sum" | "stdev" | "cagr" | "every" | "any" | "count" | "streak"
  // peer (computed over the whole loaded dataset within the company's peer class)
  | "pctl" | "sector_pctl" | "industry_pctl" | "sector_median" | "industry_median"
  // rank among the MATCHING companies; allowed only in SORT BY
  | "rank";

export type TypeTest =
  | "bank" | "nbfc" | "insurer" | "lender" | "financial" | "non_financial" | "consolidated" | "standalone";

export type TextField = "sector" | "industry" | "symbol" | "name";

export type Expr =
  | { k: "num"; value: number; suffix: NumSuffix | null; span: Span }
  | { k: "str"; value: string; span: Span }
  | { k: "ref"; metric: MetricId; written: string; selector: Selector | null; span: Span }
  | { k: "text"; field: TextField; span: Span }
  | { k: "call"; fn: FnName; args: Expr[]; window: Window | null; order: "asc" | "desc" | null; span: Span }
  | { k: "neg"; arg: Expr; span: Span }
  | { k: "bin"; op: ArithOp; l: Expr; r: Expr; span: Span }
  | { k: "cmp"; op: CmpOp; l: Expr; r: Expr; span: Span }
  | { k: "between"; x: Expr; lo: Expr; hi: Expr; negated: boolean; span: Span }
  | { k: "in"; x: Expr; items: string[]; negated: boolean; span: Span }
  | { k: "and"; items: Expr[]; implicit: boolean[]; span: Span }
  | { k: "or"; items: Expr[]; span: Span }
  | { k: "not"; arg: Expr; span: Span }
  | { k: "is"; test: TypeTest; negated: boolean; span: Span }
  | { k: "error"; span: Span };

export interface SortItem {
  expr: Expr;
  dir: "asc" | "desc";
  span: Span;
}

export interface QueryAst {
  where: Expr | null;
  sort: SortItem[];
  limit: number | null;
  span: Span;
}

export type IssueCode =
  // lexical / syntax
  | "E_EMPTY_QUERY" | "E_UNEXPECTED_CHAR" | "E_UNEXPECTED_TOKEN" | "E_UNEXPECTED_END" | "E_UNBALANCED_PAREN"
  | "E_UNTERMINATED_STRING" | "E_BAD_NUMBER" | "E_COMMA_IN_NUMBER" | "E_UNKNOWN_SUFFIX" | "E_CHAINED_COMPARISON"
  | "E_RESERVED_WORD" | "E_TOO_COMPLEX"
  // names
  | "E_UNKNOWN_METRIC" | "E_AMBIGUOUS_METRIC" | "E_AMBIGUOUS_PERIOD_WORD" | "E_UNKNOWN_FUNCTION"
  // types and periods
  | "E_WRONG_ARG_COUNT" | "E_TYPE_BOOL_EXPECTED" | "E_TYPE_NUMBER_EXPECTED" | "E_TEXT_COMPARISON"
  | "E_UNIT_MISMATCH" | "E_WINDOW_REQUIRED" | "E_WINDOW_RANGE" | "E_QUARTER_WINDOW" | "E_NO_HISTORY"
  | "E_BAD_SELECTOR" | "E_SELECTOR_IN_WINDOW" | "E_PEER_IN_WINDOW" | "E_RANK_OUTSIDE_SORT" | "E_LIMIT_RANGE"
  | "E_NOT_GROWTHABLE"
  // warnings
  | "W_LIKELY_FRACTION" | "W_MIXED_UNITS" | "W_NOT_APPLICABLE_SOME" | "W_LOW_COVERAGE" | "W_NO_COVERAGE"
  // info
  | "I_IMPLICIT_AND" | "I_DEFAULT_PERIOD" | "I_KEYWORD_SYNONYM";

export interface Suggestion {
  label: string;          // "Debt to equity (debt_equity)"
  replacement: string;    // text that replaces the issue span
}

export interface QueryIssue {
  code: IssueCode;
  level: "error" | "warning" | "info";
  /** Formal Indian English. Never blames the user ("Unknown metric", not "You typed"). */
  message: string;
  span: Span;
  suggestions: Suggestion[];
}

/** Three-valued truth: 0 false, 1 true, 2 unknown (a null was involved). */
export type Tri = 0 | 1 | 2;
export const TRI_FALSE = 0 as const;
export const TRI_TRUE = 1 as const;
export const TRI_UNKNOWN = 2 as const;

/** Top-level clause of the shape `metric[selector] op number` or `metric BETWEEN a AND b`. */
export interface SimpleClause {
  metric: MetricId;
  selector: Selector | null;
  op: CmpOp | "between";
  value: number;
  value2: number | null;
}

export interface CompiledClause {
  index: number;
  ast: Expr;
  span: Span;
  text: string;            // canonical text of this clause
  english: string;         // "ROCE averaged above 15% over the last 5 financial years"
  metrics: MetricId[];
  simple: SimpleClause | null;
}

export interface CompiledSort {
  ast: Expr;
  dir: "asc" | "desc";
  text: string;
  english: string;
  usesRank: boolean;
}

export interface CompiledQuery {
  ok: boolean;             // no error-level issues
  source: string;
  canonical: string;       // print(ast): ids, explicit AND, normalised spacing; used for cache keys
  ast: QueryAst | null;
  /** Top-level AND conjuncts of WHERE (an OR group is one clause). Empty when WHERE is empty. */
  clauses: CompiledClause[];
  sort: CompiledSort[];
  limit: number | null;
  metrics: MetricId[];     // every metric id referenced (auto columns, applicability notes)
  issues: QueryIssue[];
  english: string;         // whole query in plain English
}

export interface QueryEvaluation {
  /** Store indices that were evaluated (the universe), ascending. */
  rows: Int32Array;
  /** Per clause, aligned with rows. */
  clauseTri: Uint8Array[];
  /** Per clause, NULL_REASONS code of the dominant null when the clause is unknown, else 0. */
  clauseReason: Uint8Array[];
  /** Per clause: left and right numeric values for SimpleClause and plain comparisons (NaN otherwise). */
  clauseLhs: Float64Array[];
  clauseRhs: Float64Array[];
  /** Whole WHERE, aligned with rows (TRUE for every row when WHERE is empty). */
  whereTri: Uint8Array;
}

export interface PeriodDetail {
  label: string;           // "FY23"
  value: number | null;
  display: string;         // "14.1%"
  result: Tri;
}

export interface ClauseExplanation {
  clause: number;
  result: Tri;
  english: string;         // the clause in plain English
  /** "ROCE · 5Y avg 22.4% (FY22–FY26); needs above 15%" */
  detail: string;
  lhs: number | null;
  rhs: number | null;
  /** Filled for window clauses: one entry per year evaluated. */
  periods: PeriodDetail[] | null;
  /** Filled when the clause uses a peer function. */
  peer: { groupLabel: string; scope: PeerScope; n: number; median: number | null } | null;
  reason: NullReason | null;
  /** Signed relative shortfall for failed simple clauses (0.05 = 5% short). */
  gap: number | null;
  gapText: string | null;  // "0.8 points short"
}

export interface CompileOptions {
  /** Default 50 clauses, nesting depth 20, 4,000 characters. */
  maxClauses?: number;
  maxDepth?: number;
  maxLength?: number;
}

export interface CompletionItem {
  kind: "metric" | "function" | "keyword" | "selector" | "window" | "type_test" | "value";
  label: string;           // "ROCE · 5Y avg"
  insert: string;          // "roce_avg_5y"
  detail: string;          // "% · Profitability · 84% of companies have data"
  doc: string | null;      // one-line tooltip
}

export interface CompletionList {
  span: Span;              // text to replace
  items: CompletionItem[];
}

/** Lightweight builder model: one chip per top-level clause. */
export type Chip =
  | { kind: "simple"; id: string; metric: MetricId; selector: Selector | null; op: CmpOp | "between"; value: string; value2: string }
  | { kind: "type"; id: string; test: TypeTest; negated: boolean }
  | { kind: "advanced"; id: string; text: string; english: string };

export interface ChipModel {
  chips: Chip[];
  /** Canonical SORT BY / LIMIT text kept verbatim (not editable as chips). */
  tail: string;
}

// ── Function types implemented by src/lib/query/index.ts (WS4) ──────────────
export type CompileQuery = (source: string, store: MetricStore, options?: CompileOptions) => CompiledQuery;
export type EvaluateQuery = (query: CompiledQuery, store: MetricStore, rows: Int32Array) => QueryEvaluation;
export type ExplainClause = (
  query: CompiledQuery, evaluation: QueryEvaluation, clause: number, storeIndex: number, store: MetricStore,
) => ClauseExplanation;
/** Evaluates a numeric expression for every company (expression columns, custom formulas later). */
export type EvaluateExpression = (source: string, store: MetricStore) => { column: MetricColumn | null; issues: QueryIssue[] };
export type SuggestAt = (source: string, cursor: number, store: MetricStore) => CompletionList;
export type ToChips = (query: CompiledQuery) => ChipModel;
export type FromChips = (model: ChipModel) => string;
export type PrintQuery = (ast: QueryAst) => string;
