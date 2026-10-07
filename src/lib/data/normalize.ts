// src/lib/data/normalize.ts — turns loosely shaped company data into canonical records (WS1).
//
// Rules (§E.3): every series sorted ascending; NaN, blank, "-" and "NA" become null; symbols
// upper-cased; duplicate periods removed (the later one wins, with a warning); defaults filled
// (consolidated basis, March year end); every key present. Nothing is ever invented: a value
// that cannot be read becomes null with a warning, never 0.
import type {
  AnnualRow, CompanyRecord, CompanyType, DatasetMeta, DatasetSource, FundamentalsDataset, ImportFileKind, ISODate,
  MarketInputs, PeriodFlag, QuarterRow, ShareholdingRow, StatementBasis, ValidationIssue,
} from "@/lib/contracts";
import {
  ANNUAL_FIELDS, DATASET_SCHEMA, DATASET_VERSION, LEGACY_KEY_TO_METRIC, MAX_ANNUAL_SLOTS, MAX_QUARTER_SLOTS,
  MAX_SHAREHOLDING_SLOTS, QUARTER_FIELDS, QUARTER_MATCH_TOLERANCE_DAYS, SHAREHOLDING_FIELDS,
} from "@/lib/contracts";
import {
  addMonths, daysFromCivil, daysInMonth, fiscalYearOf, fyLabel, formatIsoDate, parseIsoDate,
} from "@/lib/time/civil";
import { readNumberCell, readTextCell } from "./import/csv";

// ── issues ──────────────────────────────────────────────────────────────────
export interface IssueSink {
  file: string | null;
  issues: ValidationIssue[];
}

export function makeIssue(
  level: ValidationIssue["level"], code: string, message: string, extra: Partial<Omit<ValidationIssue, "level" | "code" | "message">> = {},
): ValidationIssue {
  return { level, code, message, file: null, row: null, symbol: null, period: null, field: null, ...extra };
}

function push(sink: IssueSink, level: ValidationIssue["level"], code: string, message: string, extra: Partial<ValidationIssue> = {}): void {
  sink.issues.push(makeIssue(level, code, message, { file: sink.file, ...extra }));
}

// ── scalar readers ──────────────────────────────────────────────────────────
const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

function isoOrNull(y: number, m: number, d: number): ISODate | null {
  if (!Number.isInteger(y) || y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return formatIsoDate({ y, m, d });
}

/**
 * Reads a calendar date. Accepts "2026-03-31", "31-03-2026", "31/03/2026" (day first, the Indian
 * convention), "31 Mar 2026", and a month alone ("Mar 2026", "2026-03"), which means the month end.
 * Returns undefined when the text is present but unreadable, null when blank.
 */
export function readDate(raw: unknown): ISODate | null | undefined {
  const s = readTextCell(raw);
  if (s === null) return null;
  const t = s.trim();
  if (parseIsoDate(t)) return t;
  let m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) return isoOrNull(Number(m[3]), Number(m[2]), Number(m[1])) ?? undefined;
  m = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]*(\d{4})$/.exec(t);
  if (m && MONTHS[m[2].toLowerCase()]) return isoOrNull(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1])) ?? undefined;
  m = /^([A-Za-z]{3,9})[-\s,]*(\d{4})$/.exec(t);
  if (m && MONTHS[m[1].toLowerCase()]) {
    const y = Number(m[2]);
    const mo = MONTHS[m[1].toLowerCase()];
    return isoOrNull(y, mo, daysInMonth(y, mo)) ?? undefined;
  }
  m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? isoOrNull(y, mo, daysInMonth(y, mo)) ?? undefined : undefined;
  }
  return undefined;
}

/** "2026", 2026, "FY26", "FY2026", "2025-26", "2025-2026" → 2026. Undefined when unreadable, null when blank. */
export function readFiscalYear(raw: unknown): number | null | undefined {
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 1900 && raw <= 2200 ? raw : undefined;
  const s = readTextCell(raw);
  if (s === null) return null;
  const t = s.replace(/\s+/g, "").toUpperCase();
  let m = /^(?:FY)?(\d{4})$/.exec(t);
  if (m) {
    const y = Number(m[1]);
    return y >= 1900 && y <= 2200 ? y : undefined;
  }
  m = /^FY(\d{2})$/.exec(t);
  if (m) return 2000 + Number(m[1]);
  m = /^(?:FY)?(\d{4})[-/](\d{2}|\d{4})$/.exec(t);
  if (m) {
    const start = Number(m[1]);
    const end = m[2].length === 2 ? Math.floor(start / 100) * 100 + Number(m[2]) + (Number(m[2]) < start % 100 ? 100 : 0) : Number(m[2]);
    return end === start + 1 ? end : undefined;
  }
  return undefined;
}

