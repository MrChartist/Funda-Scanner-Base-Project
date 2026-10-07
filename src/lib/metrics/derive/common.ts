// src/lib/metrics/derive/common.ts — the deriver interface and the building blocks of §C.1.
//
// A deriver computes one value for company i at a grid slot. The store calls derivers only for
// companies the metric applies to (others get not_applicable_financial) and caches whole columns,
// so derivers may read other metrics through the context (ctx.fy, ctx.ttm, ctx.latest, …).
//
// Raw reads follow one rule: a slot beyond the company's history is insufficient_history, a hole
// inside it is missing_input, and a null field is missing_input — except the ZERO_DEFAULT_FIELDS,
// which read as 0 flagged AssumedZero when the row exists but the field is null.
import type {
  AnnualField, AnnualRow, CompanyRecord, MetricStore, QuarterField, QuarterRow, ShareholdingField, ShareholdingRow,
  TypeFamily,
} from "@/lib/contracts";
import { QUARTER_MATCH_TOLERANCE_DAYS, VF, ZERO_DEFAULT_FIELDS } from "@/lib/contracts";
import { type CompanyGrid, dayNumber, fyEndDay } from "../grid";
import { type V, add, nul, ok, sub, withFlags } from "../values";

export interface DeriveContext {
  readonly n: number;
  /** The store being built (for score functions that read line items through the public API). */
  readonly store: MetricStore;
  company(i: number): CompanyRecord;
  grid(i: number): CompanyGrid;
  family(i: number): TypeFamily;
  /** Derived value of an annual metric at slot k (statements only; no snapshot fill). */
  fy(id: string, i: number, k: number): V;
  /** TTM block b of a ttm-capable metric, with the FY fallback for block 0. */
  ttm(id: string, i: number, b: number): V;
  /** Derived value of a quarterly metric at quarter slot k. */
  q(id: string, i: number, k: number): V;
  /** Derived value of a shareholding metric at shareholding slot k. */
  sh(id: string, i: number, k: number): V;
  /** Derived value of a latest-only metric (no snapshot fill). */
  latest(id: string, i: number): V;
}

export interface AnnualDeriver {
  kind: "annual";
  at(c: DeriveContext, i: number, k: number): V;
  /** Set when the value is this field exactly as supplied; the store then reads rows directly. */
  rawField?: AnnualField;
  /** TTM block b from four grid quarters; null when the block is incomplete (the store then falls back). */
  ttm?(c: DeriveContext, i: number, b: number): V | null;
}
export interface QuarterlyDeriver {
  kind: "quarterly";
  at(c: DeriveContext, i: number, k: number): V;
  rawField?: QuarterField;
}
export interface ShareholdingDeriver {
  kind: "shareholding";
  at(c: DeriveContext, i: number, k: number): V;
  rawField?: ShareholdingField;
}
export interface LatestDeriver {
  kind: "latest";
  get(c: DeriveContext, i: number): V;
}
export type Deriver = AnnualDeriver | QuarterlyDeriver | ShareholdingDeriver | LatestDeriver;
export type DeriverTable = Readonly<Record<string, Deriver>>;

export const annual = (at: AnnualDeriver["at"], ttm?: AnnualDeriver["ttm"]): AnnualDeriver =>
  ttm ? { kind: "annual", at, ttm } : { kind: "annual", at };
export const quarterly = (at: QuarterlyDeriver["at"]): QuarterlyDeriver => ({ kind: "quarterly", at });
export const shareholding = (at: ShareholdingDeriver["at"]): ShareholdingDeriver => ({ kind: "shareholding", at });
export const latest = (get: LatestDeriver["get"]): LatestDeriver => ({ kind: "latest", get });

/** Section 115BAA rate used when the reported tax rate is not usable (§C.1). */
export const FALLBACK_TAX_RATE = 0.2517;

const ZERO_DEFAULT: ReadonlySet<AnnualField> = new Set(ZERO_DEFAULT_FIELDS);

// ── raw reads ────────────────────────────────────────────────────────────────
/** Annual row at slot k, or the null reason for an absent slot. */
export function fyRow(c: DeriveContext, i: number, k: number): AnnualRow | V {
  const rows = c.grid(i).annual;
  if (k < 0 || k >= rows.length) return nul("insufficient_history");
  const row = rows[k];
  return row ?? nul("missing_input");
}

/** True for a grid row, false for the null value returned for an absent slot (rows have no "reason"). */
export function isRow<T extends object>(x: T | V): x is T {
  return (x as { reason?: unknown }).reason === undefined;
}

/** True when annual slot k holds a row. */
export function hasFy(c: DeriveContext, i: number, k: number): boolean {
  const rows = c.grid(i).annual;
  return k >= 0 && k < rows.length && rows[k] !== null;
}

