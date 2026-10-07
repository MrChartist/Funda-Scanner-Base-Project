// src/lib/data/index.ts — data platform public API (WS1).
// P0 STUB: a working provider registry (sample provider by default, v0 providers accepted),
// canonical-JSON import only, in-memory activation, a simple file-kind detector and a basic
// data-health summary. WS1 replaces the bodies (zod validation, wide CSVs, IndexedDB, migration).
import type {
  AnnualField, CompanyRecord, DataHealth, DataProvider, FundamentalsDataset, ImportFileKind, ImportOutcome,
  LegacyNumericKey, MetricStore, StockRow, ValidationIssue, ValidationReport,
} from "@/lib/contracts";
import {
  DATASET_SCHEMA, DATASET_VERSION, LEGACY_KEY_TO_METRIC, REQUIRED_ANNUAL_FIELDS, ZERO_DEFAULT_FIELDS,
} from "@/lib/contracts";
import { fyLabel } from "@/lib/time/civil";
import { nowIso } from "@/lib/time/clock";
import { createSampleProvider } from "@/lib/sample/sample-provider";

// ── registry ────────────────────────────────────────────────────────────────
let active: DataProvider = createSampleProvider();
const listeners = new Set<() => void>();

export function getDataProvider(): DataProvider {
  return active;
}

/** Accepts v2 providers (getDataset) and v0 providers (getUniverse only). Throws if neither is present. */
export function setDataProvider(p: DataProvider): void {
  if (typeof p.getDataset !== "function" && typeof p.getUniverse !== "function") {
    throw new TypeError(`Data provider "${p.id}" must implement getDataset() or getUniverse().`);
  }
  active = p;
  listeners.forEach((l) => l());
}

export function subscribeDataProvider(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// ── legacy (v0) rows → snapshot-only dataset ────────────────────────────────
const LEGACY_KEYS = Object.keys(LEGACY_KEY_TO_METRIC) as LegacyNumericKey[];

function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Minimal legacy adapter (§B.12): one snapshot-only CompanyRecord per StockRow; NaN values omitted. */
export function datasetFromStockRows(
  rows: readonly StockRow[], o: { name: string; isSynthetic: boolean; source?: FundamentalsDataset["meta"]["source"] },
): FundamentalsDataset {
  const companies: CompanyRecord[] = rows.map((r) => {
    const snapshot: Record<string, number> = {};
    for (const k of LEGACY_KEYS) {
      if (k === "price" || k === "market_cap") continue;
      const v = finiteOrNull(r[k]);
      if (v !== null) snapshot[LEGACY_KEY_TO_METRIC[k]] = v;
    }
    return {
      symbol: String(r.symbol).trim().toUpperCase(),
      name: r.name,
      sector: r.sector,
      industry: r.industry || null,
      isin: null,
      company_type: null,
      statement_basis: "consolidated",
      fy_end_month: 3,
      market: {
        price: finiteOrNull(r.price), price_date: null, shares_outstanding: null, face_value: null,
        market_cap_supplied: finiteOrNull(r.market_cap),
      },
      annual: [],
      quarterly: [],
      shareholding: [],
      snapshot,
      sample_note: null,
      source_note: null,
    };
  });
  return {
    schema: DATASET_SCHEMA,
    version: DATASET_VERSION,
    meta: {
      name: o.name, source: o.source ?? (o.isSynthetic ? "synthetic_sample" : "custom_provider"), isSynthetic: o.isSynthetic,
      asOf: null, importedAt: null, currency: "INR", moneyUnit: "crore", sharesUnit: "crore",
      files: [], generator: null, notes: [],
    },
    companies,
  };
}

/** Loads a provider's data as a canonical dataset (v2 loader preferred, v0 rows adapted). */
export async function loadDataset(p: DataProvider, signal?: AbortSignal): Promise<FundamentalsDataset> {
  if (typeof p.getDataset === "function") return p.getDataset(signal);
  if (typeof p.getUniverse === "function") {
    const rows = await p.getUniverse();
    return datasetFromStockRows(rows, { name: p.name, isSynthetic: p.isDemo });
  }
  throw new TypeError(`Data provider "${p.id}" has no loader.`);
}

// ── file kind detection ─────────────────────────────────────────────────────
function headerCells(text: string): string[] {
  const line = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  if (!line) return [];
  return line.split(",").map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase());
}

const SNAPSHOT_HINTS = ["pe", "roe", "roce", "market_cap", "price", "price_book", "debt_equity", "eps"];

export function detectFileKind(name: string, text: string): ImportFileKind | "unknown" {
  const body = text.replace(/^\uFEFF/, "").trim();
  if (/\.json$/i.test(name) || body.startsWith("{") || body.startsWith("[")) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (Array.isArray(parsed)) return "snapshot";
      if (typeof parsed === "object" && parsed !== null) {
        const o = parsed as { schema?: unknown; rows?: unknown };
        if (o.schema === DATASET_SCHEMA) return "canonical_json";
        if (Array.isArray(o.rows)) return "snapshot";
      }
    } catch {
      return "unknown";
    }
    return "unknown";
  }
  const h = headerCells(body);
  if (h.length === 0) return "unknown";
  if (h.includes("fiscal_year")) return "annual";
  if (h.includes("period_end")) {
    return h.some((c) => c.startsWith("promoter") || c.startsWith("fii") || c.startsWith("dii")) ? "shareholding" : "quarterly";
  }
  if (!h.includes("symbol")) return "unknown";
  if (h.some((c) => SNAPSHOT_HINTS.includes(c))) return "snapshot";
  if (h.includes("name") || h.includes("sector")) return "companies";
  return "unknown";
}