const TYPE_WORDS: Readonly<Record<string, CompanyType>> = {
  nonfinancial: "non_financial", nf: "non_financial", industrial: "non_financial", corporate: "non_financial",
  bank: "bank", banks: "bank", banking: "bank",
  nbfc: "nbfc", hfc: "nbfc", housingfinance: "nbfc", lender: "nbfc",
  insurance: "insurance", insurer: "insurance",
  otherfinancial: "other_financial", otherfinancials: "other_financial",
};

/** Company type from free text; undefined when present but not recognised. */
export function readCompanyType(raw: unknown): CompanyType | null | undefined {
  const s = readTextCell(raw);
  if (s === null) return null;
  return TYPE_WORDS[s.toLowerCase().replace(/[^a-z]/g, "")];
}

export function readBasis(raw: unknown): StatementBasis | null | undefined {
  const s = readTextCell(raw);
  if (s === null) return null;
  const t = s.toLowerCase().replace(/[^a-z]/g, "");
  if (t === "consolidated" || t === "cons" || t === "consol") return "consolidated";
  if (t === "standalone" || t === "sa" || t === "stand") return "standalone";
  return undefined;
}

export function readMonth(raw: unknown): number | null | undefined {
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : undefined;
  const s = readTextCell(raw);
  if (s === null) return null;
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 12 ? n : undefined;
  }
  return MONTHS[s.toLowerCase()];
}

const PERIOD_FLAGS: readonly PeriodFlag[] = ["restated", "transition"];

export function readFlags(raw: unknown): { flags: PeriodFlag[]; unknown: string[] } {
  const parts: string[] = Array.isArray(raw)
    ? raw.map((x) => String(x))
    : (readTextCell(raw) ?? "").split(/[;|,\s]+/);
  const flags: PeriodFlag[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const t = p.trim().toLowerCase();
    if (!t) continue;
    const f = PERIOD_FLAGS.find((x) => x === t);
    if (f) {
      if (!flags.includes(f)) flags.push(f);
    } else unknown.push(p.trim());
  }
  return { flags, unknown };
}

// ── empty shapes ────────────────────────────────────────────────────────────
export function emptyAnnualRow(fiscalYear: number, periodEnd: ISODate | null = null): AnnualRow {
  const row = { fiscal_year: fiscalYear, period_end: periodEnd, flags: [] } as unknown as AnnualRow;
  for (const f of ANNUAL_FIELDS) row[f] = null;
  return row;
}

export function emptyQuarterRow(periodEnd: ISODate): QuarterRow {
  const row = { period_end: periodEnd } as QuarterRow;
  for (const f of QUARTER_FIELDS) row[f] = null;
  return row;
}

export function emptyShareholdingRow(periodEnd: ISODate): ShareholdingRow {
  const row = { period_end: periodEnd } as ShareholdingRow;
  for (const f of SHAREHOLDING_FIELDS) row[f] = null;
  return row;
}

export function emptyMarket(): MarketInputs {
  return { price: null, price_date: null, shares_outstanding: null, face_value: null, market_cap_supplied: null };
}

export function emptyCompany(symbol: string): CompanyRecord {
  return {
    symbol, name: symbol, sector: UNCLASSIFIED_SECTOR, industry: null, isin: null, company_type: null,
    statement_basis: "consolidated", fy_end_month: 3, market: emptyMarket(), annual: [], quarterly: [], shareholding: [],
    snapshot: {}, sample_note: null, source_note: null,
  };
}

/** Sector used when none is supplied. */
export const UNCLASSIFIED_SECTOR = "Unclassified";

export function normalizeSymbol(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim().toUpperCase();
  return s === "" ? null : s;
}

// ── series helpers ──────────────────────────────────────────────────────────
function dayNumber(iso: string): number {
  const p = parseIsoDate(iso);
  return p ? daysFromCivil(p.y, p.m, p.d) : Number.NaN;
}

/** Fiscal-year end date implied by a fiscal year and year-end month. */
export function fiscalYearEnd(fiscalYear: number, fyEndMonth: number): ISODate {
  return formatIsoDate({ y: fiscalYear, m: fyEndMonth, d: daysInMonth(fiscalYear, fyEndMonth) });
}

/**
 * Sorts annual rows ascending, removes duplicate years (the later row wins, with a warning) and
 * drops years older than the grid can hold (MAX_ANNUAL_SLOTS), with a warning.
 */