/** Annual field at slot k. ZERO_DEFAULT_FIELDS read as 0 (AssumedZero) when the row exists. */
export function fy(c: DeriveContext, i: number, k: number, field: AnnualField): V {
  const row = fyRow(c, i, k);
  if (!isRow(row)) return row;
  const v = row[field];
  if (v !== null && Number.isFinite(v)) return ok(v);
  if (ZERO_DEFAULT.has(field)) return ok(0, VF.AssumedZero);
  return nul("missing_input");
}

/** Annual field at slot k exactly as supplied (no zero default), for line items. */
export function fyAsGiven(c: DeriveContext, i: number, k: number, field: AnnualField): V {
  const row = fyRow(c, i, k);
  if (!isRow(row)) return row;
  const v = row[field];
  return v !== null && Number.isFinite(v) ? ok(v) : nul("missing_input");
}

export function qRow(c: DeriveContext, i: number, k: number): QuarterRow | V {
  const rows = c.grid(i).quarter;
  if (k < 0 || k >= rows.length) return nul("insufficient_history");
  return rows[k] ?? nul("missing_input");
}

export function qField(c: DeriveContext, i: number, k: number, field: QuarterField): V {
  const row = qRow(c, i, k);
  if (!isRow(row)) return row;
  const v = row[field];
  return v !== null && Number.isFinite(v) ? ok(v) : nul("missing_input");
}

/** True when quarter slot k holds a row. */
export function hasQ(c: DeriveContext, i: number, k: number): boolean {
  const rows = c.grid(i).quarter;
  return k >= 0 && k < rows.length && rows[k] !== null;
}

export function shRow(c: DeriveContext, i: number, k: number): ShareholdingRow | V {
  const rows = c.grid(i).share;
  if (k < 0 || k >= rows.length) return nul("insufficient_history");
  return rows[k] ?? nul("missing_input");
}

export function shField(c: DeriveContext, i: number, k: number, field: ShareholdingField): V {
  const row = shRow(c, i, k);
  if (!isRow(row)) return row;
  const v = row[field];
  return v !== null && Number.isFinite(v) ? ok(v) : nul("missing_input");
}

export function hasSh(c: DeriveContext, i: number, k: number): boolean {
  const rows = c.grid(i).share;
  return k >= 0 && k < rows.length && rows[k] !== null;
}

// ── §C.1 building blocks (annual slot k) ─────────────────────────────────────
/** owners_pat = net_profit_owners ?? net_profit. */
export function ownersPat(c: DeriveContext, i: number, k: number): V {
  const owners = fy(c, i, k, "net_profit_owners");
  if (owners.v !== null || owners.reason !== "missing_input" || !hasFy(c, i, k)) return owners;
  return fy(c, i, k, "net_profit");
}

/** PAT including the minority share. */
export const pat = (c: DeriveContext, i: number, k: number): V => fy(c, i, k, "net_profit");
/** ebitda = revenue − operating_expenses. */
export const ebitda = (c: DeriveContext, i: number, k: number): V => sub(fy(c, i, k, "revenue"), fy(c, i, k, "operating_expenses"));
/** op_ebit = ebitda − depreciation. */
export const opEbit = (c: DeriveContext, i: number, k: number): V => sub(ebitda(c, i, k), fy(c, i, k, "depreciation"));
/** ebit = ebitda + other_income − depreciation (other income defaults to 0, flagged). */
export const ebit = (c: DeriveContext, i: number, k: number): V =>
  sub(add(ebitda(c, i, k), fy(c, i, k, "other_income")), fy(c, i, k, "depreciation"));
/** net_worth = equity_share_capital + other_equity. */
export const netWorth = (c: DeriveContext, i: number, k: number): V =>
  add(fy(c, i, k, "equity_share_capital"), fy(c, i, k, "other_equity"));
/** total_equity = net_worth + NCI. */
export const totalEquity = (c: DeriveContext, i: number, k: number): V => add(netWorth(c, i, k), fy(c, i, k, "non_controlling_interest"));
/** total_debt = borrowings_non_current + borrowings_current + lease_liabilities. */
export const totalDebt = (c: DeriveContext, i: number, k: number): V =>
  add(fy(c, i, k, "borrowings_non_current"), fy(c, i, k, "borrowings_current"), fy(c, i, k, "lease_liabilities"));
