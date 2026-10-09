// src/lib/data/import/index.ts — the importer: detect, parse, join by symbol, normalise, validate (WS1).
//
// Files are processed by kind, in this order, whatever order they were dropped in:
//   canonical JSON → legacy snapshot (CSV/JSON) → companies.csv → annual.csv → quarterly.csv → shareholding.csv
// Companies are defined by the first three kinds; statement rows whose symbol is not defined are
// skipped with a warning. Any error blocks the import (the dataset is null) so nothing half-read
// is ever activated.
import type {
  CompanyRecord, DatasetMeta, FundamentalsDataset, ImportFileKind, ImportOutcome, StatementBasis, ValidationIssue,
} from "@/lib/contracts";
import { DATASET_SCHEMA, DATASET_VERSION, MAX_QUARTER_SLOTS, MAX_SHAREHOLDING_SLOTS } from "@/lib/contracts";
import { defaultMeta, makeIssue, tidyAnnual, tidyDated, UNCLASSIFIED_SECTOR, type IssueSink } from "../normalize";
import { buildReport, validateDataset } from "../validate";
import { companyFromStockRow } from "../providers/legacy-adapter";
import { readCanonicalDataset } from "./canonical-json";
import { utf8Length } from "./csv";
import { csvHeader, detectCsvKind, detectJsonKind, looksLikeJson } from "./detect";
import { headerIs, SYMBOL_HEADER_KEYS } from "./aliases";
import {
  MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseSnapshotCsvCoded, parseSnapshotJsonValueCoded, type CodedImportResult,
} from "./snapshot";
import { MAX_CSV_ROWS, parseWideCsv, type CompanyPartial, type WideKind } from "./wide-csv";
import { MONEY_SCALE_LABEL, type MoneyScale } from "./units";
import { FILE_KIND_LABEL } from "./kind-labels";

export { FILE_KIND_LABEL };

export interface ImportFileInput {
  name: string;
  text: string;
}

export interface ImportOptions {
  moneyScale?: MoneyScale;
}

/** E004 limits (§E.3). */
export const IMPORT_LIMITS = {
  jsonBytes: 25 * 1024 * 1024,
  csvRows: MAX_CSV_ROWS,
  snapshotBytes: MAX_IMPORT_BYTES,
  snapshotRows: MAX_IMPORT_ROWS,
} as const;

/** At most this many messages of one code are kept per file; the rest are summarised. */
export const MAX_ISSUES_PER_CODE = 100;

const KIND_ORDER: Readonly<Record<ImportFileKind, number>> = {
  canonical_json: 0, snapshot: 1, companies: 2, annual: 3, quarterly: 4, shareholding: 5,
};


const SYNTHETIC_MARKER = /fictional sample data/i;

interface Classified {
  index: number;
  name: string;
  text: string;
  kind: ImportFileKind | "unknown";
  json: unknown;
  jsonError: string | null;
  bytes: number;
  /** JSON above the 25 MB limit is not parsed at all. */
  tooLarge: boolean;
}

function baseName(name: string): string {
  return name.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "").trim() || name;
}

function classify(f: ImportFileInput, index: number): Classified {
  const bytes = utf8Length(f.text);
  const c: Classified = { index, name: f.name, text: f.text, kind: "unknown", json: undefined, jsonError: null, bytes, tooLarge: false };
  if (looksLikeJson(f.name, f.text)) {
    if (bytes > IMPORT_LIMITS.jsonBytes) {
      c.tooLarge = true;
      return c;
    }
    try {
      c.json = JSON.parse(f.text.replace(/^\uFEFF/, "")) as unknown;
      c.kind = detectJsonKind(c.json);
    } catch (e) {
      c.jsonError = (e as Error).message;
    }
    return c;
  }
  c.kind = detectCsvKind(csvHeader(f.text));
  return c;
}

function fromCoded(r: CodedImportResult, file: string): ValidationIssue[] {
  return r.issues.map((i) => {
    // An empty symbol only skips that row; it does not block the import.
    const level = i.code === "E008_EMPTY_SYMBOL" ? "warning" : i.level;
    const code = i.code === "E008_EMPTY_SYMBOL" ? "W120_EMPTY_SYMBOL" : i.code;
    return makeIssue(level, code, i.message, { file, row: i.row > 0 ? i.row : null, field: i.field, symbol: i.symbol });
  });
}

