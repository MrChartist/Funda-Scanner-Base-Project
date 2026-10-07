// src/lib/data/import/wide-csv.ts — companies.csv, annual.csv, quarterly.csv and shareholding.csv (WS1).
// One row per company (companies) or per company-period (statements). Files are joined by symbol
// in import/index.ts. Cells are data only; numbers are read leniently and never invented.
import type {
  AnnualField, AnnualRow, CompanyType, ISODate, QuarterField, QuarterRow, ShareholdingField, ShareholdingRow,
  StatementBasis,
} from "@/lib/contracts";
import { LEGACY_KEY_TO_METRIC } from "@/lib/contracts";
import { fiscalYearOf, fyLabel, parseIsoDate } from "@/lib/time/civil";
import {
  emptyAnnualRow, emptyQuarterRow, emptyShareholdingRow, makeIssue, normalizeSymbol, readBasis, readCompanyType,
  readDate, readFiscalYear, readFlags, readMonth, type IssueSink,
} from "../normalize";
import { parseCsvTable, readNumberCell, readTextCell } from "./csv";
import {
  ANNUAL_ALIASES, COMPANY_ALIASES_TABLE, QUARTER_ALIASES, SHAREHOLDING_ALIASES, resolveHeader, type AliasTable,
  type AnnualExtraColumn, type CompanyColumn, type IdentityColumn,
} from "./aliases";
import { scaleAnnualRow, scaleMoney, scaleQuarterRow, type MoneyScale } from "./units";

export type WideKind = "companies" | "annual" | "quarterly" | "shareholding";

/** Largest number of data rows read from one CSV file (E004). */
export const MAX_CSV_ROWS = 200_000;

/** Values a companies file supplied for one symbol; absent keys were not supplied. */
export interface CompanyPartial {
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string;
  isin?: string;
  company_type?: CompanyType;
  statement_basis?: StatementBasis;
  fy_end_month?: number;
  price?: number;
  price_date?: ISODate;
  shares_outstanding?: number;
  face_value?: number;
  market_cap_supplied?: number;
  source_note?: string;
  sample_note?: string;
  snapshot: Record<string, number>;
}

export interface AnnualEntry { symbol: string; row: AnnualRow; basis: StatementBasis | null; rowNo: number }
export interface QuarterEntry { symbol: string; row: QuarterRow; rowNo: number }
export interface ShareholdingEntry { symbol: string; row: ShareholdingRow; rowNo: number }

export interface WideParse {
  kind: WideKind;
  /** Data rows read (header and comment lines excluded). */
  rows: number;
  comments: string[];
  companies: CompanyPartial[];
  annual: AnnualEntry[];
  quarterly: QuarterEntry[];
  shareholding: ShareholdingEntry[];
}

export interface WideOptions {
  moneyScale?: MoneyScale;
  maxRows?: number;
  /** Fiscal-year end month per symbol, used to derive a fiscal year from a period end. */
  fyEndMonthOf?: (symbol: string) => number;
}

function emptyParse(kind: WideKind): WideParse {
  return { kind, rows: 0, comments: [], companies: [], annual: [], quarterly: [], shareholding: [] };
}

const TABLES: Readonly<Record<WideKind, AliasTable<string>>> = {
  companies: COMPANY_ALIASES_TABLE,
  annual: ANNUAL_ALIASES,
  quarterly: QUARTER_ALIASES,
  shareholding: SHAREHOLDING_ALIASES,
};

interface RowCtx {
  sink: IssueSink;
  rowNo: number;
  symbol: string;
  period: string | null;
}

function warn(ctx: RowCtx, code: string, message: string, field: string | null): void {
  ctx.sink.issues.push(makeIssue("warning", code, message, {
    file: ctx.sink.file, row: ctx.rowNo, symbol: ctx.symbol, period: ctx.period, field,
  }));
}

function num(raw: string | undefined, ctx: RowCtx, field: string): number | null {
  const r = readNumberCell(raw);
  if (r.ok) return r.v;
  warn(ctx, "W111_NOT_A_NUMBER", `Row ${ctx.rowNo}: "${r.text}" is not a number for ${field} (${ctx.symbol}); treated as not provided.`, field);
  return null;
}

