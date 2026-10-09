// src/lib/contracts/provider.ts
import type { FundamentalsDataset, ImportFileKind } from "./dataset";
import type { MetricId, MetricStore } from "./metrics";
import type { StockRow } from "./legacy";

/**
 * DataProvider v2. Backward compatible: an object with only { id, name, isDemo, getUniverse }
 * (the v0 shape) is still a valid DataProvider and is wrapped by data/providers/legacy-adapter.ts
 * into a snapshot-only dataset. setDataProvider() throws if neither loader is present.
 */
export interface DataProvider {
  id: string;
  name: string;
  /** Kept for compatibility; must equal dataset.meta.isSynthetic for v2 providers. */
  isDemo: boolean;
  /** Bump whenever the data behind this provider changes; part of the React Query key. Default 0. */
  revision?: number;
  /** v2 loader. Preferred. */
  getDataset?(signal?: AbortSignal): Promise<FundamentalsDataset>;
  /** @deprecated v0 snapshot loader. */
  getUniverse?(): Promise<StockRow[]>;
}

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  code: string;            // "E001_NO_SYMBOL", "W101_QUARTER_SUM", "W105_UNITS_RUPEES", …
  message: string;         // formal Indian English, names the file/row/field
  file: string | null;
  row: number | null;      // 1-based data row (header excluded)
  symbol: string | null;
  period: string | null;   // "FY24" | "2025-06-30"
  field: string | null;
}

export interface ValidationReport {
  ok: boolean;             // no errors
  issues: ValidationIssue[];
  companies: number;
  companiesRejected: number;
  annualRows: number;
  quarterRows: number;
  shareholdingRows: number;
  /** Field → share (0–1) of company-years where the field is present. */
  coverage: Record<string, number>;
}

export interface ImportOutcome {
  dataset: FundamentalsDataset | null;   // null when a blocking error occurred
  report: ValidationReport;
  files: { name: string; kind: ImportFileKind | "unknown"; rows: number }[];
}

export interface DataHealth {
  years: { first: number | null; last: number | null; count: number; gaps: number[] };
  quarters: { count: number; last: string | null };
  shareholding: { count: number; last: string | null };
  snapshotOnly: boolean;
  typeInferred: boolean;
  /** ZERO_DEFAULT_FIELDS treated as 0 because they were not provided. */
  assumedZero: { field: string; years: number }[];
  missingRequired: { period: string; fields: string[] }[];
  /** Provided snapshot value vs value derived from statements, when both exist and differ > 5%. */
  mismatches: { metric: MetricId; provided: number; derived: number; pctDiff: number }[];
  issues: ValidationIssue[];
}

export type DatasetState =
  | { status: "loading"; provider: DataProvider }
  | { status: "error"; provider: DataProvider; message: string; retry: () => void }
  | { status: "ready"; provider: DataProvider; dataset: FundamentalsDataset; store: MetricStore; report: ValidationReport | null };

export type CompanyState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "not_found"; symbol: string }
  | { status: "ready"; symbol: string; index: number; store: MetricStore };