export function tidyAnnual(rows: readonly AnnualRow[], symbol: string, sink: IssueSink): AnnualRow[] {
  const byYear = new Map<number, AnnualRow>();
  for (const r of rows) {
    if (byYear.has(r.fiscal_year)) {
      push(sink, "warning", "W113_DUPLICATE_PERIOD", `${symbol}: ${fyLabel(r.fiscal_year)} appears more than once; the later row is used.`, {
        symbol, period: fyLabel(r.fiscal_year),
      });
    }
    byYear.set(r.fiscal_year, r);
  }
  const sorted = [...byYear.values()].sort((a, b) => a.fiscal_year - b.fiscal_year);
  if (sorted.length === 0) return sorted;
  const latest = sorted[sorted.length - 1].fiscal_year;
  const kept = sorted.filter((r) => r.fiscal_year > latest - MAX_ANNUAL_SLOTS);
  if (kept.length < sorted.length) {
    push(sink, "warning", "W116_PERIODS_DROPPED", `${symbol}: ${sorted.length - kept.length} annual period(s) older than ${MAX_ANNUAL_SLOTS} years were dropped.`, { symbol });
  }
  return kept;
}

/** Same for dated series (quarters, shareholding), keyed by period end; the window is `max` quarterly slots. */
export function tidyDated<T extends { period_end: ISODate }>(
  rows: readonly T[], symbol: string, sink: IssueSink, max: number, what: string,
): T[] {
  const byDate = new Map<string, T>();
  for (const r of rows) {
    if (byDate.has(r.period_end)) {
      push(sink, "warning", "W113_DUPLICATE_PERIOD", `${symbol}: the ${what} for ${r.period_end} appears more than once; the later row is used.`, {
        symbol, period: r.period_end,
      });
    }
    byDate.set(r.period_end, r);
  }
  const sorted = [...byDate.values()].sort((a, b) => dayNumber(a.period_end) - dayNumber(b.period_end));
  if (sorted.length === 0) return sorted;
  const latest = sorted[sorted.length - 1].period_end;
  const oldestSlot = addMonths(latest, -3 * (max - 1));
  const cutoff = oldestSlot === null ? Number.NEGATIVE_INFINITY : dayNumber(oldestSlot) - QUARTER_MATCH_TOLERANCE_DAYS;
  const kept = sorted.filter((r) => dayNumber(r.period_end) >= cutoff);
  if (kept.length < sorted.length) {
    push(sink, "warning", "W116_PERIODS_DROPPED", `${symbol}: ${sorted.length - kept.length} ${what} period(s) older than ${max} quarters were dropped.`, { symbol });
  }
  return kept;
}

// ── company normalisation from loosely shaped input ─────────────────────────
type Loose = Record<string, unknown>;

function asObject(x: unknown): Loose | null {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Loose) : null;
}

function numberField(raw: unknown, sink: IssueSink, ctx: { symbol: string; field: string; period: string | null; row?: number | null }): number | null {
  const r = readNumberCell(raw);
  if (r.ok) return r.v;
  push(sink, "warning", "W111_NOT_A_NUMBER", `${ctx.symbol}: "${r.text}" is not a number for ${ctx.field}${ctx.period ? ` (${ctx.period})` : ""}; treated as not provided.`, {
    symbol: ctx.symbol, field: ctx.field, period: ctx.period, row: ctx.row ?? null,
  });
  return null;
}

function textField(raw: unknown): string | null {
  return readTextCell(raw);
}

/**
 * Builds a canonical CompanyRecord from a loosely shaped object (canonical JSON, a provider's
 * output, or the joined CSV draft). Returns null when the symbol is missing.
 */