/**
 * Parses one wide CSV file. Reports E001 (no symbol column), E004 (too many rows), W112 (unknown
 * columns), W111 (unreadable numbers), W117 (unreadable dates), W113/W114 (duplicates within the
 * file, the later row wins) and W120 (rows without a symbol).
 */
export function parseWideCsv(kind: WideKind, text: string, sink: IssueSink, o: WideOptions = {}): WideParse {
  const out = emptyParse(kind);
  const scale = o.moneyScale ?? "crore";
  const table = parseCsvTable(text, { comments: true });
  out.comments = table.comments;
  const [header, ...body] = table.rows;
  out.rows = body.length;
  if (!header) {
    sink.issues.push(makeIssue("error", "E002_NO_COMPANIES", `"${sink.file}" has no header row and no data.`, { file: sink.file }));
    return out;
  }
  const maxRows = o.maxRows ?? MAX_CSV_ROWS;
  if (body.length > maxRows) {
    sink.issues.push(makeIssue("error", "E004_TOO_LARGE", `"${sink.file}" has ${body.length} rows. The limit is ${maxRows} rows per CSV file.`, { file: sink.file }));
    return out;
  }

  // Map columns
  const aliasTable = TABLES[kind];
  const columns: (string | null)[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];
  const duplicate: string[] = [];
  for (const h of header) {
    const target = h.trim() ? resolveHeader(aliasTable, h) : null;
    if (target === null) {
      if (h.trim()) unknown.push(h.trim());
      columns.push(null);
    } else if (seen.has(target)) {
      duplicate.push(h.trim());
      columns.push(null);
    } else {
      seen.add(target);
      columns.push(target);
    }
  }
  if (!seen.has("symbol")) {
    sink.issues.push(makeIssue("error", "E001_NO_SYMBOL", `"${sink.file}" has no symbol column. Add a column named "symbol" (or ticker).`, { file: sink.file, field: "symbol" }));
    return out;
  }
  if (kind === "annual" && !seen.has("fiscal_year") && !seen.has("period_end")) {
    sink.issues.push(makeIssue("error", "E007_NO_PERIOD", `"${sink.file}" has no fiscal_year column, so its rows cannot be placed in years.`, { file: sink.file, field: "fiscal_year" }));
    return out;
  }
  if ((kind === "quarterly" || kind === "shareholding") && !seen.has("period_end")) {
    sink.issues.push(makeIssue("error", "E007_NO_PERIOD", `"${sink.file}" has no period_end column, so its rows cannot be placed in quarters.`, { file: sink.file, field: "period_end" }));
    return out;
  }
  if (unknown.length) {
    sink.issues.push(makeIssue("warning", "W112_UNKNOWN_COLUMN", `"${sink.file}": these columns are not recognised and were ignored: ${unknown.join(", ")}.`, { file: sink.file }));
  }
  if (duplicate.length) {
    sink.issues.push(makeIssue("warning", "W112_UNKNOWN_COLUMN", `"${sink.file}": these columns repeat an earlier column and were ignored: ${duplicate.join(", ")}.`, { file: sink.file }));
  }

  const companyIndex = new Map<string, number>();
  const periodIndex = new Map<string, number>();

  body.forEach((cells, k) => {
    const rowNo = k + 1;
    const cell: Record<string, string> = {};
    columns.forEach((col, i) => {
      if (col) cell[col] = cells[i] ?? "";
    });
    const symbol = normalizeSymbol(cell.symbol);
    if (!symbol) {
      sink.issues.push(makeIssue("warning", "W120_EMPTY_SYMBOL", `Row ${rowNo} has no symbol and was skipped.`, { file: sink.file, row: rowNo, field: "symbol" }));
      return;
    }
    const ctx: RowCtx = { sink, rowNo, symbol, period: null };

    if (kind === "companies") {
      const p = companyRow(cell, ctx, scale);
      const prev = companyIndex.get(symbol);
      if (prev !== undefined) {
        warn(ctx, "W114_DUPLICATE_COMPANY", `Row ${rowNo}: ${symbol} appears more than once; the later row is used.`, "symbol");
        out.companies[prev] = p;
      } else {
        companyIndex.set(symbol, out.companies.length);
        out.companies.push(p);
      }
      return;
    }

    if (kind === "annual") {
      const entry = annualRow(cell, ctx, scale, o.fyEndMonthOf?.(symbol) ?? 3);
      if (!entry) return;
      const key = `${symbol}|${entry.row.fiscal_year}`;
      const prev = periodIndex.get(key);
      if (prev !== undefined) {
        warn({ ...ctx, period: fyLabel(entry.row.fiscal_year) }, "W113_DUPLICATE_PERIOD", `Row ${rowNo}: ${symbol} ${fyLabel(entry.row.fiscal_year)} appears more than once; the later row is used.`, "fiscal_year");
        out.annual[prev] = entry;
      } else {
        periodIndex.set(key, out.annual.length);
        out.annual.push(entry);
      }
      return;
    }

    const periodEnd = readDate(cell.period_end);
    if (!periodEnd) {
      warn(ctx, "W117_BAD_DATE", `Row ${rowNo}: "${cell.period_end ?? ""}" is not a readable period end for ${symbol}; the row was skipped.`, "period_end");
      return;
    }
    const pctx = { ...ctx, period: periodEnd };
    const key = `${symbol}|${periodEnd}`;
    const prev = periodIndex.get(key);
    if (kind === "quarterly") {
      const row = emptyQuarterRow(periodEnd);
      for (const f of Object.keys(row) as (keyof QuarterRow)[]) {
        if (f === "period_end") continue;
        row[f as QuarterField] = num(cell[f], pctx, f);
      }
      scaleQuarterRow(row, scale);
      const entry: QuarterEntry = { symbol, row, rowNo };
      if (prev !== undefined) {
        warn(pctx, "W113_DUPLICATE_PERIOD", `Row ${rowNo}: ${symbol} ${periodEnd} appears more than once; the later row is used.`, "period_end");
        out.quarterly[prev] = entry;
      } else {
        periodIndex.set(key, out.quarterly.length);
        out.quarterly.push(entry);
      }
    } else {
      const row = emptyShareholdingRow(periodEnd);
      for (const f of Object.keys(row) as (keyof ShareholdingRow)[]) {
        if (f === "period_end") continue;
        row[f as ShareholdingField] = num(cell[f], pctx, f);
      }
      const entry: ShareholdingEntry = { symbol, row, rowNo };
      if (prev !== undefined) {
        warn(pctx, "W113_DUPLICATE_PERIOD", `Row ${rowNo}: ${symbol} ${periodEnd} appears more than once; the later row is used.`, "period_end");
        out.shareholding[prev] = entry;
      } else {
        periodIndex.set(key, out.shareholding.length);
        out.shareholding.push(entry);
      }
    }
  });
  return out;
}

