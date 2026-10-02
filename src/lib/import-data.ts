// Parse user-supplied fundamentals (CSV or JSON) into StockRow[]. Pure and UI-free.
// Format reference: docs/data-format.md

import { METRICS, type StockRow } from "./data-provider";

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

export const MAX_IMPORT_ROWS = 20000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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
const NUMBER_FIELDS = METRICS.map((m) => m.key);

const ALIASES: Record<string, keyof StockRow> = { ...EXTRA_ALIASES };
for (const k of [...TEXT_FIELDS, ...NUMBER_FIELDS]) ALIASES[norm(k)] = k;
// Display labels used by the CSV exporter, e.g. "Market Cap (₹ Cr)"
for (const m of METRICS) ALIASES[norm(m.label)] = m.key;
ALIASES[norm("Market Cap (₹ Cr)")] = "market_cap";

/** Minimal RFC-4180 CSV parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCSV(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) out.push(row);
  return out;
}

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

function buildRows(records: Record<string, unknown>[]): ImportResult {
  const issues: ImportIssue[] = [];
  const bySymbol = new Map<string, StockRow>();

  if (records.length > MAX_IMPORT_ROWS) {
    issues.push({ row: 0, level: "error", message: `Too many rows (${records.length}). The limit is ${MAX_IMPORT_ROWS}.` });
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
    issues.push({ row: 0, level: "error", message: 'Missing required column "symbol" (aliases: ticker, code).' });
    return { rows: [], issues };
  }
  if (unknown.length) issues.push({ row: 0, level: "warning", message: `Ignored unrecognised columns: ${unknown.join(", ")}.` });
  const absent = NUMBER_FIELDS.filter((f) => !mapped.has(f));
  if (absent.length) issues.push({ row: 0, level: "warning", message: `No data for: ${absent.join(", ")}. Those filters will exclude every company.` });

  records.forEach((rec, idx) => {
    const rowNo = idx + 1;
    const mappedRec: Partial<Record<keyof StockRow, unknown>> = {};
    for (const [k, v] of Object.entries(rec)) {
      const target = ALIASES[norm(k)];
      if (target) mappedRec[target] = v;
    }

    const symbol = String(mappedRec.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      issues.push({ row: rowNo, level: "error", message: "Row skipped: empty symbol." });
      return;
    }

    const row = { symbol } as StockRow;
    row.name = String(mappedRec.name ?? "").trim() || symbol;
    row.sector = String(mappedRec.sector ?? "").trim();
    row.industry = String(mappedRec.industry ?? "").trim();

    for (const f of NUMBER_FIELDS) {
      const n = parseNumber(mappedRec[f]);
      if (n === undefined) {
        issues.push({ row: rowNo, level: "warning", message: `${symbol}: "${String(mappedRec[f])}" is not a number for ${f}; treated as missing.` });
        row[f] = NaN;
      } else row[f] = n;
    }

    if (bySymbol.has(symbol)) issues.push({ row: rowNo, level: "warning", message: `Duplicate symbol ${symbol}; the later row replaces the earlier one.` });
    bySymbol.set(symbol, row);
  });

  const rows = [...bySymbol.values()];
  if (rows.length === 0 && !issues.some((i) => i.level === "error")) {
    issues.push({ row: 0, level: "error", message: "No data rows found." });
  }
  return { rows, issues };
}

export function parseFundamentalsCSV(text: string): ImportResult {
  const table = parseCSV(text);
  if (table.length < 1) return { rows: [], issues: [{ row: 0, level: "error", message: "The file is empty." }] };
  const [header, ...body] = table;
  const records = body.map((cells) => {
    const rec: Record<string, unknown> = {};
    header.forEach((h, i) => { rec[h.trim()] = cells[i] ?? ""; });
    return rec;
  });
  return buildRows(records);
}

export function parseFundamentalsJSON(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { rows: [], issues: [{ row: 0, level: "error", message: `Invalid JSON: ${(e as Error).message}` }] };
  }
  const list = Array.isArray(data) ? data : (data as { rows?: unknown })?.rows;
  if (!Array.isArray(list) || list.some((x) => typeof x !== "object" || x === null || Array.isArray(x))) {
    return { rows: [], issues: [{ row: 0, level: "error", message: 'Expected an array of objects, or { "rows": [ … ] }.' }] };
  }
  return buildRows(list as Record<string, unknown>[]);
}

/** Pick the parser from the file name / content. */
export function parseFundamentals(text: string, fileName = ""): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { rows: [], issues: [{ row: 0, level: "error", message: "File is larger than 5 MB." }] };
  }
  const looksJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(text);
  return looksJson ? parseFundamentalsJSON(text) : parseFundamentalsCSV(text);
}
