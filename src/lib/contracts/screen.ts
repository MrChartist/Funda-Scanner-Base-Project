// src/lib/contracts/screen.ts
import type { TypeFamily } from "./dataset";
import type { Direction, MetricColumn, MetricId, MetricStore, NullReason, Unit } from "./metrics";
import type { CompiledQuery } from "./query";

export const SCREEN_URL_VERSION = 1 as const;
export const SAVED_SCREENS_VERSION = 2 as const;

export type UniverseSpec =
  | { kind: "all" }
  | { kind: "watchlist" }
  | { kind: "portfolio" }
  | { kind: "sector"; sector: string }
  | { kind: "industry"; industry: string }
  | { kind: "symbols"; symbols: string[] };

export type ColumnSpec =
  | { kind: "metric"; id: MetricId }
  | { kind: "expr"; expr: string; label: string };   // P2 (formula columns); engine supports it

/** Header-click sort. Overrides SORT BY for display only; it never changes LIMIT membership. */
export interface DisplaySort {
  key: string;             // metric id, "name", or "expr:<index into columns>"
  dir: "asc" | "desc";
}

export interface ScreenDefinition {
  v: typeof SAVED_SCREENS_VERSION;
  id: string;
  name: string;
  description: string;
  /** Source text; the query language is the stable storage format. */
  query: string;
  columns: ColumnSpec[];
  sort: DisplaySort | null;
  universe: UniverseSpec;
  templateId: string | null;
  /** Real local save times from time/clock.ts. */
  createdAt: string;
  updatedAt: string;
  /** Catalogue version at save time (metrics/catalogue.ts CATALOGUE_VERSION). */
  catalogueVersion: string;
}

/** What the URL carries (?v=1&q=&cols=&sort=&u=&t=&p=&ps=). */
export interface ScreenUrlState {
  v: typeof SCREEN_URL_VERSION;
  query: string;
  columns: ColumnSpec[] | null;   // null = defaults
  sort: DisplaySort | null;
  universe: UniverseSpec;
  templateId: string | null;
  page: number;                   // 1-based
  pageSize: 25 | 50 | 100;
}

export interface SavedScreensFile {
  v: typeof SAVED_SCREENS_VERSION;
  screens: ScreenDefinition[];
}

/** JSON backup the user downloads and re-imports. */
export interface ScreenLibraryExport {
  kind: "funda-scanner-screens";
  v: typeof SAVED_SCREENS_VERSION;
  exportedAt: string;
  screens: ScreenDefinition[];
}

export interface ScreenContext {
  watchlist: readonly string[];
  portfolio: readonly string[];
}

export type ClauseStatus = "pass" | "fail" | "unknown";

export interface FunnelStep {
  clause: number;
  text: string;
  english: string;
  /** Independent counts over the universe. */
  passed: number;
  failed: number;
  unknown: number;
  /** Companies TRUE on clauses 0..clause (in the order written). */
  remainingAfter: number;
  /** Matches if this clause alone were removed. */
  dropOneMatches: number;
  /** Removes the most companies (largest failed count). */
  strictest: boolean;
}

export interface NearMiss {
  index: number;           // store index
  clause: number;          // the single failed clause; every other clause is TRUE
  lhs: number | null;
  rhs: number | null;
  relGap: number | null;   // sort key: smaller is nearer
  gapText: string;         // "ROCE · 5Y avg 14.2%, needs above 15% (0.8 points short)"
}

export interface SkippedGroup {
  reason: NullReason;
  count: number;
  family: TypeFamily | null;   // set when every skipped company in the group shares a family
  metrics: MetricId[];
  message: string;             // "12 lenders not evaluated: ROCE does not apply to banks and NBFCs"
}

export type ScreenWarningCode =
  | "W_TTM_FALLBACK" | "W_STALE_DATA" | "W_SNAPSHOT_ONLY" | "W_RANK_MIXED_CLASSES" | "W_LIMIT_APPLIED"
  | "W_UNKNOWN_SYMBOLS";

export interface ScreenWarning {
  code: ScreenWarningCode;
  count: number;
  message: string;
}

export interface ResolvedColumn {
  key: string;             // metric id, or "expr:<n>"
  metricId: MetricId | null;
  label: string;
  short: string;
  unit: Unit | null;
  decimals: number;
  direction: Direction;
  periodTag: string;
  fromQuery: boolean;
  column: MetricColumn;
}

export interface ScreenRun {
  ok: boolean;
  compiled: CompiledQuery;
  /** Store indices in the selected universe, ascending. */
  universe: Int32Array;
  /** Store indices of matches in display order, after LIMIT. */
  matched: Int32Array;
  /** Matches before LIMIT. */
  matchCount: number;
  /** Rank-sum (or other SORT BY key) per matched row, aligned with matched; null without SORT BY. */
  sortValues: Float64Array | null;
  /** Per clause, aligned with universe (copied from QueryEvaluation). */
  clauseTri: Uint8Array[];
  clauseReason: Uint8Array[];
  clauseLhs: Float64Array[];
  clauseRhs: Float64Array[];
  funnel: FunnelStep[];
  nearMisses: NearMiss[];  // at most 50, nearest first
  skipped: SkippedGroup[];
  warnings: ScreenWarning[];
  columns: ResolvedColumn[];
  /** Median of each numeric column over the matches (the results footer row). */
  medians: Record<string, number | null>;
  durationMs: number;
}

export interface RunScreenInput {
  query: string;
  columns: ColumnSpec[] | null;
  sort: DisplaySort | null;
  universe: UniverseSpec;
}

/** Implemented by src/lib/screen/run.ts (WS4). Pure and synchronous; inputs and outputs are serialisable. */
export type RunScreen = (
  store: MetricStore, input: RunScreenInput, ctx: ScreenContext, compiled?: CompiledQuery,
) => ScreenRun;

export interface ScreenTemplate {
  id: "quality" | "value" | "growth" | "dividend" | "turnaround" | "lenders" | "ey_roc_rank";
  title: string;           // "Quality compounders"
  level: "Beginner" | "Intermediate";
  idea: string;            // one or two sentences
  query: string;           // one condition per line
  clauseNotes: string[];   // one per top-level clause, same order
  misses: string[];        // what the screen will not find
  notFor: string[];        // who or what it does not suit
  tryChanging: string;
  columns: MetricId[];
  sort: DisplaySort | null;
  /** Generic citation of a public idea (a book or paper), never a website. */
  inspiredBy: string | null;
}