// ── import (canonical JSON only in P0) ──────────────────────────────────────
function issue(level: ValidationIssue["level"], code: string, message: string, file: string | null): ValidationIssue {
  return { level, code, message, file, row: null, symbol: null, period: null, field: null };
}

function emptyReport(issues: ValidationIssue[]): ValidationReport {
  return {
    ok: !issues.some((i) => i.level === "error"), issues, companies: 0, companiesRejected: 0,
    annualRows: 0, quarterRows: 0, shareholdingRows: 0, coverage: {},
  };
}

export async function importFiles(
  files: readonly { name: string; text: string }[],
  o: { moneyScale?: "crore" | "lakh" | "rupee" | "million" } = {},
): Promise<ImportOutcome> {
  void o; // unit scaling arrives with WS1
  const issues: ValidationIssue[] = [];
  const kinds: ImportOutcome["files"] = [];
  let dataset: FundamentalsDataset | null = null;
  for (const f of files) {
    const kind = detectFileKind(f.name, f.text);
    if (kind !== "canonical_json") {
      kinds.push({ name: f.name, kind, rows: 0 });
      issues.push(issue("error", "E000_UNSUPPORTED", `"${f.name}" cannot be imported yet. Only the canonical JSON format is supported in this build.`, f.name));
      continue;
    }
    try {
      const parsed = JSON.parse(f.text.replace(/^\uFEFF/, "")) as FundamentalsDataset;
      if (parsed.version !== DATASET_VERSION || !Array.isArray(parsed.companies)) {
        issues.push(issue("error", "E003_SCHEMA_VERSION", `"${f.name}" has an unknown schema version.`, f.name));
        kinds.push({ name: f.name, kind, rows: 0 });
        continue;
      }
      dataset = parsed;
      kinds.push({ name: f.name, kind, rows: parsed.companies.length });
    } catch {
      issues.push(issue("error", "E000_BAD_JSON", `"${f.name}" is not valid JSON.`, f.name));
      kinds.push({ name: f.name, kind, rows: 0 });
    }
  }
  if (!dataset && !issues.some((i) => i.level === "error")) {
    issues.push(issue("error", "E002_NO_COMPANIES", "No usable companies were found in the files.", null));
  }
  const report = emptyReport(issues);
  if (dataset && report.ok) {
    report.companies = dataset.companies.length;
    for (const c of dataset.companies) {
      report.annualRows += c.annual.length;
      report.quarterRows += c.quarterly.length;
      report.shareholdingRows += c.shareholding.length;
    }
  }
  return { dataset: report.ok ? dataset : null, report, files: kinds };
}

let importRevision = 0;

/** Makes an imported dataset the active provider (memory only in P0). */
export async function activateImportedDataset(o: ImportOutcome): Promise<{ persisted: "indexeddb" | "localstorage" | "memory" }> {
  if (!o.dataset) throw new Error("There is no dataset to activate.");
  const dataset: FundamentalsDataset = {
    ...o.dataset,
    meta: { ...o.dataset.meta, source: "user_import", isSynthetic: false, importedAt: nowIso() },
  };
  importRevision += 1;
  setDataProvider({
    id: "imported",
    name: dataset.meta.name || "Imported data",
    isDemo: false,
    revision: importRevision,
    getDataset: async () => dataset,
  });
  return { persisted: "memory" };
}

export function restoreActiveProvider(): DataProvider {
  return getDataProvider();
}

export async function clearImportedData(): Promise<void> {
  setDataProvider(createSampleProvider());
}

// ── data health (basic) ─────────────────────────────────────────────────────
export function computeDataHealth(store: MetricStore, i: number): DataHealth {
  const c = store.company(i);
  const years = c.annual.map((r) => r.fiscal_year).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let k = 1; k < years.length; k++) for (let y = years[k - 1] + 1; y < years[k]; y++) gaps.push(y);
  const assumedZero = ZERO_DEFAULT_FIELDS
    .map((field: AnnualField) => ({ field, years: c.annual.filter((r) => r[field] === null).length }))
    .filter((x) => x.years > 0);
  const missingRequired = store.family(i) === "non_financial"
    ? c.annual
      .map((r) => ({ period: fyLabel(r.fiscal_year), fields: REQUIRED_ANNUAL_FIELDS.filter((f) => r[f] === null) as string[] }))
      .filter((x) => x.fields.length > 0)
    : [];
  const lastOf = (rows: readonly { period_end: string }[]) =>
    rows.length ? rows.map((r) => r.period_end).sort()[rows.length - 1] : null;
  return {
    years: { first: years[0] ?? null, last: years[years.length - 1] ?? null, count: years.length, gaps },
    quarters: { count: c.quarterly.length, last: lastOf(c.quarterly) },
    shareholding: { count: c.shareholding.length, last: lastOf(c.shareholding) },
    snapshotOnly: c.annual.length === 0 && c.quarterly.length === 0,
    typeInferred: store.companyType(i).inferred,
    assumedZero,
    missingRequired,
    mismatches: [],
    issues: [],
  };
}