/** cash_like = cash_and_bank + current_investments. */
export const cashLike = (c: DeriveContext, i: number, k: number): V => add(fy(c, i, k, "cash_and_bank"), fy(c, i, k, "current_investments"));
/** capital_employed = total_equity + total_debt. */
export const capitalEmployed = (c: DeriveContext, i: number, k: number): V => add(totalEquity(c, i, k), totalDebt(c, i, k));
/** The same building blocks read through the store's series caches (each slot computed once per store). */
export const capitalEmployedCached = (c: DeriveContext, i: number, k: number): V => c.fy("capital_employed", i, k);
export const netWorthCached = (c: DeriveContext, i: number, k: number): V => c.fy("net_worth", i, k);
/** invested_capital = total_equity + total_debt − cash_like. */
export const investedCapital = (c: DeriveContext, i: number, k: number): V => sub(capitalEmployed(c, i, k), cashLike(c, i, k));
/** net_debt = total_debt − cash_like. */
export const netDebt = (c: DeriveContext, i: number, k: number): V => sub(totalDebt(c, i, k), cashLike(c, i, k));

/** shares_ye = shares_outstanding_ye ?? market.shares_outstanding (the fallback is flagged Approximate). */
export function sharesYe(c: DeriveContext, i: number, k: number): V {
  const s = fy(c, i, k, "shares_outstanding_ye");
  if (s.v !== null || !hasFy(c, i, k)) return s;
  const m = c.company(i).market.shares_outstanding;
  return m !== null && Number.isFinite(m) ? ok(m, VF.Approximate) : nul("missing_input");
}

/** tax_rate = tax / pbt when pbt > 0 and the ratio is within [0, 0.5]; otherwise 25.17%. */
export function taxRate(c: DeriveContext, i: number, k: number): number {
  const pbt = fy(c, i, k, "pbt");
  const tax = fy(c, i, k, "tax_expense");
  if (pbt.v !== null && tax.v !== null && pbt.v > 0) {
    const r = tax.v / pbt.v;
    if (r >= 0 && r <= 0.5) return r;
  }
  return FALLBACK_TAX_RATE;
}

/**
 * avg(X) = (X_t + X_t−1) / 2. When X_t−1 is not available (first year, a hole or a missing
 * field) the closing value X_t is used and ClosingBasis is flagged.
 */
export function avgOf(fn: (c: DeriveContext, i: number, k: number) => V, c: DeriveContext, i: number, k: number): V {
  const cur = fn(c, i, k);
  if (cur.v === null) return cur;
  const prev = fn(c, i, k + 1);
  if (prev.v === null) return withFlags(cur, VF.ClosingBasis);
  return ok((cur.v + prev.v) / 2, (cur.flags | prev.flags));
}

/** Average of a raw annual field (see avgOf). */
export const avgField = (field: AnnualField) => (c: DeriveContext, i: number, k: number): V =>
  avgOf((cc, ii, kk) => fy(cc, ii, kk, field), c, i, k);

/** True when annual slot k is restated or a transition year. */
export function flaggedFy(c: DeriveContext, i: number, k: number): boolean {
  const rows = c.grid(i).annual;
  const row = k >= 0 && k < rows.length ? rows[k] : null;
  return row !== null && row.flags.length > 0;
}

// ── TTM ──────────────────────────────────────────────────────────────────────
/**
 * The four grid quarters of TTM block b (slots 4b … 4b+3), or null when any is empty. Block 0
 * is also treated as unavailable when its latest quarter ends before the latest financial year
 * (stale quarters), so the newer FY figure is used instead.
 */
export function ttmBlock(c: DeriveContext, i: number, b: number): QuarterRow[] | null {
  const rows = c.grid(i).quarter;
  const out: QuarterRow[] = [];
  for (let j = 4 * b; j < 4 * b + 4; j++) {
    const row = j < rows.length ? rows[j] : null;
    if (!row) return null;
    out.push(row);
  }
  if (b === 0) {
    const fy0 = c.grid(i).annual[0];
    const qd = dayNumber(out[0].period_end);
    if (fy0 && qd !== null && qd < fyEndDay(fy0, c.company(i).fy_end_month) - QUARTER_MATCH_TOLERANCE_DAYS) return null;
  }
  return out;
}

/** Sum over the block of a per-quarter number; null when any quarter lacks it. */
export function sumQuarters(rows: readonly QuarterRow[], fn: (r: QuarterRow) => number | null): number | null {
  let s = 0;
  for (const r of rows) {
    const v = fn(r);
    if (v === null || !Number.isFinite(v)) return null;
    s += v;
  }
  return s;
}

export const qRevenue = (r: QuarterRow): number | null => r.revenue;
export const qEbitda = (r: QuarterRow): number | null =>
  r.revenue !== null && r.operating_expenses !== null ? r.revenue - r.operating_expenses : null;
export const qOpEbit = (r: QuarterRow): number | null => {
  const e = qEbitda(r);
  return e !== null && r.depreciation !== null ? e - r.depreciation : null;
};
export const qOwnersPat = (r: QuarterRow): number | null => r.net_profit_owners ?? r.net_profit;
export const qPat = (r: QuarterRow): number | null => r.net_profit;
