// src/lib/data/import/snapshot.ts — the legacy one-row-per-company snapshot import (WS1).
// Behaviour is identical to the original src/lib/import-data.ts (its tests run unchanged); the
// importer pipeline additionally receives a stable issue code for each message.
import type { LegacyNumericKey, StockRow } from "@/lib/contracts";
import { parseCsvTable } from "./csv";

export interface ImportIssue {
  /** 1-based data row number (header excluded); 0 = file-level */
  row: number;
  message: string;
  level: "error" | "warning";
}

export interface ImportResult {
  rows: StockRow[];
  issues: ImportIssue[];
}

/** An ImportIssue with the code the import report uses. */
export interface CodedImportIssue extends ImportIssue {
  code: string;
  field: string | null;
  symbol: string | null;
}

export interface CodedImportResult {
  rows: StockRow[];
  issues: CodedImportIssue[];
}

export const MAX_IMPORT_ROWS = 20000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Legacy metric keys and labels, in the order of the original METRICS list. */
export const LEGACY_METRICS: readonly { key: LegacyNumericKey; label: string }[] = [
  { key: "market_cap", label: "Market Cap" },
  { key: "price", label: "Price" },
  { key: "pe", label: "P/E Ratio" },
  { key: "eps", label: "EPS" },
  { key: "price_book", label: "Price/Book" },
  { key: "fcf_yield", label: "FCF Yield" },
  { key: "dividend_yield", label: "Dividend Yield" },
  { key: "roce", label: "ROCE" },
  { key: "roe", label: "ROE" },
  { key: "debt_equity", label: "Debt/Equity" },
  { key: "debt_ebitda", label: "Debt/EBITDA" },
  { key: "sales_growth", label: "Sales Growth" },
  { key: "profit_growth", label: "Profit Growth" },
];

// Normalised header -> StockRow key. Canonical names are added automatically below.
const EXTRA_ALIASES: Record<string, keyof StockRow> = {
  ticker: "symbol", nsecode: "symbol", code: "symbol",
  company: "name", companyname: "name",
  mcap: "market_cap", mcapcr: "market_cap",
  cmp: "price", close: "price", lastprice: "price",
  peratio: "pe", pricetoearnings: "pe",
  pb: "price_book", pbratio: "price_book", pricetobook: "price_book",
  de: "debt_equity", debttoequity: "debt_equity",
  debttoebitda: "debt_ebitda",
  divyield: "dividend_yield",
  revenuegrowth: "sales_growth",
  patgrowth: "profit_growth", earningsgrowth: "profit_growth",
  freecashflowyield: "fcf_yield",
};

const TEXT_FIELDS = ["symbol", "name", "sector", "industry"] as const;
const NUMBER_FIELDS: readonly LegacyNumericKey[] = LEGACY_METRICS.map((m) => m.key);

const ALIASES: Record<string, keyof StockRow> = { ...EXTRA_ALIASES };
for (const k of [...TEXT_FIELDS, ...NUMBER_FIELDS]) ALIASES[norm(k)] = k;
// Display labels used by the CSV exporter, e.g. "Market Cap (₹ Cr)"
for (const m of LEGACY_METRICS) ALIASES[norm(m.label)] = m.key;
ALIASES[norm("Market Cap (₹ Cr)")] = "market_cap";

const MISSING = new Set(["", "-", "—", "na", "n/a", "nan", "null", "none"]);

