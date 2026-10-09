// src/lib/contracts/metrics.ts
import type {
  AnnualField, CompanyRecord, CompanyType, DatasetMeta, FundamentalsDataset, PeerClass,
  QuarterField, ShareholdingField, TypeFamily,
} from "./dataset";

/** snake_case id, /^[a-z][a-z0-9_]*$/, stable forever (used in URLs and saved screens). */
export type MetricId = string;

export type Unit =
  | "inr_cr" | "inr" | "pct" | "pp" | "x" | "days" | "years" | "count" | "score" | "crore_shares" | "fy_year";
export type Direction = "higher" | "lower" | "neutral";
export type Level = "basic" | "intermediate" | "advanced";
export type MetricCategory =
  | "Line items" | "Size" | "Valuation" | "Profitability" | "Efficiency" | "Leverage & Liquidity"
  | "Growth" | "Cash Flow" | "Shareholding" | "Dividend" | "Per Share" | "Banking & NBFC"
  | "Scores & Checks" | "Data";

/**
 * annual       – one value per financial year; supports [fy-k], [prev] and windows (Ny)
 * quarterly    – one value per quarter; supports [q-k], [prev]
 * shareholding – one value per shareholding quarter; supports [q-k], [prev]
 * latest_only  – price-linked or cross-period values with no stored history (pe, market_cap, …)
 */
export type HistoryKind = "annual" | "quarterly" | "shareholding" | "latest_only";

export type Variant =
  | "prev" | "ttm"
  | "avg_3y" | "avg_5y" | "avg_10y" | "min_5y" | "stdev_5y"
  | "cagr_3y" | "cagr_5y" | "cagr_10y"
  | "cum_3y" | "cum_5y" | "cum_10y"
  | "chg_1q" | "chg_1y" | "chg_3y";

export const VARIANTS: readonly Variant[] = [
  "prev", "ttm", "avg_3y", "avg_5y", "avg_10y", "min_5y", "stdev_5y",
  "cagr_3y", "cagr_5y", "cagr_10y", "cum_3y", "cum_5y", "cum_10y", "chg_1q", "chg_1y", "chg_3y",
];

/** One entry per base metric in metrics/catalogue.ts (the table in spec section C). */
export interface BaseMetricDef {
  id: MetricId;
  label: string;            // "Return on capital employed"
  short: string;            // "ROCE" (column header stem)
  aliases: readonly string[]; // extra natural names; must not contain the words and/or/not/between
  category: MetricCategory;
  unit: Unit;
  decimals: number;         // display precision; also the tolerance for "=" in queries
  direction: Direction;
  level: Level;
  appliesTo: readonly TypeFamily[];
  history: HistoryKind;
  /** A TTM form exists ([ttm] selector, `_ttm` variant). */
  ttm: boolean;
  /** cagr() is meaningful (positive flows and per-share values). */
  growthable: boolean;
  /** Variant ids generated as `${id}_${variant}`. */
  variants: readonly Variant[];
  /** Set for line-item metrics that expose a raw dataset field directly. */
  rawField: AnnualField | QuarterField | ShareholdingField | null;
  /** Period tag shown next to every value: "FY", "TTM", "Latest", "Latest qtr", "5Y". */
  periodTag: string;
  formula: string;          // human-readable, shown on formula cards and docs/metrics.md
  tooltip: string;          // ≤ 120 chars, plain formal Indian English
  nullRules: string;        // human-readable null rules, shown on formula cards
  isScore: boolean;
}

/** Full definition including generated variants (metrics/variants.ts). */
export interface MetricDef extends BaseMetricDef {
  base: MetricId;
  variant: Variant | null;
  /** FSQL text the variant is shorthand for, e.g. "avg(roce, 5y)"; null for base metrics. */
  expandsTo: string | null;
}

/** Index 0 = "none". Columns store these as Uint8 codes. Order is frozen (append only). */
export const NULL_REASONS = [
  "none",
  "missing_input",
  "non_positive_denominator",
  "negative_net_worth",
  "loss_making",
  "not_applicable_financial",
  "insufficient_history",
  "ev_not_positive",
  "no_interest_cost",
  "too_few_peers",
  "transition_period",
  "no_price",
  "too_few_inputs",
] as const;
export type NullReasonCode = (typeof NULL_REASONS)[number];
export type NullReason = Exclude<NullReasonCode, "none">;

/** Value flags, kept as a bitmask (Uint16) in columns. */
export const VF = {
  Turnaround: 1,      // growth from ≤ 0 to > 0 (the value itself is null)
  Approximate: 2,     // e.g. inventory days on sales, NIM on total assets
  Proxy: 4,           // e.g. Piotroski gross-margin leg uses OPM
  ClosingBasis: 8,    // first year: closing balance used instead of the average
  FyFallback: 16,     // TTM requested but 4 consecutive quarters missing; latest FY used
  Provided: 32,       // value supplied by the user's file, not derived
  NetCash: 64,        // net debt negative
  InferredType: 128,  // company type inferred from sector keywords
  SalesBasis: 256,    // days metric computed on sales because COGS is missing
  AssumedZero: 512,   // a ZERO_DEFAULT_FIELDS input was null and treated as 0
  PayoutOver100: 1024,
  LimitOfData: 2048,  // streak or history ran out (e.g. "at least 11 years")
} as const;
export type ValueFlag = (typeof VF)[keyof typeof VF];