export function normalizeCompany(input: unknown, sink: IssueSink, position: string): CompanyRecord | null {
  const o = asObject(input);
  if (!o) {
    push(sink, "warning", "W120_EMPTY_SYMBOL", `${position} is not a company object and was skipped.`);
    return null;
  }
  const symbol = normalizeSymbol(o.symbol);
  if (!symbol) {
    push(sink, "warning", "W120_EMPTY_SYMBOL", `${position} has no symbol and was skipped.`, { field: "symbol" });
    return null;
  }
  const c = emptyCompany(symbol);
  c.name = textField(o.name) ?? symbol;
  c.sector = textField(o.sector) ?? UNCLASSIFIED_SECTOR;
  c.industry = textField(o.industry);
  const isin = textField(o.isin);
  c.isin = isin === null ? null : isin.toUpperCase();
  c.sample_note = textField(o.sample_note);
  c.source_note = textField(o.source_note);

  const type = readCompanyType(o.company_type);
  if (type === undefined) {
    push(sink, "warning", "W118_BAD_VALUE", `${symbol}: company type "${String(o.company_type)}" is not recognised; it will be inferred.`, { symbol, field: "company_type" });
  }
  c.company_type = type ?? null;

  const basis = readBasis(o.statement_basis);
  if (basis === undefined) {
    push(sink, "warning", "W118_BAD_VALUE", `${symbol}: statement basis "${String(o.statement_basis)}" is not recognised; consolidated is assumed.`, { symbol, field: "statement_basis" });
  }
  c.statement_basis = basis ?? "consolidated";

  const month = readMonth(o.fy_end_month);
  if (month === undefined) {
    push(sink, "warning", "W118_BAD_VALUE", `${symbol}: year-end month "${String(o.fy_end_month)}" is not recognised; March is assumed.`, { symbol, field: "fy_end_month" });
  }
  c.fy_end_month = month ?? 3;

  // Market inputs
  const m = asObject(o.market) ?? {};
  const mctx = (field: string) => ({ symbol, field, period: null });
  c.market.price = numberField(m.price, sink, mctx("price"));
  c.market.shares_outstanding = numberField(m.shares_outstanding, sink, mctx("shares_outstanding"));
  c.market.face_value = numberField(m.face_value, sink, mctx("face_value"));
  c.market.market_cap_supplied = numberField(m.market_cap_supplied, sink, mctx("market_cap"));
  const priceDate = readDate(m.price_date);
  if (priceDate === undefined) {
    push(sink, "warning", "W117_BAD_DATE", `${symbol}: price date "${String(m.price_date)}" is not a date; treated as not provided.`, { symbol, field: "price_date" });
  }
  c.market.price_date = priceDate ?? null;

  // Snapshot values (metric id → number). Legacy keys are renamed to metric ids.
  const snap = asObject(o.snapshot) ?? {};
  for (const [rawKey, rawValue] of Object.entries(snap)) {
    const key = rawKey.trim();
    if (!key) continue;
    const id = (LEGACY_KEY_TO_METRIC as Readonly<Record<string, string>>)[key] ?? key;
    const v = numberField(rawValue, sink, { symbol, field: id, period: null });
    if (v === null) continue;
    if (id === "price" && c.market.price === null) c.market.price = v;
    else if (id === "market_cap" && c.market.market_cap_supplied === null) c.market.market_cap_supplied = v;
    else if (id !== "price" && id !== "market_cap") c.snapshot[id] = v;
  }

  // Annual rows
  const annualIn = Array.isArray(o.annual) ? o.annual : [];
  const annual: AnnualRow[] = [];
  annualIn.forEach((raw, k) => {
    const r = asObject(raw);
    if (!r) return;
    let fy = readFiscalYear(r.fiscal_year);
    const pe = readDate(r.period_end);
    if (pe === undefined) {
      push(sink, "warning", "W117_BAD_DATE", `${symbol}: annual period end "${String(r.period_end)}" is not a date; treated as not provided.`, { symbol, field: "period_end" });
    }
    if ((fy === null || fy === undefined) && pe) {
      const p = parseIsoDate(pe);
      if (p) fy = fiscalYearOf(p.y, p.m, c.fy_end_month);
    }
    if (fy === null || fy === undefined) {
      push(sink, "warning", "W117_BAD_DATE", `${symbol}: annual row ${k + 1} has no readable fiscal year and was skipped.`, { symbol, field: "fiscal_year" });
      return;
    }
    const row = emptyAnnualRow(fy, pe ?? null);
    const { flags, unknown } = readFlags(r.flags);
    row.flags = flags;
    if (unknown.length) {
      push(sink, "warning", "W118_BAD_VALUE", `${symbol}: unknown period flag(s) ${unknown.join(", ")} for ${fyLabel(fy)} were ignored.`, { symbol, field: "flags", period: fyLabel(fy) });
    }
    for (const f of ANNUAL_FIELDS) row[f] = numberField(r[f], sink, { symbol, field: f, period: fyLabel(fy) });
    annual.push(row);
  });
  c.annual = tidyAnnual(annual, symbol, sink);

  // Quarterly and shareholding rows
  const dated = <T extends { period_end: ISODate }>(
    list: unknown, make: (d: ISODate) => T, fields: readonly (keyof T & string)[], what: string,
  ): T[] => {
    const out: T[] = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const r = asObject(raw);
      if (!r) continue;
      const d = readDate(r.period_end);
      if (!d) {
        push(sink, "warning", "W117_BAD_DATE", `${symbol}: a ${what} row without a readable period end ("${String(r.period_end ?? "")}") was skipped.`, { symbol, field: "period_end" });
        continue;
      }
      const row = make(d);
      for (const f of fields) (row as Record<string, unknown>)[f] = numberField(r[f], sink, { symbol, field: f, period: d });
      out.push(row);
    }
    return out;
  };
  c.quarterly = tidyDated(dated(o.quarterly, emptyQuarterRow, QUARTER_FIELDS, "quarterly result"), symbol, sink, MAX_QUARTER_SLOTS, "quarterly");
  c.shareholding = tidyDated(dated(o.shareholding, emptyShareholdingRow, SHAREHOLDING_FIELDS, "shareholding"), symbol, sink, MAX_SHAREHOLDING_SLOTS, "shareholding");
  return c;
}