function companyRow(cell: Record<string, string>, ctx: RowCtx, scale: MoneyScale): CompanyPartial {
  const p: CompanyPartial = { symbol: ctx.symbol, snapshot: {} };
  const text = (k: CompanyColumn) => readTextCell(cell[k]);
  const name = text("name");
  if (name !== null) p.name = name;
  const sector = text("sector");
  if (sector !== null) p.sector = sector;
  const industry = text("industry");
  if (industry !== null) p.industry = industry;
  const isin = text("isin");
  if (isin !== null) p.isin = isin.toUpperCase();
  const source = text("source_note");
  if (source !== null) p.source_note = source;
  const note = text("sample_note");
  if (note !== null) p.sample_note = note;

  if (cell.company_type !== undefined) {
    const t = readCompanyType(cell.company_type);
    if (t === undefined) warn(ctx, "W118_BAD_VALUE", `Row ${ctx.rowNo}: company type "${cell.company_type}" is not recognised for ${ctx.symbol}; it will be inferred.`, "company_type");
    else if (t !== null) p.company_type = t;
  }
  if (cell.statement_basis !== undefined) {
    const b = readBasis(cell.statement_basis);
    if (b === undefined) warn(ctx, "W118_BAD_VALUE", `Row ${ctx.rowNo}: statement basis "${cell.statement_basis}" is not recognised for ${ctx.symbol}; consolidated is assumed.`, "statement_basis");
    else if (b !== null) p.statement_basis = b;
  }
  if (cell.fy_end_month !== undefined) {
    const m = readMonth(cell.fy_end_month);
    if (m === undefined) warn(ctx, "W118_BAD_VALUE", `Row ${ctx.rowNo}: year-end month "${cell.fy_end_month}" is not recognised for ${ctx.symbol}; March is assumed.`, "fy_end_month");
    else if (m !== null) p.fy_end_month = m;
  }
  if (cell.price_date !== undefined) {
    const d = readDate(cell.price_date);
    if (d === undefined) warn(ctx, "W117_BAD_DATE", `Row ${ctx.rowNo}: price date "${cell.price_date}" is not a date for ${ctx.symbol}; treated as not provided.`, "price_date");
    else if (d !== null) p.price_date = d;
  }
  const setNum = (col: CompanyColumn, key: "price" | "shares_outstanding" | "face_value" | "market_cap_supplied") => {
    if (cell[col] === undefined) return;
    const v = num(cell[col], ctx, col);
    if (v !== null) p[key] = key === "market_cap_supplied" ? (scaleMoney(v, scale) as number) : v;
  };
  setNum("price", "price");
  setNum("shares_outstanding", "shares_outstanding");
  setNum("face_value", "face_value");
  setNum("market_cap", "market_cap_supplied");
  for (const [col, raw] of Object.entries(cell)) {
    if (!col.startsWith("snapshot:")) continue;
    const legacyKey = col.slice("snapshot:".length);
    const id = (LEGACY_KEY_TO_METRIC as Readonly<Record<string, string>>)[legacyKey] ?? legacyKey;
    const v = num(raw, ctx, id);
    if (v !== null) p.snapshot[id] = v;
  }
  return p;
}