/** Snapshot rows supply identity only when the cell was filled (legacy rows default the name to the symbol). */
function partialFromRecord(c: CompanyRecord): CompanyPartial {
  const p: CompanyPartial = { symbol: c.symbol, snapshot: { ...c.snapshot } };
  if (c.name && c.name !== c.symbol) p.name = c.name;
  if (c.sector && c.sector !== UNCLASSIFIED_SECTOR) p.sector = c.sector;
  if (c.industry) p.industry = c.industry;
  if (c.market.price !== null) p.price = c.market.price;
  if (c.market.market_cap_supplied !== null) p.market_cap_supplied = c.market.market_cap_supplied;
  return p;
}

function applyPartial(target: CompanyRecord, p: CompanyPartial): void {
  if (p.name !== undefined) target.name = p.name;
  if (p.sector !== undefined) target.sector = p.sector;
  if (p.industry !== undefined) target.industry = p.industry;
  if (p.isin !== undefined) target.isin = p.isin;
  if (p.company_type !== undefined) target.company_type = p.company_type;
  if (p.statement_basis !== undefined) target.statement_basis = p.statement_basis;
  if (p.fy_end_month !== undefined) target.fy_end_month = p.fy_end_month;
  if (p.price !== undefined) target.market.price = p.price;
  if (p.price_date !== undefined) target.market.price_date = p.price_date;
  if (p.shares_outstanding !== undefined) target.market.shares_outstanding = p.shares_outstanding;
  if (p.face_value !== undefined) target.market.face_value = p.face_value;
  if (p.market_cap_supplied !== undefined) target.market.market_cap_supplied = p.market_cap_supplied;
  if (p.source_note !== undefined) target.source_note = p.source_note;
  if (p.sample_note !== undefined) target.sample_note = p.sample_note;
  Object.assign(target.snapshot, p.snapshot);
}

function newCompany(symbol: string): CompanyRecord {
  return {
    symbol, name: symbol, sector: UNCLASSIFIED_SECTOR, industry: null, isin: null, company_type: null,
    statement_basis: "consolidated", fy_end_month: 3,
    market: { price: null, price_date: null, shares_outstanding: null, face_value: null, market_cap_supplied: null },
    annual: [], quarterly: [], shareholding: [], snapshot: {}, sample_note: null, source_note: null,
  };
}