/** "1,234.5", "12%", "₹ 99" -> number; blank/NA -> NaN (missing); junk -> undefined (invalid). */
function parseNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (MISSING.has(s.toLowerCase())) return NaN;
  const n = Number(s.replace(/[,%₹\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function coded(
  row: number, level: ImportIssue["level"], code: string, message: string, field: string | null = null, symbol: string | null = null,
): CodedImportIssue {
  return { row, level, message, code, field, symbol };
}

/** Limits for one call; the legacy defaults are 20,000 rows. */
export interface SnapshotLimits {
  maxRows: number;
}

export function buildSnapshotRows(records: Record<string, unknown>[], limits: SnapshotLimits = { maxRows: MAX_IMPORT_ROWS }): CodedImportResult {
  const issues: CodedImportIssue[] = [];
  const bySymbol = new Map<string, StockRow>();

  if (records.length > limits.maxRows) {
    issues.push(coded(0, "error", "E004_TOO_LARGE", `Too many rows (${records.length}). The limit is ${limits.maxRows}.`));
    return { rows: [], issues };
  }

  // Which columns are recognised?
  const first = records[0] ?? {};
  const mapped = new Set<string>();
  const unknown: string[] = [];
  for (const key of Object.keys(first)) {
    const target = ALIASES[norm(key)];
    if (target) mapped.add(target); else unknown.push(key);
  }
  if (records.length && !mapped.has("symbol")) {
    issues.push(coded(0, "error", "E001_NO_SYMBOL", 'Missing required column "symbol" (aliases: ticker, code).', "symbol"));
    return { rows: [], issues };
  }
  if (unknown.length) issues.push(coded(0, "warning", "W112_UNKNOWN_COLUMN", `Ignored unrecognised columns: ${unknown.join(", ")}.`));
  const absent = NUMBER_FIELDS.filter((f) => !mapped.has(f));
  if (absent.length) issues.push(coded(0, "warning", "W119_COLUMN_ABSENT", `No data for: ${absent.join(", ")}. Those filters will exclude every company.`));

  records.forEach((rec, idx) => {
    const rowNo = idx + 1;
    const mappedRec: Partial<Record<keyof StockRow, unknown>> = {};
    for (const [k, v] of Object.entries(rec)) {
      const target = ALIASES[norm(k)];
      if (target) mappedRec[target] = v;
    }

    const symbol = String(mappedRec.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      issues.push(coded(rowNo, "error", "E008_EMPTY_SYMBOL", "Row skipped: empty symbol.", "symbol"));
      return;
    }

    const row = { symbol } as StockRow;
    row.name = String(mappedRec.name ?? "").trim() || symbol;
    row.sector = String(mappedRec.sector ?? "").trim();
    row.industry = String(mappedRec.industry ?? "").trim();

    for (const f of NUMBER_FIELDS) {
      const n = parseNumber(mappedRec[f]);
      if (n === undefined) {
        issues.push(coded(rowNo, "warning", "W111_NOT_A_NUMBER", `${symbol}: "${String(mappedRec[f])}" is not a number for ${f}; treated as missing.`, f, symbol));
        row[f] = NaN;
      } else row[f] = n;
    }

    if (bySymbol.has(symbol)) issues.push(coded(rowNo, "warning", "W114_DUPLICATE_COMPANY", `Duplicate symbol ${symbol}; the later row replaces the earlier one.`, "symbol", symbol));
    bySymbol.set(symbol, row);
  });

  const rows = [...bySymbol.values()];
  if (rows.length === 0 && !issues.some((i) => i.level === "error")) {
    issues.push(coded(0, "error", "E002_NO_COMPANIES", "No data rows found."));
  }
  return { rows, issues };
}

function uncoded(r: CodedImportResult): ImportResult {
  return { rows: r.rows, issues: r.issues.map((i) => ({ row: i.row, level: i.level, message: i.message })) };
}

/** Header row + data rows → records keyed by the header text. */
export function tableToRecords(table: readonly string[][]): Record<string, unknown>[] {
  const [header, ...body] = table;
  return body.map((cells) => {
    const rec: Record<string, unknown> = {};
    header.forEach((h, i) => { rec[h.trim()] = cells[i] ?? ""; });
    return rec;
  });
}

export function parseSnapshotCsvCoded(text: string, o: { comments?: boolean; limits?: SnapshotLimits } = {}): CodedImportResult {
  const table = parseCsvTable(text, { comments: o.comments ?? false }).rows;
  if (table.length < 1) return { rows: [], issues: [coded(0, "error", "E002_NO_COMPANIES", "The file is empty.")] };
  return buildSnapshotRows(tableToRecords(table), o.limits);
}

export function parseSnapshotJsonValueCoded(data: unknown, limits?: SnapshotLimits): CodedImportResult {
  const list = Array.isArray(data) ? data : (data as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(list) || list.some((x) => typeof x !== "object" || x === null || Array.isArray(x))) {
    return { rows: [], issues: [coded(0, "error", "E005_BAD_SHAPE", 'Expected an array of objects, or { "rows": [ … ] }.')] };
  }
  return buildSnapshotRows(list as Record<string, unknown>[], limits);
}

export function parseFundamentalsCSV(text: string): ImportResult {
  return uncoded(parseSnapshotCsvCoded(text));
}

export function parseFundamentalsJSON(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { rows: [], issues: [{ row: 0, level: "error", message: `Invalid JSON: ${(e as Error).message}` }] };
  }
  return uncoded(parseSnapshotJsonValueCoded(data));
}

/** Pick the parser from the file name / content. */
export function parseFundamentals(text: string, fileName = ""): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { rows: [], issues: [{ row: 0, level: "error", message: "File is larger than 5 MB." }] };
  }
  const looksJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(text);
  return looksJson ? parseFundamentalsJSON(text) : parseFundamentalsCSV(text);
}