function annualRow(cell: Record<string, string>, ctx: RowCtx, scale: MoneyScale, fyEndMonth: number): AnnualEntry | null {
  let fy = readFiscalYear(cell.fiscal_year);
  if (fy === undefined) {
    warn(ctx, "W117_BAD_DATE", `Row ${ctx.rowNo}: "${cell.fiscal_year}" is not a readable fiscal year for ${ctx.symbol}; the row was skipped.`, "fiscal_year");
    return null;
  }
  const periodEnd = readDate(cell.period_end);
  if (periodEnd === undefined) {
    warn(ctx, "W117_BAD_DATE", `Row ${ctx.rowNo}: period end "${cell.period_end}" is not a date for ${ctx.symbol}; treated as not provided.`, "period_end");
  }
  if (fy === null && periodEnd) {
    const p = parseIsoDate(periodEnd);
    if (p) fy = fiscalYearOf(p.y, p.m, fyEndMonth);
  }
  if (fy === null) {
    warn(ctx, "W117_BAD_DATE", `Row ${ctx.rowNo}: ${ctx.symbol} has no fiscal year; the row was skipped.`, "fiscal_year");
    return null;
  }
  const period = fyLabel(fy);
  const rctx = { ...ctx, period };
  const row = emptyAnnualRow(fy, periodEnd ?? null);
  for (const f of Object.keys(row) as (keyof AnnualRow)[]) {
    if (f === "fiscal_year" || f === "period_end" || f === "flags") continue;
    row[f as AnnualField] = num(cell[f], rctx, f);
  }
  const extra = (k: AnnualExtraColumn | IdentityColumn) => cell[k];
  if (extra("flags") !== undefined) {
    const { flags, unknown } = readFlags(extra("flags"));
    row.flags = flags;
    if (unknown.length) warn(rctx, "W118_BAD_VALUE", `Row ${ctx.rowNo}: unknown period flag(s) ${unknown.join(", ")} were ignored. Use "restated" or "transition".`, "flags");
  }
  let basis: StatementBasis | null = null;
  if (extra("statement_basis") !== undefined) {
    const b = readBasis(extra("statement_basis"));
    if (b === undefined) warn(rctx, "W118_BAD_VALUE", `Row ${ctx.rowNo}: statement basis "${extra("statement_basis")}" is not recognised.`, "statement_basis");
    else basis = b;
  }
  scaleAnnualRow(row, scale);
  return { symbol: ctx.symbol, row, basis, rowNo: ctx.rowNo };
}