export interface MetricValue {
  /** Finite number, or null. Never NaN or Infinity. */
  v: number | null;
  /** Non-null exactly when v is null. */
  reason: NullReason | null;
  /** Bitmask of VF. */
  flags: number;
}

export interface MetricColumn {
  id: MetricId;
  /** NaN = null (internal only). One entry per company, aligned with MetricStore.symbols. */
  values: Float64Array;
  /** Index into NULL_REASONS; 0 when the value is present. */
  reasons: Uint8Array;
  /** VF bitmask. */
  flags: Uint16Array;
}

export interface PeriodSel {
  freq: "fy" | "q" | "ttm";
  /** 0 = latest slot, 1 = one period before, … (non-overlapping 4-quarter blocks for "ttm"). */
  offset: number;
}

/** "class" = all companies of the same PeerClass in the loaded dataset. */
export type PeerScope = "class" | "sector" | "industry";
export const PEER_SCOPES: readonly PeerScope[] = ["class", "sector", "industry"];

/** Groups smaller than PEER_MIN.group fall back industry → sector → class. */
export const PEER_MIN = { group: 5, median: 3, percentile: 5 } as const;

export interface PeerGroups {
  scope: PeerScope;
  /** Effective group id per company (after fallback); -1 when the company has no group. */
  groupOf: Int32Array;
  /** Index into PEER_SCOPES actually used for each company (after fallback). */
  effectiveScope: Uint8Array;
  /** Human label per group id, e.g. "Cement · 9 companies in your data". */
  labels: readonly string[];
  sizes: Int32Array;
}

export interface PeerStat {
  n: number;                       // non-null values in the group
  median: number | null;
  p25: number | null;
  p75: number | null;
  groupLabel: string;
  scope: PeerScope;                // scope actually used
  fellBackTo: PeerScope | null;    // set when the requested scope was too small
}

export interface MetricStore {
  /** Dataset fingerprint; part of every cache key. */
  readonly key: string;
  readonly meta: DatasetMeta;
  readonly size: number;
  readonly symbols: readonly string[];
  /** Most common latest fiscal year across companies (for stale-data warnings); null if none. */
  readonly modalLatestFy: number | null;
  indexOf(symbol: string): number;                 // -1 if absent
  company(i: number): CompanyRecord;
  companyType(i: number): { type: CompanyType; inferred: boolean };
  family(i: number): TypeFamily;
  peerClass(i: number): PeerClass;
  sector(i: number): string;
  industry(i: number): string;                     // falls back to sector
  def(id: MetricId): MetricDef | undefined;
  defs(): readonly MetricDef[];
  /** Default-period value for every company. Lazy, cached for the store's lifetime. Throws on unknown id. */
  column(id: MetricId): MetricColumn;
  /** Value for every company at a period selector (annual, quarterly, shareholding metrics). */
  columnAt(id: MetricId, sel: PeriodSel): MetricColumn;
  get(id: MetricId, i: number): MetricValue;
  at(id: MetricId, i: number, sel: PeriodSel): MetricValue;
  /** Number of grid slots holding data for that company (holes count; leading empty slots do not). */
  slots(i: number, grid: "fy" | "q" | "sh"): number;
  /** "FY26", "Q1 FY27", "TTM to Jun 2026"; null when the slot is empty. */
  periodLabel(i: number, sel: PeriodSel): string | null;
  groups(scope: PeerScope): PeerGroups;
  /** Ascending percentile 0–100 within each company's peer group (ties averaged). */
  percentileOf(values: Float64Array, scope: PeerScope): MetricColumn;
  /** Median of each company's peer group (non-null values only). */
  medianOf(values: Float64Array, scope: PeerScope): MetricColumn;
  percentile(id: MetricId, i: number, scope: PeerScope): MetricValue;
  peerStat(id: MetricId, i: number, scope: PeerScope): PeerStat;
  /** Peers of company i (same peer class), sorted by market cap descending, i excluded. */
  peers(i: number, scope: PeerScope, limit?: number): number[];
  coverage(id: MetricId): { nonNull: number; applicable: number };
}

/** Lets other streams add latest-only columns (red flags, check counts) without editing metrics files. */
export interface ColumnProvider {
  ids: readonly MetricId[];
  compute(store: MetricStore, id: MetricId): MetricColumn;
}

export interface CreateStoreOptions {
  providers: readonly ColumnProvider[];
}

export type CreateMetricStore = (dataset: FundamentalsDataset, options: CreateStoreOptions) => MetricStore;

export class UnknownMetricError extends Error {
  constructor(public readonly metricId: MetricId) {
    super(`Unknown metric id "${metricId}"`);
    this.name = "UnknownMetricError";
  }
}

/** Window aggregates shared by store variants and FSQL functions (metrics/windows.ts, written in Phase 0). */
export type WindowAggregate = "avg" | "median" | "min" | "max" | "sum" | "stdev";

/**
 * columns[k] = the value column at window offset k (k = 0 is the most recent year of the window).
 * A company's result is non-null only when all N inputs are non-null. Otherwise the reason is
 * not_applicable_financial or transition_period if any input carries it, else insufficient_history.
 * stdev is the population standard deviation.
 */
export type AggregateWindow = (kind: WindowAggregate, columns: readonly MetricColumn[], id: MetricId) => MetricColumn;

/** ((end / start)^(1/years) − 1) × 100; null (non_positive_denominator) unless both > 0. */
export type CagrColumn = (end: MetricColumn, start: MetricColumn, years: number, id: MetricId) => MetricColumn;