// ── dataset normalisation ───────────────────────────────────────────────────
const SOURCES: readonly DatasetSource[] = ["synthetic_sample", "user_import", "custom_provider"];
const FILE_KINDS: readonly ImportFileKind[] = ["canonical_json", "snapshot", "companies", "annual", "quarterly", "shareholding"];

export function defaultMeta(name: string, source: DatasetSource = "user_import"): DatasetMeta {
  return {
    name, source, isSynthetic: source === "synthetic_sample", asOf: null, importedAt: null, currency: "INR",
    moneyUnit: "crore", sharesUnit: "crore", files: [], generator: null, notes: [],
  };
}

export function normalizeMeta(input: unknown, fallbackName: string, sink: IssueSink): DatasetMeta {
  const o = asObject(input) ?? {};
  const name = textField(o.name) ?? fallbackName;
  const source = SOURCES.find((s) => s === o.source) ?? "user_import";
  const meta = defaultMeta(name, source);
  meta.isSynthetic = typeof o.isSynthetic === "boolean" ? o.isSynthetic : source === "synthetic_sample";
  const asOf = readDate(o.asOf);
  if (asOf === undefined) push(sink, "warning", "W117_BAD_DATE", `The "as of" date "${String(o.asOf)}" is not a date; treated as not provided.`, { field: "asOf" });
  meta.asOf = asOf ?? null;
  meta.importedAt = typeof o.importedAt === "string" && o.importedAt.trim() ? o.importedAt.trim() : null;
  for (const unit of ["moneyUnit", "sharesUnit"] as const) {
    if (o[unit] !== undefined && o[unit] !== "crore") {
      push(sink, "warning", "W105_UNITS_META", `The file declares ${unit} "${String(o[unit])}". Funda Scanner reads figures as crore; convert them before importing.`, { field: unit });
    }
  }
  if (o.currency !== undefined && o.currency !== "INR") {
    push(sink, "warning", "W105_UNITS_META", `The file declares currency "${String(o.currency)}". Funda Scanner reads every figure as Indian rupees.`, { field: "currency" });
  }
  if (Array.isArray(o.files)) {
    for (const f of o.files) {
      const fo = asObject(f);
      const kind = fo ? FILE_KINDS.find((k) => k === fo.kind) : undefined;
      if (fo && kind && typeof fo.name === "string") meta.files.push({ name: fo.name, kind, rows: typeof fo.rows === "number" ? fo.rows : 0 });
    }
  }
  const g = asObject(o.generator);
  if (g && g.name === "funda-sample" && typeof g.version === "string" && typeof g.seed === "number") {
    meta.generator = { name: "funda-sample", version: g.version, seed: g.seed };
  }
  if (Array.isArray(o.notes)) meta.notes = o.notes.filter((n): n is string => typeof n === "string" && n.trim() !== "").map((n) => n.trim());
  return meta;
}

/**
 * Normalises a whole dataset-shaped value. When a symbol appears twice the later company is kept
 * (in the earlier position), with a warning. The input is never mutated.
 */
export function normalizeDataset(input: unknown, sink: IssueSink, fallbackName = "Imported data"): FundamentalsDataset {
  const o = asObject(input) ?? {};
  const meta = normalizeMeta(o.meta, fallbackName, sink);
  const bySymbol = new Map<string, CompanyRecord>();
  const list = Array.isArray(o.companies) ? o.companies : [];
  list.forEach((raw, k) => {
    const c = normalizeCompany(raw, sink, `Company ${k + 1}`);
    if (!c) return;
    if (bySymbol.has(c.symbol)) {
      push(sink, "warning", "W114_DUPLICATE_COMPANY", `${c.symbol} appears more than once; the later entry is used.`, { symbol: c.symbol });
    }
    bySymbol.set(c.symbol, c);
  });
  return { schema: DATASET_SCHEMA, version: DATASET_VERSION, meta, companies: [...bySymbol.values()] };
}