/** Keeps the first MAX_ISSUES_PER_CODE issues of each code per file and summarises the rest. */
export function limitIssues(issues: readonly ValidationIssue[], max = MAX_ISSUES_PER_CODE): ValidationIssue[] {
  const counts = new Map<string, number>();
  const out: ValidationIssue[] = [];
  const extra = new Map<string, { sample: ValidationIssue; n: number }>();
  for (const i of issues) {
    const key = `${i.file ?? ""}|${i.code}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n <= max) out.push(i);
    else {
      const e = extra.get(key);
      if (e) e.n += 1;
      else extra.set(key, { sample: i, n: 1 });
    }
  }
  for (const { sample, n } of extra.values()) {
    out.push(makeIssue(sample.level, sample.code, `…and ${n} more similar message(s)${sample.file ? ` in "${sample.file}"` : ""}.`, { file: sample.file }));
  }
  return out;
}

export async function importFiles(files: readonly ImportFileInput[], o: ImportOptions = {}): Promise<ImportOutcome> {
  const scale: MoneyScale = o.moneyScale ?? "crore";
  const issues: ValidationIssue[] = [];
  const outFiles: ImportOutcome["files"] = files.map((f) => ({ name: f.name, kind: "unknown" as const, rows: 0 }));
  const companies = new Map<string, CompanyRecord>();
  const explicitBasis = new Set<string>();
  const rowBases = new Map<string, StatementBasis[]>();
  const unknownSymbols = new Set<string>();
  const canonicalMetas: DatasetMeta[] = [];
  let synthetic = false;
  let wideFiles = 0;
  let otherFiles = 0;

  if (files.length === 0) {
    issues.push(makeIssue("error", "E002_NO_COMPANIES", "No files were given."));
    return { dataset: null, report: buildReport(null, issues, 0), files: outFiles };
  }

  const classified = files.map(classify).sort((a, b) => {
    const ka = a.kind === "unknown" ? 9 : KIND_ORDER[a.kind];
    const kb = b.kind === "unknown" ? 9 : KIND_ORDER[b.kind];
    return ka - kb || a.index - b.index;
  });

  for (const f of classified) {
    const sink: IssueSink = { file: f.name, issues };
    const entry = outFiles[f.index];
    entry.kind = f.kind;
    const bytes = f.bytes;

    if (f.tooLarge) {
      issues.push(makeIssue("error", "E004_TOO_LARGE", `"${f.name}" is larger than 25 MB, the limit for a JSON file.`, { file: f.name }));
      continue;
    }
    if (f.jsonError !== null) {
      issues.push(makeIssue("error", "E006_BAD_JSON", `"${f.name}" is not valid JSON (${f.jsonError}).`, { file: f.name }));
      continue;
    }
    if (f.kind === "unknown") {
      const isJson = f.json !== undefined;
      if (!isJson && !csvHeader(f.text).some((h) => headerIs(h, SYMBOL_HEADER_KEYS))) {
        issues.push(makeIssue("error", "E001_NO_SYMBOL", `"${f.name}" has no symbol column. Add a column named "symbol" (or ticker).`, { file: f.name, field: "symbol" }));
      } else {
        issues.push(makeIssue("error", "E005_UNKNOWN_KIND",
          isJson
            ? `"${f.name}" is JSON but neither a Funda Scanner dataset nor a list of snapshot rows.`
            : `The kind of "${f.name}" could not be recognised. Use the column names from the templates.`,
          { file: f.name }));
      }
      continue;
    }

    if (f.kind === "canonical_json") {
      otherFiles++;
      if (bytes > IMPORT_LIMITS.jsonBytes) {
        issues.push(makeIssue("error", "E004_TOO_LARGE", `"${f.name}" is larger than 25 MB, the limit for a JSON dataset.`, { file: f.name }));
        continue;
      }
      const ds = readCanonicalDataset(f.json, sink, baseName(f.name));
      if (!ds) continue;
      entry.rows = ds.companies.length;
      canonicalMetas.push(ds.meta);
      if (ds.meta.isSynthetic) synthetic = true;
      for (const c of ds.companies) {
        if (companies.has(c.symbol)) {
          issues.push(makeIssue("warning", "W114_DUPLICATE_COMPANY", `${c.symbol} appears in more than one dataset file; the later one is used.`, { file: f.name, symbol: c.symbol }));
        }
        companies.set(c.symbol, c);
        explicitBasis.add(c.symbol);
      }
      continue;
    }

    if (f.kind === "snapshot") {
      otherFiles++;
      if (bytes > IMPORT_LIMITS.snapshotBytes) {
        issues.push(makeIssue("error", "E004_TOO_LARGE", `"${f.name}" is larger than 5 MB, the limit for a snapshot file.`, { file: f.name }));
        continue;
      }
      const limits = { maxRows: IMPORT_LIMITS.snapshotRows };
      const parsed = f.json !== undefined
        ? parseSnapshotJsonValueCoded(f.json, limits)
        : parseSnapshotCsvCoded(f.text, { comments: true, limits });
      issues.push(...fromCoded(parsed, f.name));
      entry.rows = parsed.rows.length;
      if (f.json === undefined && SYNTHETIC_MARKER.test(f.text.slice(0, 2000).split(/\r?\n/).filter((l) => l.trim().startsWith("#")).join(" "))) synthetic = true;
      for (const r of parsed.rows) {
        const c = companyFromStockRow(r);
        if (!c) continue;
        const existing = companies.get(c.symbol);
        if (existing) applyPartial(existing, partialFromRecord(c));
        else companies.set(c.symbol, c);
      }
      continue;
    }

    // Wide CSV files
    wideFiles++;
    const kind = f.kind as WideKind;
    const parsed = parseWideCsv(kind, f.text, sink, {
      moneyScale: scale,
      fyEndMonthOf: (s) => companies.get(s)?.fy_end_month ?? 3,
    });
    entry.rows = parsed.rows;
    if (parsed.comments.some((c) => SYNTHETIC_MARKER.test(c))) synthetic = true;

    if (kind === "companies") {
      for (const p of parsed.companies) {
        let c = companies.get(p.symbol);
        if (!c) {
          c = newCompany(p.symbol);
          companies.set(p.symbol, c);
        }
        applyPartial(c, p);
        if (p.statement_basis !== undefined) explicitBasis.add(p.symbol);
      }
      continue;
    }

    const skipped = new Set<string>();
    const attach = (symbol: string): CompanyRecord | null => {
      const c = companies.get(symbol);
      if (!c) {
        skipped.add(symbol);
        unknownSymbols.add(symbol);
      }
      return c ?? null;
    };
    for (const e of parsed.annual) {
      const c = attach(e.symbol);
      if (!c) continue;
      c.annual.push(e.row);
      if (e.basis) {
        const list = rowBases.get(e.symbol) ?? [];
        list.push(e.basis);
        rowBases.set(e.symbol, list);
      }
    }
    for (const e of parsed.quarterly) attach(e.symbol)?.quarterly.push(e.row);
    for (const e of parsed.shareholding) attach(e.symbol)?.shareholding.push(e.row);
    if (skipped.size) {
      const list = [...skipped];
      issues.push(makeIssue("warning", "W115_UNKNOWN_SYMBOL",
        `"${f.name}": rows for ${list.length} symbol(s) were skipped because they are not in a company list or dataset file: ${list.slice(0, 10).join(", ")}${list.length > 10 ? ", …" : ""}.`,
        { file: f.name, symbol: list[0] }));
    }
  }

  // Tidy every series once all files are joined (duplicates across files, order, grid caps).
  const finalSink: IssueSink = { file: null, issues };
  for (const c of companies.values()) {
    c.annual = tidyAnnual(c.annual, c.symbol, finalSink);
    c.quarterly = tidyDated(c.quarterly, c.symbol, finalSink, MAX_QUARTER_SLOTS, "quarterly");
    c.shareholding = tidyDated(c.shareholding, c.symbol, finalSink, MAX_SHAREHOLDING_SLOTS, "shareholding");
    // W106: basis changes within one company
    const bases = rowBases.get(c.symbol) ?? [];
    if (bases.length) {
      if (!explicitBasis.has(c.symbol)) c.statement_basis = bases[bases.length - 1];
      const distinct = new Set<StatementBasis>([...bases, ...(explicitBasis.has(c.symbol) ? [c.statement_basis] : [])]);
      if (distinct.size > 1) {
        issues.push(makeIssue("warning", "W106_BASIS_CHANGE",
          `${c.symbol}: the statement basis changes between years (${[...distinct].join(" and ")}). Figures from different bases are not comparable; ${c.statement_basis} is recorded for the company.`,
          { symbol: c.symbol, field: "statement_basis" }));
      }
    }
  }

  const [firstMeta, ...moreMetas] = canonicalMetas;
  const meta: DatasetMeta = firstMeta
    ? {
      ...firstMeta,
      files: [...firstMeta.files, ...moreMetas.flatMap((m) => m.files)],
      notes: [...firstMeta.notes, ...moreMetas.flatMap((m) => m.notes)],
    }
    : defaultMeta(files.length === 1 ? baseName(files[0].name) : "Imported data", "user_import");
  const recognised = outFiles.filter((x): x is { name: string; kind: ImportFileKind; rows: number } => x.kind !== "unknown" && x.kind !== "canonical_json");
  if (recognised.length) meta.files = [...meta.files, ...recognised.map((x) => ({ name: x.name, kind: x.kind, rows: x.rows }))];
  if (synthetic && !meta.isSynthetic) {
    meta.isSynthetic = true;
    meta.notes = [...meta.notes, "The files describe themselves as fictional sample data."];
  }
  if (scale !== "crore") {
    if (wideFiles > 0) meta.notes = [...meta.notes, `Amounts were converted from ${MONEY_SCALE_LABEL[scale]} to ₹ crore on import.`];
    if (otherFiles > 0) {
      issues.push(makeIssue("info", "I002_SCALE_SCOPE", `The unit choice (${MONEY_SCALE_LABEL[scale]}) applies to CSV statement files only. Dataset JSON and snapshot files are read as ₹ crore.`));
    }
  }

  const dataset: FundamentalsDataset = { schema: DATASET_SCHEMA, version: DATASET_VERSION, meta, companies: [...companies.values()] };
  if (dataset.companies.length === 0 && !issues.some((i) => i.level === "error")) {
    issues.push(makeIssue("error", "E002_NO_COMPANIES",
      unknownSymbols.size
        ? "No usable companies were found. Statement files need a company list (companies.csv) or a dataset file that names each symbol."
        : "No usable companies were found in the files."));
  }
  if (dataset.companies.length > 0) issues.push(...validateDataset(dataset));

  const report = buildReport(dataset.companies.length ? dataset : null, limitIssues(issues), unknownSymbols.size);
  return { dataset: report.ok ? dataset : null, report, files: outFiles };
}
